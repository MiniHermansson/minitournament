import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveActiveTournamentId } from "@/lib/active-tournament";
import { fetchRankedData, RankInfo } from "@/lib/riot-api";
import { z } from "zod";

export const runtime = "nodejs";

const ranksSchema = z.object({
  userIds: z.array(z.string()).min(1).max(100),
});

export async function POST(req: Request) {
  const tournamentId = await resolveActiveTournamentId();
  if (!tournamentId) {
    return NextResponse.json({ error: "No active tournament" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const { userIds } = ranksSchema.parse(body);

    const signups = await prisma.playerSignup.findMany({
      where: {
        tournamentId,
        userId: { in: userIds },
        opGgLink: { not: null },
      },
      select: {
        userId: true,
        opGgLink: true,
        riotPuuid: true,
      },
    });

    const ranks: Record<string, RankInfo | null> = {};

    const puuidSignups = signups.filter((s) => s.riotPuuid);
    if (puuidSignups.length > 0) {
      const cachedData = await prisma.rankedData.findMany({
        where: {
          puuid: { in: puuidSignups.map((s) => s.riotPuuid!) },
        },
      });
      const cacheMap = new Map(cachedData.map((d) => [d.puuid, d]));

      for (const signup of puuidSignups) {
        const cached = cacheMap.get(signup.riotPuuid!);
        if (cached && Date.now() - cached.fetchedAt.getTime() < 60 * 60 * 1000) {
          ranks[signup.userId] = {
            tier: cached.tier,
            rank: cached.rank,
            lp: cached.lp,
            wins: cached.wins,
            losses: cached.losses,
          };
        }
      }
    }

    const remaining = signups.filter((s) => !(s.userId in ranks) && s.opGgLink);

    await Promise.allSettled(
      remaining.map(async (signup) => {
        try {
          const result = await fetchRankedData(signup.opGgLink!);
          if (result) {
            ranks[signup.userId] = result.rank;

            if (!signup.riotPuuid) {
              await prisma.playerSignup.update({
                where: {
                  tournamentId_userId: { tournamentId, userId: signup.userId },
                },
                data: { riotPuuid: result.puuid },
              });
            }
          } else {
            ranks[signup.userId] = null;
          }
        } catch {
          ranks[signup.userId] = null;
        }
      })
    );

    return NextResponse.json({ ranks });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    console.error("Ranks fetch error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
