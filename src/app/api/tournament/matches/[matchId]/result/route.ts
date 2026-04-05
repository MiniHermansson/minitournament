import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isOrganizer } from "@/lib/auth-utils";
import { resolveActiveTournamentId } from "@/lib/active-tournament";
import { getEngine } from "@/lib/tournament-engine";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const { matchId } = await params;

  const tournamentId = await resolveActiveTournamentId();
  if (!tournamentId) {
    return NextResponse.json({ error: "No active tournament" }, { status: 404 });
  }

  const { error, session } = await requireAuth();
  if (error) return error;

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
  });

  if (!tournament) {
    return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
  }
  if (!isOrganizer(tournament, session!.user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (tournament.status !== "IN_PROGRESS") {
    return NextResponse.json(
      { error: "Tournament is not in progress" },
      { status: 400 }
    );
  }

  try {
    const body = await req.json();
    const { winnerId, games = [] } = body;

    if (!winnerId) {
      return NextResponse.json({ error: "Winner ID is required" }, { status: 400 });
    }

    const engine = getEngine(tournament.format);
    await engine.submitResult({
      matchId,
      winnerId,
      games: games.map((g: any, i: number) => ({
        gameNumber: g.gameNumber ?? i + 1,
        winnerId: g.winnerId,
      })),
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
