import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { changePasswordSchema } from "@/lib/validators/account";
import { z } from "zod";

export const runtime = "nodejs";

export async function PUT(req: Request) {
  const { error, session } = await requireAuth();
  if (error) return error;

  try {
    const body = await req.json();
    const data = changePasswordSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { id: session!.user.id },
    });

    if (!user || !user.password) {
      return NextResponse.json(
        { error: "Password change is not available for OAuth accounts" },
        { status: 400 }
      );
    }

    const isValid = await bcrypt.compare(data.currentPassword, user.password);
    if (!isValid) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(data.newPassword, 12);

    await prisma.user.update({
      where: { id: session!.user.id },
      data: { password: hashedPassword },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    console.error("Password change error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
