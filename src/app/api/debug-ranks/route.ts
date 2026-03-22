import { NextResponse } from "next/server";
import { parseOpGgUrl, fetchRankedData } from "@/lib/riot-api";

export const runtime = "nodejs";

export async function GET() {
  const testUrl = "https://op.gg/lol/summoners/search?q=miniluva&region=euw";

  const parsed = parseOpGgUrl(testUrl);
  const hasKey = !!process.env.RIOT_API_KEY;
  const keyPrefix = process.env.RIOT_API_KEY?.substring(0, 10) ?? "NOT SET";

  let rankResult = null;
  let error = null;

  try {
    rankResult = await fetchRankedData(testUrl);
  } catch (err) {
    error = String(err);
  }

  return NextResponse.json({
    parsed,
    hasKey,
    keyPrefix,
    rankResult,
    error,
  });
}
