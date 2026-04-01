import { cache } from "react";
import { prisma } from "./prisma";

/**
 * Cached tournament fetch — deduplicated within a single server request.
 * Both the (tabs) layout and the overview page call this,
 * but React's cache() ensures only one DB query is executed.
 */
export const getTournament = cache(async (tournamentId: string) => {
  return prisma.tournament.findUnique({
    where: { id: tournamentId },
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
  });
});
