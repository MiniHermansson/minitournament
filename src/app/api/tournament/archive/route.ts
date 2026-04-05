import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isOrganizer } from "@/lib/auth-utils";
import { resolveActiveTournamentId } from "@/lib/active-tournament";

export const runtime = "nodejs";

export async function POST() {
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
  if (tournament.status !== "COMPLETED" && tournament.status !== "CANCELLED") {
    return NextResponse.json(
      { error: "Only completed or cancelled tournaments can be archived" },
      { status: 400 }
    );
  }

  await prisma.tournament.update({
    where: { id: tournamentId },
    data: { status: "ARCHIVED" },
  });

  return NextResponse.json({ success: true });
}
