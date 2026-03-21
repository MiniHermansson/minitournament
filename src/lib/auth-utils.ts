import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "./auth";

export async function getSession() {
  return getServerSession(authOptions);
}

export async function requireAuth() {
  const session = await getSession();
  if (!session?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), session: null };
  }
  return { error: null, session };
}

export function isOrganizer(
  tournament: { organizerId: string; coOrganizerId?: string | null },
  userId: string
): boolean {
  return tournament.organizerId === userId || tournament.coOrganizerId === userId;
}
