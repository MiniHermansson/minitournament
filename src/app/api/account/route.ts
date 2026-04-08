import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { updateProfileSchema, deleteAccountSchema } from "@/lib/validators/account";
import { z } from "zod";

export const runtime = "nodejs";

export async function GET() {
  const { error, session } = await requireAuth();
  if (error) return error;

  const user = await prisma.user.findUnique({
    where: { id: session!.user.id },
    include: { accounts: { select: { provider: true } } },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      image: user.image,
      providers: user.accounts.map((a) => a.provider),
    },
  });
}

export async function PATCH(req: Request) {
  const { error, session } = await requireAuth();
  if (error) return error;

  try {
    const body = await req.json();
    const data = updateProfileSchema.parse(body);

    const user = await prisma.user.update({
      where: { id: session!.user.id },
      data: {
        name: data.name,
        image: data.image === "" ? null : data.image,
      },
      select: { id: true, name: true, image: true },
    });

    return NextResponse.json({ user });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    console.error("Profile update error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const userId = session!.user.id;

  try {
    const body = await req.json();
    deleteAccountSchema.parse(body);

    // Block if organizer of active tournaments
    const activeTournament = await prisma.tournament.findFirst({
      where: {
        organizerId: userId,
        status: { in: ["REGISTRATION", "DRAFTING", "IN_PROGRESS"] },
      },
    });

    if (activeTournament) {
      return NextResponse.json(
        { error: "You cannot delete your account while organizing an active tournament. Complete or cancel your tournaments first." },
        { status: 400 }
      );
    }

    // Block if owns teams in active tournaments
    const activeTeam = await prisma.team.findFirst({
      where: {
        ownerId: userId,
        registrations: {
          some: {
            status: "ACCEPTED",
            tournament: { status: { in: ["IN_PROGRESS", "DRAFTING"] } },
          },
        },
      },
    });

    if (activeTeam) {
      return NextResponse.json(
        { error: "You cannot delete your account while your teams are active in tournaments." },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      // Delete owned teams not in active tournaments
      await tx.team.deleteMany({ where: { ownerId: userId } });

      // Nullify co-organizer references
      await tx.tournament.updateMany({
        where: { coOrganizerId: userId },
        data: { coOrganizerId: null },
      });

      // Delete user (cascades handle accounts, sessions, signups, drafts)
      await tx.user.delete({ where: { id: userId } });
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    console.error("Account deletion error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
