import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { GroupStageEngine } from "@/lib/tournament-engine/group-stage";

export const runtime = "nodejs";

// Get groups with standings and matches
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  const { tournamentId } = await params;

  const groups = await prisma.group.findMany({
    where: { tournamentId },
    include: {
      teams: {
        include: {
          group: true,
        },
        orderBy: { points: "desc" },
      },
      matches: {
        include: {
          homeTeam: { select: { id: true, name: true, tag: true } },
          awayTeam: { select: { id: true, name: true, tag: true } },
          winner: { select: { id: true, name: true, tag: true } },
        },
        orderBy: [{ round: "asc" }, { position: "asc" }],
      },
    },
    orderBy: { name: "asc" },
  });

  // Resolve team names for standings
  const teamIds = groups.flatMap((g) => g.teams.map((t) => t.teamId));
  const teams = await prisma.team.findMany({
    where: { id: { in: teamIds } },
    select: { id: true, name: true, tag: true },
  });
  const teamMap = new Map(teams.map((t) => [t.id, t]));

  const groupsWithTeamInfo = groups.map((group) => ({
    ...group,
    teams: group.teams
      .map((gt) => ({
        ...gt,
        team: teamMap.get(gt.teamId),
      }))
      .sort((a, b) => b.points - a.points || b.wins - a.wins || a.losses - b.losses),
  }));

  return NextResponse.json({ groups: groupsWithTeamInfo });
}

// Generate playoff from groups (for GROUP_STAGE_PLAYOFF)
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  const { tournamentId } = await params;
  const { error, session } = await requireAuth();
  if (error) return error;

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
  });

  if (!tournament) {
    return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
  }
  if (tournament.organizerId !== session!.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (tournament.format !== "GROUP_STAGE_PLAYOFF") {
    return NextResponse.json(
      { error: "Only GROUP_STAGE_PLAYOFF tournaments can generate playoffs" },
      { status: 400 }
    );
  }

  // Check all group matches are complete
  const remaining = await prisma.match.count({
    where: { tournamentId, groupId: { not: null }, status: { not: "COMPLETED" } },
  });

  if (remaining > 0) {
    return NextResponse.json(
      { error: `${remaining} group match(es) still pending` },
      { status: 400 }
    );
  }

  try {
    const engine = new GroupStageEngine(true);
    await engine.generatePlayoff(tournamentId);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
