import { prisma } from "@/lib/prisma";
import { generateRoundRobinSchedule } from "@/lib/tournament-utils";
import type { TournamentEngine, GenerateOptions, SubmitResultOptions, Standing, TeamWithSeed } from "./types";
import { SingleEliminationEngine } from "./single-elimination";

export class GroupStageEngine implements TournamentEngine {
  private withPlayoff: boolean;

  constructor(withPlayoff: boolean = false) {
    this.withPlayoff = withPlayoff;
  }

  async generate({ tournamentId, teams, formatConfig }: GenerateOptions): Promise<void> {
    const bestOf = (formatConfig.bestOf as number) || 1;
    const groupCount = (formatConfig.groupCount as number) || 4;
    const numTeams = teams.length;

    if (numTeams < groupCount * 2) {
      throw new Error(`Need at least ${groupCount * 2} teams for ${groupCount} groups`);
    }

    // Sort by seed
    const sorted = [...teams].sort((a, b) => a.seed - b.seed);

    // Distribute teams into groups using serpentine seeding
    // Round 1: Group A, B, C, D
    // Round 2: Group D, C, B, A
    // This ensures balanced groups
    const groups: TeamWithSeed[][] = Array.from({ length: groupCount }, () => []);

    for (let i = 0; i < sorted.length; i++) {
      const roundIndex = Math.floor(i / groupCount);
      const isReverse = roundIndex % 2 === 1;
      const groupIndex = isReverse
        ? groupCount - 1 - (i % groupCount)
        : i % groupCount;
      groups[groupIndex].push(sorted[i]);
    }

    // Create each group and generate round-robin within
    const groupNames = "ABCDEFGHIJKLMNOP".split("");

    for (let g = 0; g < groupCount; g++) {
      const groupTeams = groups[g];
      const groupName = `Group ${groupNames[g] || g + 1}`;

      const group = await prisma.group.create({
        data: {
          tournamentId,
          name: groupName,
        },
      });

      // Add teams to group
      for (let i = 0; i < groupTeams.length; i++) {
        await prisma.groupTeam.create({
          data: {
            groupId: group.id,
            teamId: groupTeams[i].teamId,
            seed: i + 1,
          },
        });
      }

      // Generate round-robin schedule within this group
      const teamIds = groupTeams.map((t) => t.teamId);
      const schedule = generateRoundRobinSchedule(teamIds);

      for (let round = 0; round < schedule.length; round++) {
        for (let pos = 0; pos < schedule[round].length; pos++) {
          const [homeId, awayId] = schedule[round][pos];
          await prisma.match.create({
            data: {
              tournamentId,
              groupId: group.id,
              round: round + 1,
              position: pos,
              bestOf,
              homeTeamId: homeId,
              awayTeamId: awayId,
              status: "PENDING",
            },
          });
        }
      }
    }
  }

  async submitResult({ matchId, winnerId, games }: SubmitResultOptions): Promise<void> {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        group: { include: { tournament: true } },
      },
    });

    if (!match) throw new Error("Match not found");
    if (match.status === "COMPLETED") throw new Error("Match already completed");
    if (!match.homeTeamId || !match.awayTeamId) throw new Error("Match teams not set");

    // Create game records
    for (const game of games) {
      await prisma.game.create({
        data: {
          matchId,
          gameNumber: game.gameNumber,
          winnerId: game.winnerId,
        },
      });
    }

    // Update match
    await prisma.match.update({
      where: { id: matchId },
      data: { winnerId, status: "COMPLETED" },
    });

    // Update group standings
    if (match.groupId) {
      const config = (match.group?.tournament?.formatConfig as Record<string, unknown>) ?? {};
      const pointsForWin = (config.pointsForWin as number) ?? 3;
      const loserId = winnerId === match.homeTeamId ? match.awayTeamId : match.homeTeamId;

      if (winnerId) {
        await prisma.groupTeam.update({
          where: { groupId_teamId: { groupId: match.groupId, teamId: winnerId } },
          data: {
            wins: { increment: 1 },
            points: { increment: pointsForWin },
          },
        });
        await prisma.groupTeam.update({
          where: { groupId_teamId: { groupId: match.groupId, teamId: loserId! } },
          data: { losses: { increment: 1 } },
        });
      }
    }

    // Check if all group matches are completed
    const remainingGroupMatches = await prisma.match.count({
      where: {
        tournamentId: match.tournamentId,
        groupId: { not: null },
        status: { not: "COMPLETED" },
      },
    });

    // If no playoff, check all matches done
    if (!this.withPlayoff && remainingGroupMatches === 0) {
      await prisma.tournament.update({
        where: { id: match.tournamentId },
        data: { status: "COMPLETED" },
      });
    }

    // For bracket matches in playoff stage
    if (match.bracketId) {
      // Advance winner to next match
      if (match.nextMatchId && match.nextMatchPosition) {
        const updateData =
          match.nextMatchPosition === "home"
            ? { homeTeamId: winnerId }
            : { awayTeamId: winnerId };

        await prisma.match.update({
          where: { id: match.nextMatchId },
          data: updateData,
        });
      }

      // Check if bracket is complete (final match)
      if (!match.nextMatchId) {
        await prisma.tournament.update({
          where: { id: match.tournamentId },
          data: { status: "COMPLETED" },
        });
      }
    }
  }

  async getStandings(tournamentId: string): Promise<Standing[]> {
    const groups = await prisma.group.findMany({
      where: { tournamentId },
      include: { teams: true },
      orderBy: { name: "asc" },
    });

    const standings: Standing[] = [];

    for (const group of groups) {
      const groupStandings = group.teams
        .map((gt) => ({
          teamId: gt.teamId,
          groupId: group.id,
          groupName: group.name,
          wins: gt.wins,
          losses: gt.losses,
          draws: gt.draws,
          points: gt.points,
          rank: 0,
        }))
        .sort((a, b) => b.points - a.points || b.wins - a.wins || a.losses - b.losses);

      groupStandings.forEach((s, i) => (s.rank = i + 1));
      standings.push(...groupStandings);
    }

    return standings;
  }

  // Called when all group matches are complete to generate playoff bracket
  async generatePlayoff(tournamentId: string): Promise<void> {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
    });
    if (!tournament) throw new Error("Tournament not found");

    const config = (tournament.formatConfig as Record<string, unknown>) ?? {};
    const advancingPerGroup = (config.advancingPerGroup as number) ?? 2;
    const playoffBestOf = (config.playoffBestOf as number) ?? 1;

    const standings = await this.getStandings(tournamentId);

    // Group standings by group
    const byGroup = new Map<string, Standing[]>();
    for (const s of standings) {
      if (!s.groupId) continue;
      const group = byGroup.get(s.groupId) ?? [];
      group.push(s);
      byGroup.set(s.groupId, group);
    }

    // Collect advancing teams in seeded order
    // Seed order: 1st from each group, then 2nd from each group, etc.
    const advancingTeams: { teamId: string; seed: number }[] = [];
    let seed = 1;

    for (let rank = 0; rank < advancingPerGroup; rank++) {
      for (const [, groupStandings] of byGroup) {
        if (rank < groupStandings.length) {
          advancingTeams.push({
            teamId: groupStandings[rank].teamId,
            seed: seed++,
          });
        }
      }
    }

    if (advancingTeams.length < 2) {
      throw new Error("Not enough teams advancing to create a playoff");
    }

    // Generate single elimination bracket with advancing teams
    const engine = new SingleEliminationEngine();
    await engine.generate({
      tournamentId,
      teams: advancingTeams,
      formatConfig: { bestOf: playoffBestOf },
    });
  }
}

