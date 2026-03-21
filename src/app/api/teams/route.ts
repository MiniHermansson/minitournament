import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { createTeamSchema } from "@/lib/validators/team";
import { z } from "zod";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "12");
  const skip = (page - 1) * limit;

  const [teams, total] = await Promise.all([
    prisma.team.findMany({
      skip,
      take: limit,
      include: {
        owner: { select: { id: true, name: true, image: true } },
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.team.count(),
  ]);

  return NextResponse.json({ teams, total, page, totalPages: Math.ceil(total / limit) });
}

export async function POST(req: Request) {
  const { error, session } = await requireAuth();
  if (error) return error;

  try {
    const body = await req.json();
    const data = createTeamSchema.parse(body);

    const team = await prisma.team.create({
      data: {
        name: data.name,
        tag: data.tag,
        logoUrl: data.logoUrl || null,
        ownerId: session!.user.id,
      },
      include: {
        owner: { select: { id: true, name: true, image: true } },
      },
    });

    return NextResponse.json({ team }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
