import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isOrganizer } from "@/lib/auth-utils";
import { resolveActiveTournamentId } from "@/lib/active-tournament";
import { draftPickSchema } from "@/lib/validators/tournament";
import { z } from "zod";
import { getTeamForPick } from "@/lib/tournament-utils";

export const runtime = "nodejs";

export async function DELETE() {
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
  if (tournament.status !== "DRAFTING") {
    return NextResponse.json({ error: "Draft is not active" }, { status: 400 });
  }

  const draftState = await prisma.draftState.findUnique({
    where: { tournamentId },
    include: { picks: { orderBy: { pickNumber: "desc" }, take: 1 } },
  });

  if (!draftState || draftState.picks.length === 0) {
    return NextResponse.json({ error: "No picks to undo" }, { status: 400 });
  }

  const lastPick = draftState.picks[0];

  await prisma.$transaction(async (tx) => {
    await tx.draftPick.delete({ where: { id: lastPick.id } });
    await tx.draftState.update({
      where: { id: draftState.id },
      data: { currentPick: lastPick.pickNumber - 1 },
    });
  });

  return NextResponse.json({ success: true, undonePickNumber: lastPick.pickNumber });
}

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

    const nextPickNumber = draftState.currentPick + 1;
    const teamNumber = getTeamForPick(nextPickNumber, draftState.totalTeams);

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
