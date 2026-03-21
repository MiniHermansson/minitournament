import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { updateTournamentSchema } from "@/lib/validators/tournament";
import { z } from "zod";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  const { tournamentId } = await params;

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      organizer: { select: { id: true, name: true, image: true } },
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
      _count: { select: { registrations: true, matches: true } },
    },
  });

  if (!tournament) {
    return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
  }

  return NextResponse.json({ tournament });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  const { tournamentId } = await params;
  const { error, session } = await requireAuth();
  if (error) return error;

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
  });

  if (!tournament) {
    return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
  }
  if (tournament.organizerId !== session!.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();

    // Handle status transitions
    if (body.status) {
      const validTransitions: Record<string, string[]> = {
        DRAFT: ["REGISTRATION", "CANCELLED"],
        REGISTRATION: ["IN_PROGRESS", "DRAFT", "CANCELLED"],
        IN_PROGRESS: ["COMPLETED", "CANCELLED"],
        COMPLETED: [],
        CANCELLED: ["DRAFT"],
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
