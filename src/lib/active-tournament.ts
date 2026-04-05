import { cache } from "react";
import { prisma } from "./prisma";

const ACTIVE_STATUSES = [
  "DRAFT",
  "REGISTRATION",
  "DRAFTING",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;

/**
 * Cached fetch of the single active (non-archived) tournament.
 * Deduplicated within a single server request via React cache().
 */
export const getActiveTournament = cache(async () => {
  return prisma.tournament.findFirst({
    where: { status: { not: "ARCHIVED" } },
    include: {
      organizer: { select: { id: true, name: true, image: true } },
      registrations: {
        include: {
          team: {
            include: {
              owner: { select: { id: true, name: true } },
              _count: { select: { members: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      playerSignups: {
        include: {
          user: { select: { id: true, name: true, image: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      _count: { select: { groups: true, brackets: true } },
    },
    orderBy: { createdAt: "desc" },
  });
});

/**
 * Lightweight version — returns only the active tournament's ID.
 * Use in API routes where you don't need the full tournament data.
 */
export async function resolveActiveTournamentId(): Promise<string | null> {
  const t = await prisma.tournament.findFirst({
    where: { status: { not: "ARCHIVED" } },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });
  return t?.id ?? null;
}
