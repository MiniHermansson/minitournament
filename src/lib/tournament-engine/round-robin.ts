import { prisma } from "@/lib/prisma";
import { generateRoundRobinSchedule } from "@/lib/tournament-utils";
import type { TournamentEngine, GenerateOptions, SubmitResultOptions, Standing } from "./types";

export class RoundRobinEngine implements TournamentEngine {
  async generate({ tournamentId, teams, formatConfig }: GenerateOptions): Promise<void> {
    const bestOf = (formatConfig.bestOf as number) || 1;
    const pointsForWin = (formatConfig.pointsForWin as number) ?? 3;
    const pointsForDraw = (formatConfig.pointsForDraw as number) ?? 1;
    const numTeams = teams.length;

    if (numTeams < 2) throw new Error("Need at least 2 teams");

    // Create a single group for round robin
    const group = await prisma.group.create({
      data: {
        tournamentId,
        name: "Round Robin",
      },
    });

    // Add all teams to the group
    for (const team of teams) {
      await prisma.groupTeam.create({
        data: {
          groupId: group.id,
          teamId: team.teamId,
          seed: team.seed,
        },
      });
    }

    // Generate round-robin schedule using circle method
    const schedule = generateRoundRobinSchedule(teams.map((t) => t.teamId));

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
      const isDraw = !winnerId;
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

    // Check if all matches in tournament are complete
    const remaining = await prisma.match.count({
      where: { tournamentId: match.tournamentId, status: { not: "COMPLETED" } },
    });

    if (remaining === 0) {
      await prisma.tournament.update({
        where: { id: match.tournamentId },
        data: { status: "COMPLETED" },
      });
    }
  }

  async getStandings(tournamentId: string): Promise<Standing[]> {
    const groups = await prisma.group.findMany({
      where: { tournamentId },
      include: {
        teams: true,
      },
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
}

