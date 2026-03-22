import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { fetchRankedData, RankInfo } from "@/lib/riot-api";
import { z } from "zod";

export const runtime = "nodejs";

const ranksSchema = z.object({
  userIds: z.array(z.string()).min(1).max(100),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  const { error } = await requireAuth();
  if (error) return error;

  const { tournamentId } = await params;

  try {
    const body = await req.json();
    const { userIds } = ranksSchema.parse(body);

    // Get signups with op.gg links for the requested users
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

    // Check for cached data first (users with known puuids)
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

    // Fetch remaining ranks from Riot API
    const remaining = signups.filter((s) => !(s.userId in ranks) && s.opGgLink);

    console.log(`[ranks] ${signups.length} signups with op.gg links, ${remaining.length} need fresh fetch`);

    await Promise.allSettled(
      remaining.map(async (signup) => {
        try {
          console.log(`[ranks] Fetching rank for user ${signup.userId}, opGgLink: ${signup.opGgLink}`);
          const result = await fetchRankedData(signup.opGgLink!);
          if (result) {
            console.log(`[ranks] Got rank for ${signup.userId}: ${result.rank.tier} ${result.rank.rank}`);
            ranks[signup.userId] = result.rank;

            // Link puuid to signup if not already linked
            if (!signup.riotPuuid) {
              await prisma.playerSignup.update({
                where: {
                  tournamentId_userId: { tournamentId, userId: signup.userId },
                },
                data: { riotPuuid: result.puuid },
              });
            }
          } else {
            console.log(`[ranks] fetchRankedData returned null for ${signup.userId}`);
            ranks[signup.userId] = null;
          }
        } catch (err) {
          console.error(`[ranks] Error fetching rank for ${signup.userId}:`, err);
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
