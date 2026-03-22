import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isOrganizer } from "@/lib/auth-utils";
import { playerSignupSchema } from "@/lib/validators/tournament";
import { z } from "zod";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  const { tournamentId } = await params;

  const signups = await prisma.playerSignup.findMany({
    where: { tournamentId },
    include: {
      user: { select: { id: true, name: true, image: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ signups });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { tournamentId } = await params;

  try {
    const body = await req.json();
    const data = playerSignupSchema.parse(body);

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
    }

    if (tournament.teamMode !== "CAPTAINS_DRAFT") {
      return NextResponse.json(
        { error: "This tournament uses pre-made teams" },
        { status: 400 }
      );
    }

    if (tournament.status !== "REGISTRATION") {
      return NextResponse.json(
        { error: "Registration is not open" },
        { status: 400 }
      );
    }

    // Check if already signed up
    const existing = await prisma.playerSignup.findUnique({
      where: { tournamentId_userId: { tournamentId, userId: session!.user.id } },
    });

    if (existing) {
      return NextResponse.json(
        { error: "You are already signed up" },
        { status: 400 }
      );
    }

    // If mainRole is FILL, clear secondaryRole
    const secondaryRole = data.mainRole === "FILL" ? null : (data.secondaryRole ?? null);

    const signup = await prisma.playerSignup.create({
      data: {
        tournamentId,
        userId: session!.user.id,
        mainRole: data.mainRole,
        secondaryRole,
        wantsCaptain: data.wantsCaptain,
        opGgLink: data.opGgLink || null,
        discordName: data.discordName,
      },
    });

    return NextResponse.json({ signup }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    console.error("Signup error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { tournamentId } = await params;

  // Check if a userId query param is provided (organizer removing someone else)
  const { searchParams } = new URL(req.url);
  const targetUserId = searchParams.get("userId");

  if (targetUserId && targetUserId !== session!.user.id) {
    // Organizer removing another player
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
    }
    if (!isOrganizer(tournament, session!.user.id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const signup = await prisma.playerSignup.findUnique({
      where: { tournamentId_userId: { tournamentId, userId: targetUserId } },
    });

    if (!signup) {
      return NextResponse.json({ error: "Player not signed up" }, { status: 404 });
    }

    await prisma.playerSignup.delete({ where: { id: signup.id } });
    return NextResponse.json({ success: true });
  }

  // Player removing themselves
  const signup = await prisma.playerSignup.findUnique({
    where: { tournamentId_userId: { tournamentId, userId: session!.user.id } },
  });

  if (!signup) {
    return NextResponse.json({ error: "Not signed up" }, { status: 404 });
  }

  await prisma.playerSignup.delete({ where: { id: signup.id } });

  return NextResponse.json({ success: true });
}
