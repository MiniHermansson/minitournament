import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-utils";
import { createTournamentSchema } from "@/lib/validators/tournament";
import { resolveActiveTournamentId } from "@/lib/active-tournament";
import { z } from "zod";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "12");
  const skip = (page - 1) * limit;

  const where = status ? { status: status as any } : {};

  const [tournaments, total] = await Promise.all([
    prisma.tournament.findMany({
      where,
      skip,
      take: limit,
      include: {
        organizer: { select: { id: true, name: true, image: true } },
        _count: { select: { registrations: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.tournament.count({ where }),
  ]);

  return NextResponse.json({
    tournaments,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}

export async function POST(req: Request) {
  const { error, session } = await requireAdmin();
  if (error) return error;

  try {
    // Enforce single active tournament
    const activeId = await resolveActiveTournamentId();
    if (activeId) {
      return NextResponse.json(
        { error: "An active tournament already exists. Archive it first." },
        { status: 409 }
      );
    }

    const body = await req.json();
    const data = createTournamentSchema.parse(body);

    let coOrganizerId: string | null = null;
    if (body.coOrganizerDiscord) {
      const coOrg = await prisma.user.findUnique({
        where: { discordUsername: body.coOrganizerDiscord },
      });
      if (!coOrg) {
        return NextResponse.json({ error: "Co-organizer user not found" }, { status: 404 });
      }
      if (coOrg.id === session!.user.id) {
        return NextResponse.json({ error: "Co-organizer cannot be the same as the organizer" }, { status: 400 });
      }
      coOrganizerId = coOrg.id;
    }

    const tournament = await prisma.tournament.create({
      data: {
        name: data.name,
        description: data.description || null,
        format: data.format,
        teamMode: data.teamMode,
        maxTeams: data.maxTeams,
        minTeams: data.minTeams,
        teamSize: data.teamSize,
        registrationOpen: data.registrationOpen ? new Date(data.registrationOpen) : null,
        registrationClose: data.registrationClose ? new Date(data.registrationClose) : null,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        formatConfig: (data.formatConfig ?? null) as any,
        organizerId: session!.user.id,
        coOrganizerId,
      },
    });

    return NextResponse.json({ tournament }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
