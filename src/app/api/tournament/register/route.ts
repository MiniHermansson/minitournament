import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isOrganizer } from "@/lib/auth-utils";
import { resolveActiveTournamentId } from "@/lib/active-tournament";
import { updateRegistrationSchema } from "@/lib/validators/tournament";
import { z } from "zod";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const tournamentId = await resolveActiveTournamentId();
  if (!tournamentId) {
    return NextResponse.json({ error: "No active tournament" }, { status: 404 });
  }

  const { error, session } = await requireAuth();
  if (error) return error;

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { _count: { select: { registrations: true } } },
  });

  if (!tournament) {
    return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
  }
  if (tournament.status !== "REGISTRATION") {
    return NextResponse.json({ error: "Tournament is not accepting registrations" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { teamId } = body;

    if (!teamId) {
      return NextResponse.json({ error: "Team ID is required" }, { status: 400 });
    }

    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }
    if (team.ownerId !== session!.user.id) {
      return NextResponse.json({ error: "Only team owners can register their team" }, { status: 403 });
    }

    const existing = await prisma.tournamentRegistration.findUnique({
      where: { tournamentId_teamId: { tournamentId, teamId } },
    });
    if (existing) {
      return NextResponse.json({ error: "Team is already registered" }, { status: 400 });
    }

    if (tournament._count.registrations >= tournament.maxTeams) {
      return NextResponse.json({ error: "Tournament is full" }, { status: 400 });
    }

    const registration = await prisma.tournamentRegistration.create({
      data: { tournamentId, teamId },
      include: {
        team: { include: { owner: { select: { id: true, name: true } } } },
      },
    });

    return NextResponse.json({ registration }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
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

  try {
    const body = await req.json();
    const { registrationId, ...rest } = body;
    const data = updateRegistrationSchema.parse(rest);

    if (!registrationId) {
      return NextResponse.json({ error: "Registration ID is required" }, { status: 400 });
    }

    const registration = await prisma.tournamentRegistration.update({
      where: { id: registrationId },
      data: { status: data.status },
      include: {
        team: { include: { owner: { select: { id: true, name: true } } } },
      },
    });

    return NextResponse.json({ registration });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
