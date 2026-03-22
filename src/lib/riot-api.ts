import { prisma } from "./prisma";

const RIOT_API_KEY = process.env.RIOT_API_KEY;
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

interface RegionInfo {
  platform: string;
  routing: string;
}

const REGION_MAP: Record<string, RegionInfo> = {
  euw: { platform: "euw1", routing: "europe" },
  eune: { platform: "eun1", routing: "europe" },
  na: { platform: "na1", routing: "americas" },
  kr: { platform: "kr", routing: "asia" },
  jp: { platform: "jp1", routing: "asia" },
  br: { platform: "br1", routing: "americas" },
  lan: { platform: "la1", routing: "americas" },
  las: { platform: "la2", routing: "americas" },
  oce: { platform: "oc1", routing: "sea" },
  tr: { platform: "tr1", routing: "europe" },
  ru: { platform: "ru", routing: "europe" },
  ph: { platform: "ph2", routing: "sea" },
  sg: { platform: "sg2", routing: "sea" },
  th: { platform: "th2", routing: "sea" },
  tw: { platform: "tw2", routing: "sea" },
  vn: { platform: "vn2", routing: "sea" },
};

export interface ParsedOpGg {
  region: string;
  gameName: string;
  tagLine: string;
  platform: string;
  routing: string;
}

export interface RankInfo {
  tier: string | null;
  rank: string | null;
  lp: number | null;
  wins: number | null;
  losses: number | null;
}

/**
 * Parse an op.gg URL into region, gameName, and tagLine.
 * Supports multiple formats:
 *   - https://www.op.gg/summoners/euw/PlayerName-TAG
 *   - https://op.gg/lol/summoners/search?q=PlayerName&region=euw
 *   - https://op.gg/lol/summoners/search?q=PlayerName-TAG&region=euw
 */
export function parseOpGgUrl(url: string): ParsedOpGg | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("op.gg")) return null;

    // Format 1: Search URL — /lol/summoners/search?q=...&region=...
    if (parsed.pathname.includes("/search")) {
      const q = parsed.searchParams.get("q");
      const regionParam = parsed.searchParams.get("region");
      if (!q || !regionParam) return null;

      const region = regionParam.toLowerCase();
      const regionInfo = REGION_MAP[region];
      if (!regionInfo) return null;

      const decoded = decodeURIComponent(q);

      // Check if tag is in the query (Name-TAG or Name#TAG)
      const hashIndex = decoded.indexOf("#");
      const lastDash = decoded.lastIndexOf("-");

      let gameName: string;
      let tagLine: string;

      if (hashIndex > 0) {
        gameName = decoded.substring(0, hashIndex);
        tagLine = decoded.substring(hashIndex + 1);
      } else if (lastDash > 0) {
        gameName = decoded.substring(0, lastDash);
        tagLine = decoded.substring(lastDash + 1);
      } else {
        // No tag provided — use region as tagLine (common default)
        gameName = decoded;
        tagLine = region.toUpperCase();
      }

      return { region, gameName, tagLine, platform: regionInfo.platform, routing: regionInfo.routing };
    }

    // Format 2: Direct profile URL — /summoners/{region}/{gameName}-{tagLine}
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length < 3 || parts[0] !== "summoners") return null;

    const region = parts[1].toLowerCase();
    const regionInfo = REGION_MAP[region];
    if (!regionInfo) return null;

    const nameAndTag = parts.slice(2).join("/");
    const lastDash = nameAndTag.lastIndexOf("-");
    if (lastDash <= 0) return null;

    const gameName = decodeURIComponent(nameAndTag.substring(0, lastDash));
    const tagLine = decodeURIComponent(nameAndTag.substring(lastDash + 1));

    return { region, gameName, tagLine, platform: regionInfo.platform, routing: regionInfo.routing };
  } catch {
    return null;
  }
}

async function riotFetch(url: string): Promise<Response> {
  return fetch(url, {
    headers: { "X-Riot-Token": RIOT_API_KEY! },
  });
}

/**
 * Fetch ranked data for a player, using cache when available.
 */
export async function fetchRankedData(opGgLink: string): Promise<{ puuid: string; rank: RankInfo } | null> {
  if (!RIOT_API_KEY) {
    console.log("[riot-api] No RIOT_API_KEY set");
    return null;
  }

  const parsed = parseOpGgUrl(opGgLink);
  if (!parsed) {
    console.log(`[riot-api] Failed to parse op.gg URL: ${opGgLink}`);
    return null;
  }

  console.log(`[riot-api] Parsed: region=${parsed.region} gameName=${parsed.gameName} tagLine=${parsed.tagLine} platform=${parsed.platform} routing=${parsed.routing}`);

  // 1. Get account PUUID
  const accountUrl = `https://${parsed.routing}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(parsed.gameName)}/${encodeURIComponent(parsed.tagLine)}`;
  const accountRes = await riotFetch(accountUrl);
  if (!accountRes.ok) {
    console.log(`[riot-api] Account lookup failed: ${accountRes.status} ${await accountRes.text().catch(() => "")}`);
    return null;
  }
  const accountData = await accountRes.json();
  const puuid = accountData.puuid as string;

  // Check cache
  const cached = await prisma.rankedData.findUnique({ where: { puuid } });
  if (cached && Date.now() - cached.fetchedAt.getTime() < CACHE_DURATION_MS) {
    return {
      puuid,
      rank: {
        tier: cached.tier,
        rank: cached.rank,
        lp: cached.lp,
        wins: cached.wins,
        losses: cached.losses,
      },
    };
  }

  // 2. Get summoner ID from PUUID
  const summonerRes = await riotFetch(
    `https://${parsed.platform}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`
  );
  if (!summonerRes.ok) {
    console.log(`[riot-api] Summoner lookup failed: ${summonerRes.status}`);
    return null;
  }
  const summonerData = await summonerRes.json();
  const summonerId = summonerData.id as string;

  // 3. Get ranked entries
  const leagueRes = await riotFetch(
    `https://${parsed.platform}.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerId}`
  );
  if (!leagueRes.ok) {
    console.log(`[riot-api] League lookup failed: ${leagueRes.status}`);
    return null;
  }
  const leagueEntries = await leagueRes.json();

  // Find solo queue entry
  const soloQueue = (leagueEntries as Array<Record<string, unknown>>).find(
    (e) => e.queueType === "RANKED_SOLO_5x5"
  );

  const rankInfo: RankInfo = soloQueue
    ? {
        tier: soloQueue.tier as string,
        rank: soloQueue.rank as string,
        lp: soloQueue.leaguePoints as number,
        wins: soloQueue.wins as number,
        losses: soloQueue.losses as number,
      }
    : { tier: null, rank: null, lp: null, wins: null, losses: null };

  // Upsert cache
  await prisma.rankedData.upsert({
    where: { puuid },
    create: {
      puuid,
      region: parsed.region,
      summonerName: parsed.gameName,
      tagLine: parsed.tagLine,
      tier: rankInfo.tier,
      rank: rankInfo.rank,
      lp: rankInfo.lp,
      wins: rankInfo.wins,
      losses: rankInfo.losses,
      fetchedAt: new Date(),
    },
    update: {
      tier: rankInfo.tier,
      rank: rankInfo.rank,
      lp: rankInfo.lp,
      wins: rankInfo.wins,
      losses: rankInfo.losses,
      fetchedAt: new Date(),
    },
  });

  return { puuid, rank: rankInfo };
}
