import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-utils";
import { z } from "zod";

export const runtime = "nodejs";

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("resetPassword"),
    newPassword: z.string().min(6, "Password must be at least 6 characters"),
  }),
  z.object({
    action: z.literal("changeEmail"),
    newEmail: z.string().email("Invalid email address"),
  }),
  z.object({
    action: z.literal("changeRole"),
    role: z.enum(["USER", "ADMIN"]),
  }),
]);

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;

  try {
    const body = await req.json();
    const data = actionSchema.parse(body);

    if (data.action === "resetPassword") {
      const { error } = await requireAdmin();
      if (error) return error;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { password: true },
      });

      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      if (!user.password) {
        return NextResponse.json(
          { error: "Cannot reset password for OAuth-only accounts" },
          { status: 400 }
        );
      }

      const hashed = await bcrypt.hash(data.newPassword, 12);
      await prisma.user.update({
        where: { id: userId },
        data: { password: hashed },
      });

      return NextResponse.json({ success: true });
    }

    if (data.action === "changeEmail") {
      const { error } = await requireAdmin();
      if (error) return error;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { accounts: { select: { provider: true } } },
      });

      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      const hasDiscord = user.accounts.some((a) => a.provider === "discord");
      if (hasDiscord) {
        return NextResponse.json(
          { error: "Cannot change email for Discord-linked accounts" },
          { status: 400 }
        );
      }

      const existing = await prisma.user.findUnique({
        where: { email: data.newEmail },
      });
      if (existing) {
        return NextResponse.json(
          { error: "Email already in use" },
          { status: 400 }
        );
      }

      await prisma.user.update({
        where: { id: userId },
        data: { email: data.newEmail },
      });

      return NextResponse.json({ success: true });
    }

    if (data.action === "changeRole") {
      const { error, session } = await requireAdmin("SUPER_ADMIN");
      if (error) return error;

      if (session.user.id === userId) {
        return NextResponse.json(
          { error: "Cannot change your own role" },
          { status: 400 }
        );
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      await prisma.user.update({
        where: { id: userId },
        data: { role: data.role },
      });

      return NextResponse.json({ success: true });
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    console.error("Admin action error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
