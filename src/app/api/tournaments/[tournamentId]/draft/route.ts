import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isOrganizer } from "@/lib/auth-utils";
import { z } from "zod";

export const runtime = "nodejs";

function getTeamForPick(pickNumber: number, totalTeams: number): number {
  const round = Math.ceil(pickNumber / totalTeams);
  const posInRound = (pickNumber - 1) % totalTeams;
  return round % 2 === 1 ? posInRound + 1 : totalTeams - posInRound;
}

// GET: Return draft state
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  const { tournamentId } = await params;

  const draftState = await prisma.draftState.findUnique({
    where: { tournamentId },
    include: {
      captains: {
        include: { user: { select: { id: true, name: true, image: true } } },
        orderBy: { teamNumber: "asc" },
      },
      picks: {
        include: { user: { select: { id: true, name: true, image: true } } },
        orderBy: { pickNumber: "asc" },
      },
    },
  });

  if (!draftState) {
    // Draft not started yet — return signups for captain assignment
    const signups = await prisma.playerSignup.findMany({
      where: { tournamentId },
      include: { user: { select: { id: true, name: true, image: true } } },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ draftState: null, signups });
  }

  // Get signups for the player pool
  const signups = await prisma.playerSignup.findMany({
    where: { tournamentId },
    include: { user: { select: { id: true, name: true, image: true } } },
    orderBy: { createdAt: "asc" },
  });

  // Calculate who picks next
  const totalPicks = draftState.totalTeams * 4;
  const nextPick = draftState.currentPick + 1;
  const isComplete = draftState.currentPick >= totalPicks;
  const nextTeam = isComplete ? null : getTeamForPick(nextPick, draftState.totalTeams);
  const currentRound = isComplete ? null : Math.ceil(nextPick / draftState.totalTeams);

  // Filter out drafted players and captains from pool
  const draftedUserIds = new Set([
    ...draftState.captains.map((c) => c.userId),
    ...draftState.picks.map((p) => p.userId),
  ]);
  const availablePlayers = signups.filter((s) => !draftedUserIds.has(s.userId));

  return NextResponse.json({
    draftState: {
      ...draftState,
      nextPick,
      nextTeam,
      currentRound,
      isComplete,
      totalPicks,
    },
    availablePlayers,
    signups,
  });
}

// POST: Initialize draft with captains
const initDraftSchema = z.object({
  captains: z.array(
    z.object({
      userId: z.string(),
      teamNumber: z.number().int().min(1),
    })
  ).min(2, "Need at least 2 captains"),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { tournamentId } = await params;

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
  });

  if (!tournament) {
    return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
  }
  if (!isOrganizer(tournament, session!.user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (tournament.teamMode !== "CAPTAINS_DRAFT") {
    return NextResponse.json({ error: "Not a captains draft tournament" }, { status: 400 });
  }
  if (tournament.status !== "REGISTRATION") {
    return NextResponse.json({ error: "Tournament must be in REGISTRATION status" }, { status: 400 });
  }

  // Check if draft already exists
  const existing = await prisma.draftState.findUnique({
    where: { tournamentId },
  });
  if (existing) {
    return NextResponse.json({ error: "Draft already initialized" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const data = initDraftSchema.parse(body);

    // Verify all captains are signed up for this tournament
    const signups = await prisma.playerSignup.findMany({
      where: { tournamentId },
    });
    const signedUpUserIds = new Set(signups.map((s) => s.userId));

    for (const captain of data.captains) {
      if (!signedUpUserIds.has(captain.userId)) {
        return NextResponse.json(
          { error: `Captain ${captain.userId} is not signed up for this tournament` },
          { status: 400 }
        );
      }
    }

    // Create draft state in a transaction
    const draftState = await prisma.$transaction(async (tx) => {
      // Update tournament status to DRAFTING
      await tx.tournament.update({
        where: { id: tournamentId },
        data: { status: "DRAFTING" },
      });

      // Create draft state
      const draft = await tx.draftState.create({
        data: {
          tournamentId,
          totalTeams: data.captains.length,
          currentPick: 0,
          captains: {
            create: data.captains.map((c) => ({
              userId: c.userId,
              teamNumber: c.teamNumber,
            })),
          },
        },
        include: {
          captains: {
            include: { user: { select: { id: true, name: true } } },
          },
        },
      });

      return draft;
    });

    return NextResponse.json({ draftState }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    console.error("Draft init error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
