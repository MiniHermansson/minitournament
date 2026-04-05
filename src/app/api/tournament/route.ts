import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isOrganizer } from "@/lib/auth-utils";
import { resolveActiveTournamentId } from "@/lib/active-tournament";
import { updateTournamentSchema } from "@/lib/validators/tournament";
import { z } from "zod";

export const runtime = "nodejs";

export async function GET() {
  const tournamentId = await resolveActiveTournamentId();
  if (!tournamentId) {
    return NextResponse.json({ error: "No active tournament" }, { status: 404 });
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      organizer: { select: { id: true, name: true, image: true } },
      coOrganizer: { select: { id: true, name: true, image: true, email: true } },
      registrations: {
        include: {
          team: {
            include: {
              owner: { select: { id: true, name: true } },
              _count: { select: { members: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      playerSignups: {
        include: {
          user: { select: { id: true, name: true, image: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      _count: { select: { registrations: true, matches: true, playerSignups: true } },
    },
  });

  return NextResponse.json({ tournament });
}

export async function PATCH(req: Request) {
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

  try {
    const body = await req.json();

    if (body.status) {
      const validTransitions: Record<string, string[]> = {
        DRAFT: ["REGISTRATION", "CANCELLED"],
        REGISTRATION: ["IN_PROGRESS", "DRAFTING", "DRAFT", "CANCELLED"],
        DRAFTING: ["REGISTRATION", "CANCELLED"],
        IN_PROGRESS: ["COMPLETED", "CANCELLED"],
        COMPLETED: ["ARCHIVED"],
        CANCELLED: ["DRAFT", "ARCHIVED"],
      };

      if (!validTransitions[tournament.status]?.includes(body.status)) {
        return NextResponse.json(
          { error: `Cannot transition from ${tournament.status} to ${body.status}` },
          { status: 400 }
        );
      }

      const updated = await prisma.tournament.update({
        where: { id: tournamentId },
        data: { status: body.status },
      });
      return NextResponse.json({ tournament: updated });
    }

    if ("coOrganizerEmail" in body) {
      let coOrganizerId: string | null = null;
      if (body.coOrganizerEmail) {
        const coOrg = await prisma.user.findUnique({
          where: { email: body.coOrganizerEmail },
        });
        if (!coOrg) {
          return NextResponse.json({ error: "Co-organizer user not found" }, { status: 404 });
        }
        if (coOrg.id === tournament.organizerId) {
          return NextResponse.json({ error: "Co-organizer cannot be the same as the organizer" }, { status: 400 });
        }
        coOrganizerId = coOrg.id;
      }
      const updated = await prisma.tournament.update({
        where: { id: tournamentId },
        data: { coOrganizerId },
      });
      return NextResponse.json({ tournament: updated });
    }

    const data = updateTournamentSchema.parse(body);

    const updated = await prisma.tournament.update({
      where: { id: tournamentId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description || null }),
        ...(data.format && { format: data.format }),
        ...(data.maxTeams && { maxTeams: data.maxTeams }),
        ...(data.minTeams && { minTeams: data.minTeams }),
        ...(data.formatConfig !== undefined && { formatConfig: (data.formatConfig ?? null) as any }),
        ...(data.registrationOpen !== undefined && {
          registrationOpen: data.registrationOpen ? new Date(data.registrationOpen) : null,
        }),
        ...(data.registrationClose !== undefined && {
          registrationClose: data.registrationClose ? new Date(data.registrationClose) : null,
        }),
        ...(data.startDate !== undefined && {
          startDate: data.startDate ? new Date(data.startDate) : null,
        }),
        ...(data.endDate !== undefined && {
          endDate: data.endDate ? new Date(data.endDate) : null,
        }),
        ...(data.rules !== undefined && { rules: data.rules || null }),
      },
    });

    return NextResponse.json({ tournament: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

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
  if (tournament.status !== "DRAFT" && tournament.status !== "CANCELLED") {
    return NextResponse.json(
      { error: "Only draft or cancelled tournaments can be deleted" },
      { status: 400 }
    );
  }

  await prisma.tournament.delete({ where: { id: tournamentId } });

  return NextResponse.json({ success: true });
}
