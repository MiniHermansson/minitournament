import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isOrganizer } from "@/lib/auth-utils";
import { resolveActiveTournamentId } from "@/lib/active-tournament";
import { z } from "zod";
import { getTeamForPick } from "@/lib/tournament-utils";

export const runtime = "nodejs";

export async function GET() {
  const tournamentId = await resolveActiveTournamentId();
  if (!tournamentId) {
    return NextResponse.json({ error: "No active tournament" }, { status: 404 });
  }

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
    const signups = await prisma.playerSignup.findMany({
      where: { tournamentId },
      include: { user: { select: { id: true, name: true, image: true } } },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ draftState: null, signups });
  }

  const signups = await prisma.playerSignup.findMany({
    where: { tournamentId },
    include: { user: { select: { id: true, name: true, image: true } } },
    orderBy: { createdAt: "asc" },
  });

  const totalPicks = draftState.totalTeams * 4;
  const nextPick = draftState.currentPick + 1;
  const isComplete = draftState.currentPick >= totalPicks;
  const nextTeam = isComplete ? null : getTeamForPick(nextPick, draftState.totalTeams);
  const currentRound = isComplete ? null : Math.ceil(nextPick / draftState.totalTeams);

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

const initDraftSchema = z.object({
  captains: z.array(
    z.object({
      userId: z.string(),
      teamNumber: z.number().int().min(1),
    })
  ).min(2, "Need at least 2 captains"),
});

export async function POST(req: Request) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const tournamentId = await resolveActiveTournamentId();
  if (!tournamentId) {
    return NextResponse.json({ error: "No active tournament" }, { status: 404 });
  }

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

  const existing = await prisma.draftState.findUnique({
    where: { tournamentId },
  });
  if (existing) {
    return NextResponse.json({ error: "Draft already initialized" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const data = initDraftSchema.parse(body);

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

    const draftState = await prisma.$transaction(async (tx) => {
      await tx.tournament.update({
        where: { id: tournamentId },
        data: { status: "DRAFTING" },
      });

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
