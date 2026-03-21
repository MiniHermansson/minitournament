import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { addMemberSchema } from "@/lib/validators/team";
import { z } from "zod";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
  const { error, session } = await requireAuth();
  if (error) return error;

  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }
  if (team.ownerId !== session!.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const data = addMemberSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      return NextResponse.json(
        { error: "No user found with that email" },
        { status: 404 }
      );
    }

    const existing = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: user.id } },
    });

    if (existing) {
      return NextResponse.json(
        { error: "User is already a member of this team" },
        { status: 400 }
      );
    }

    const member = await prisma.teamMember.create({
      data: {
        teamId,
        userId: user.id,
        role: data.role,
        summonerName: data.summonerName || null,
        isPrimary: data.role !== "SUBSTITUTE",
      },
      include: {
        user: { select: { id: true, name: true, image: true, email: true } },
      },
    });

    return NextResponse.json({ member }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
