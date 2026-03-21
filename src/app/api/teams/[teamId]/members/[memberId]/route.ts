import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ teamId: string; memberId: string }> }
) {
  const { teamId, memberId } = await params;
  const { error, session } = await requireAuth();
  if (error) return error;

  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }
  if (team.ownerId !== session!.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const member = await prisma.teamMember.findUnique({
    where: { id: memberId },
  });

  if (!member || member.teamId !== teamId) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  await prisma.teamMember.delete({ where: { id: memberId } });

  return NextResponse.json({ success: true });
}
