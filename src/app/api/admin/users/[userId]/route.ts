import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-utils";
import { z } from "zod";

export const runtime = "nodejs";

const actionSchema = z.object({
  action: z.literal("changeRole"),
  role: z.enum(["USER", "ADMIN"]),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;

  try {
    const body = await req.json();
    const data = actionSchema.parse(body);

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
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    console.error("Admin action error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
