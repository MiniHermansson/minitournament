import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isOrganizer } from "@/lib/auth-utils";
import { resolveActiveTournamentId } from "@/lib/active-tournament";
import { getEngine } from "@/lib/tournament-engine";

export const runtime = "nodejs";

export async function POST() {
  const tournamentId = await resolveActiveTournamentId();
  if (!tournamentId) {
    return NextResponse.json({ error: "No active tournament" }, { status: 404 });
  }

  const { error, session } = await requireAuth();
  if (error) return error;

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      registrations: {
        where: { status: "ACCEPTED" },
        orderBy: { seed: "asc" },
      },
    },
  });

  if (!tournament) {
    return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
  }
  if (!isOrganizer(tournament, session!.user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (tournament.status !== "REGISTRATION") {
    return NextResponse.json(
      { error: "Tournament must be in REGISTRATION status to generate bracket" },
      { status: 400 }
    );
  }

  const acceptedTeams = tournament.registrations;
  if (acceptedTeams.length < tournament.minTeams) {
    return NextResponse.json(
      { error: `Need at least ${tournament.minTeams} accepted teams` },
      { status: 400 }
    );
  }

  try {
    const engine = getEngine(tournament.format);
    const teams = acceptedTeams.map((r, i) => ({
      teamId: r.teamId,
      seed: r.seed ?? i + 1,
    }));

    await engine.generate({
      tournamentId,
      teams,
      formatConfig: (tournament.formatConfig as Record<string, unknown>) ?? {},
    });

    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { status: "IN_PROGRESS" },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function GET() {
  const tournamentId = await resolveActiveTournamentId();
  if (!tournamentId) {
    return NextResponse.json({ error: "No active tournament" }, { status: 404 });
  }

  const brackets = await prisma.bracket.findMany({
    where: { tournamentId },
    include: {
      matches: {
        include: {
          homeTeam: { select: { id: true, name: true, tag: true } },
          awayTeam: { select: { id: true, name: true, tag: true } },
          winner: { select: { id: true, name: true, tag: true } },
          games: { orderBy: { gameNumber: "asc" } },
        },
        orderBy: [{ round: "asc" }, { position: "asc" }],
      },
    },
    orderBy: { type: "asc" },
  });

  return NextResponse.json({ brackets });
}
