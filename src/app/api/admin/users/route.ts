import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-utils";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";

  const users = await prisma.user.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        }
      : undefined,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      image: true,
      createdAt: true,
      password: false,
      accounts: { select: { provider: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const result = users.map((u) => ({
    ...u,
    hasPassword: false, // We don't select password, check below
    providers: u.accounts.map((a) => a.provider),
    accounts: undefined,
  }));

  // We need to know if they have a password for the UI, do a separate check
  const usersWithPasswordInfo = await prisma.user.findMany({
    where: { id: { in: users.map((u) => u.id) } },
    select: { id: true, password: true },
  });
  const passwordMap = new Map(
    usersWithPasswordInfo.map((u) => [u.id, !!u.password])
  );

  return NextResponse.json({
    users: result.map((u) => ({
      ...u,
      hasPassword: passwordMap.get(u.id) ?? false,
    })),
  });
}
