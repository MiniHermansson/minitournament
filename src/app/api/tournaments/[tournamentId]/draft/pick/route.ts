import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isOrganizer } from "@/lib/auth-utils";
import { draftPickSchema } from "@/lib/validators/tournament";
import { z } from "zod";
import { getTeamForPick } from "@/lib/tournament-utils";

export const runtime = "nodejs";

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
  if (tournament.status !== "DRAFTING") {
    return NextResponse.json({ error: "Draft is not active" }, { status: 400 });
  }

  const draftState = await prisma.draftState.findUnique({
    where: { tournamentId },
    include: { picks: true, captains: true },
  });

  if (!draftState) {
    return NextResponse.json({ error: "Draft not initialized" }, { status: 400 });
  }

  const totalPicks = draftState.totalTeams * 4;
  if (draftState.currentPick >= totalPicks) {
    return NextResponse.json({ error: "Draft is already complete" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const data = draftPickSchema.parse(body);

    // Verify player is signed up and not already drafted/a captain
    const signup = await prisma.playerSignup.findUnique({
      where: { tournamentId_userId: { tournamentId, userId: data.userId } },
    });
    if (!signup) {
      return NextResponse.json({ error: "Player is not signed up" }, { status: 400 });
    }

    const alreadyPicked = draftState.picks.some((p) => p.userId === data.userId);
    const isCaptain = draftState.captains.some((c) => c.userId === data.userId);
    if (alreadyPicked || isCaptain) {
      return NextResponse.json({ error: "Player already drafted or is a captain" }, { status: 400 });
    }

    // Determine which team picks next
    const nextPickNumber = draftState.currentPick + 1;
    const teamNumber = getTeamForPick(nextPickNumber, draftState.totalTeams);

    // Create pick and increment currentPick
    const pick = await prisma.$transaction(async (tx) => {
      const newPick = await tx.draftPick.create({
        data: {
          draftStateId: draftState.id,
          teamNumber,
          pickNumber: nextPickNumber,
          userId: data.userId,
        },
        include: {
          user: { select: { id: true, name: true, image: true } },
        },
      });

      await tx.draftState.update({
        where: { id: draftState.id },
        data: { currentPick: nextPickNumber },
      });

      return newPick;
    });

    return NextResponse.json({ pick, teamNumber });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    console.error("Draft pick error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
