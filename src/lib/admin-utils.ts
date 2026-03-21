import { NextResponse } from "next/server";
import { requireAuth } from "./auth-utils";

const ROLE_HIERARCHY: Record<string, number> = {
  USER: 0,
  ADMIN: 1,
  SUPER_ADMIN: 2,
};

export async function requireAdmin(requiredRole: "ADMIN" | "SUPER_ADMIN" = "ADMIN") {
  const { error, session } = await requireAuth();
  if (error) return { error, session: null };

  const userRole = (session!.user as Record<string, unknown>).role as string | undefined;
  const userLevel = ROLE_HIERARCHY[userRole ?? "USER"] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole];

  if (userLevel < requiredLevel) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      session: null,
    };
  }

  return { error: null, session: session! };
}
