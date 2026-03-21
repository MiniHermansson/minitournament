import { prisma } from "@/lib/prisma";
import { nextPowerOf2, generateBracketSeeding } from "@/lib/tournament-utils";
import type { TournamentEngine, GenerateOptions, SubmitResultOptions, Standing } from "./types";

export class SingleEliminationEngine implements TournamentEngine {
  async generate({ tournamentId, teams, formatConfig }: GenerateOptions): Promise<void> {
    const bestOf = (formatConfig.bestOf as number) || 1;
    const numTeams = teams.length;

    if (numTeams < 2) throw new Error("Need at least 2 teams");

    // Find next power of 2 for bracket size
    const bracketSize = nextPowerOf2(numTeams);
    const totalRounds = Math.log2(bracketSize);
    const numByes = bracketSize - numTeams;

    // Sort teams by seed
    const sorted = [...teams].sort((a, b) => a.seed - b.seed);

    // Create bracket
    const bracket = await prisma.bracket.create({
      data: {
        tournamentId,
        type: "WINNERS",
        rounds: totalRounds,
      },
    });

    // Generate seeded positions using standard bracket seeding
    // This ensures top seeds are on opposite sides of the bracket
    const positions = generateBracketSeeding(bracketSize);

    // Create all matches round by round
    const matchesByRound: string[][] = [];

    for (let round = 1; round <= totalRounds; round++) {
      const matchesInRound = bracketSize / Math.pow(2, round);
      const roundMatches: string[] = [];

      for (let pos = 0; pos < matchesInRound; pos++) {
        const match = await prisma.match.create({
          data: {
            tournamentId,
            bracketId: bracket.id,
            round,
            position: pos,
            bestOf,
            status: round === 1 ? "PENDING" : "PENDING",
          },
        });
        roundMatches.push(match.id);
      }
      matchesByRound.push(roundMatches);
    }

    // Wire nextMatchId pointers: winner of each match goes to the next round
    for (let round = 0; round < totalRounds - 1; round++) {
      const currentRoundMatches = matchesByRound[round];
      const nextRoundMatches = matchesByRound[round + 1];

      for (let i = 0; i < currentRoundMatches.length; i++) {
        const nextMatchIndex = Math.floor(i / 2);
        const nextMatchPosition = i % 2 === 0 ? "home" : "away";

        await prisma.match.update({
          where: { id: currentRoundMatches[i] },
          data: {
            nextMatchId: nextRoundMatches[nextMatchIndex],
            nextMatchPosition,
          },
        });
      }
    }

    // Place teams into round 1 matches using seeded positions
    const round1Matches = matchesByRound[0];
    for (let i = 0; i < bracketSize; i += 2) {
      const matchIndex = i / 2;
      const homePos = positions[i];
      const awayPos = positions[i + 1];

      const homeTeam = homePos <= numTeams ? sorted[homePos - 1] : null;
      const awayTeam = awayPos <= numTeams ? sorted[awayPos - 1] : null;

      await prisma.match.update({
        where: { id: round1Matches[matchIndex] },
        data: {
          homeTeamId: homeTeam?.teamId ?? null,
          awayTeamId: awayTeam?.teamId ?? null,
        },
      });

      // Handle byes: if one team has a bye, auto-advance them
      if (homeTeam && !awayTeam) {
        await this.autoAdvance(round1Matches[matchIndex], homeTeam.teamId);
      } else if (!homeTeam && awayTeam) {
        await this.autoAdvance(round1Matches[matchIndex], awayTeam.teamId);
      }
    }
  }

  private async autoAdvance(matchId: string, winnerId: string): Promise<void> {
    const match = await prisma.match.update({
      where: { id: matchId },
      data: {
        winnerId,
        status: "COMPLETED",
      },
    });

    // Place winner in next match
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
  }

  async submitResult({ matchId, winnerId, games }: SubmitResultOptions): Promise<void> {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!match) throw new Error("Match not found");
    if (match.status === "COMPLETED") throw new Error("Match already completed");
    if (winnerId !== match.homeTeamId && winnerId !== match.awayTeamId) {
      throw new Error("Winner must be one of the match participants");
    }

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

    // Update match with winner
    await prisma.match.update({
      where: { id: matchId },
      data: {
        winnerId,
        status: "COMPLETED",
      },
    });

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

    // Check if tournament is complete (final match)
    if (!match.nextMatchId) {
      await prisma.tournament.update({
        where: { id: match.tournamentId },
        data: { status: "COMPLETED" },
      });
    }
  }

  async getStandings(tournamentId: string): Promise<Standing[]> {
    // Single elimination doesn't have traditional standings
    // Return placement based on which round teams were eliminated
    const matches = await prisma.match.findMany({
      where: { tournamentId, status: "COMPLETED" },
      orderBy: { round: "desc" },
    });

    const placements = new Map<string, number>();

    for (const match of matches) {
      if (!match.winnerId) continue;
      const loserId =
        match.winnerId === match.homeTeamId
          ? match.awayTeamId
          : match.homeTeamId;

      if (loserId && !placements.has(loserId)) {
        // Round they lost in determines placement
        // Higher round = better placement
        placements.set(loserId, match.round);
      }

      // Winner of final match gets rank 1
      if (!match.nextMatchId && !placements.has(match.winnerId)) {
        placements.set(match.winnerId, match.round + 1);
      }
    }

    const standings: Standing[] = [];
    for (const [teamId, roundReached] of placements) {
      standings.push({
        teamId,
        wins: 0,
        losses: 0,
        draws: 0,
        points: roundReached,
        rank: 0,
      });
    }

    standings.sort((a, b) => b.points - a.points);
    standings.forEach((s, i) => (s.rank = i + 1));

    return standings;
  }
}

