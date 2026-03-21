import { prisma } from "@/lib/prisma";
import { nextPowerOf2, generateBracketSeeding } from "@/lib/tournament-utils";
import type { TournamentEngine, GenerateOptions, SubmitResultOptions, Standing } from "./types";

export class DoubleEliminationEngine implements TournamentEngine {
  async generate({ tournamentId, teams, formatConfig }: GenerateOptions): Promise<void> {
    const bestOf = (formatConfig.bestOf as number) || 1;
    const numTeams = teams.length;

    if (numTeams < 2) throw new Error("Need at least 2 teams");

    const bracketSize = nextPowerOf2(numTeams);
    const winnersRounds = Math.log2(bracketSize);
    // Losers bracket has (winnersRounds - 1) * 2 rounds
    const losersRounds = (winnersRounds - 1) * 2;

    const sorted = [...teams].sort((a, b) => a.seed - b.seed);

    // Create winners bracket
    const winnersBracket = await prisma.bracket.create({
      data: { tournamentId, type: "WINNERS", rounds: winnersRounds },
    });

    // Create losers bracket
    const losersBracket = await prisma.bracket.create({
      data: { tournamentId, type: "LOSERS", rounds: losersRounds },
    });

    // Create grand final bracket
    const grandFinalBracket = await prisma.bracket.create({
      data: { tournamentId, type: "GRAND_FINAL", rounds: 1 },
    });

    // Generate winners bracket matches
    const winnersMatchesByRound: string[][] = [];
    for (let round = 1; round <= winnersRounds; round++) {
      const matchesInRound = bracketSize / Math.pow(2, round);
      const roundMatches: string[] = [];
      for (let pos = 0; pos < matchesInRound; pos++) {
        const match = await prisma.match.create({
          data: {
            tournamentId,
            bracketId: winnersBracket.id,
            round,
            position: pos,
            bestOf,
            status: "PENDING",
          },
        });
        roundMatches.push(match.id);
      }
      winnersMatchesByRound.push(roundMatches);
    }

    // Wire winners bracket progression
    for (let round = 0; round < winnersRounds - 1; round++) {
      const current = winnersMatchesByRound[round];
      const next = winnersMatchesByRound[round + 1];
      for (let i = 0; i < current.length; i++) {
        await prisma.match.update({
          where: { id: current[i] },
          data: {
            nextMatchId: next[Math.floor(i / 2)],
            nextMatchPosition: i % 2 === 0 ? "home" : "away",
          },
        });
      }
    }

    // Generate losers bracket matches
    const losersMatchesByRound: string[][] = [];
    for (let round = 1; round <= losersRounds; round++) {
      // Losers bracket structure:
      // Odd rounds: teams from winners bracket drop in (fewer matches)
      // Even rounds: normal progression (same number of matches as previous)
      let matchesInRound: number;
      if (round <= 2) {
        matchesInRound = bracketSize / 4;
      } else {
        const prevMatches = losersMatchesByRound[losersMatchesByRound.length - 1].length;
        matchesInRound = round % 2 === 1 ? prevMatches : Math.ceil(prevMatches / 2);
      }

      // Ensure at least 1 match
      matchesInRound = Math.max(1, matchesInRound);

      const roundMatches: string[] = [];
      for (let pos = 0; pos < matchesInRound; pos++) {
        const match = await prisma.match.create({
          data: {
            tournamentId,
            bracketId: losersBracket.id,
            round,
            position: pos,
            bestOf,
            status: "PENDING",
          },
        });
        roundMatches.push(match.id);
      }
      losersMatchesByRound.push(roundMatches);
    }

    // Wire losers bracket progression
    for (let round = 0; round < losersRounds - 1; round++) {
      const current = losersMatchesByRound[round];
      const next = losersMatchesByRound[round + 1];
      for (let i = 0; i < current.length; i++) {
        const nextIndex = Math.min(Math.floor(i / 2), next.length - 1);
        const position = next.length < current.length ? (i % 2 === 0 ? "home" : "away") : "home";
        await prisma.match.update({
          where: { id: current[i] },
          data: {
            nextMatchId: next[nextIndex],
            nextMatchPosition: position,
          },
        });
      }
    }

    // Create grand final match
    const grandFinal = await prisma.match.create({
      data: {
        tournamentId,
        bracketId: grandFinalBracket.id,
        round: 1,
        position: 0,
        bestOf,
        status: "PENDING",
      },
    });

    // Wire winners bracket final → grand final (home)
    if (winnersMatchesByRound.length > 0) {
      const winnersFinal = winnersMatchesByRound[winnersMatchesByRound.length - 1][0];
      await prisma.match.update({
        where: { id: winnersFinal },
        data: { nextMatchId: grandFinal.id, nextMatchPosition: "home" },
      });
    }

    // Wire losers bracket final → grand final (away)
    if (losersMatchesByRound.length > 0) {
      const losersFinal = losersMatchesByRound[losersMatchesByRound.length - 1][0];
      await prisma.match.update({
        where: { id: losersFinal },
        data: { nextMatchId: grandFinal.id, nextMatchPosition: "away" },
      });
    }

    // Place teams into round 1 of winners bracket
    const positions = generateBracketSeeding(bracketSize);
    const round1 = winnersMatchesByRound[0];

    for (let i = 0; i < bracketSize; i += 2) {
      const matchIndex = i / 2;
      const homePos = positions[i];
      const awayPos = positions[i + 1];

      const homeTeam = homePos <= numTeams ? sorted[homePos - 1] : null;
      const awayTeam = awayPos <= numTeams ? sorted[awayPos - 1] : null;

      await prisma.match.update({
        where: { id: round1[matchIndex] },
        data: {
          homeTeamId: homeTeam?.teamId ?? null,
          awayTeamId: awayTeam?.teamId ?? null,
        },
      });

      // Handle byes
      if (homeTeam && !awayTeam) {
        await this.handleMatchResult(round1[matchIndex], homeTeam.teamId, true);
      } else if (!homeTeam && awayTeam) {
        await this.handleMatchResult(round1[matchIndex], awayTeam.teamId, true);
      }
    }
  }

  private async handleMatchResult(
    matchId: string,
    winnerId: string,
    isBye: boolean = false
  ): Promise<void> {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: { bracket: true },
    });
    if (!match) return;

    await prisma.match.update({
      where: { id: matchId },
      data: { winnerId, status: "COMPLETED" },
    });

    // Advance winner
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

    // If this is a winners bracket match, send loser to losers bracket
    if (match.bracket?.type === "WINNERS" && !isBye) {
      const loserId = winnerId === match.homeTeamId ? match.awayTeamId : match.homeTeamId;
      if (loserId) {
        // Find the corresponding losers bracket match for this round
        const losersMatch = await prisma.match.findFirst({
          where: {
            tournamentId: match.tournamentId,
            bracket: { type: "LOSERS" },
            awayTeamId: null,
            status: "PENDING",
          },
          orderBy: [{ round: "asc" }, { position: "asc" }],
        });

        if (losersMatch) {
          await prisma.match.update({
            where: { id: losersMatch.id },
            data: { awayTeamId: loserId },
          });
        }
      }
    }
  }

  async submitResult({ matchId, winnerId, games }: SubmitResultOptions): Promise<void> {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: { bracket: true },
    });

    if (!match) throw new Error("Match not found");
    if (match.status === "COMPLETED") throw new Error("Match already completed");
    if (winnerId !== match.homeTeamId && winnerId !== match.awayTeamId) {
      throw new Error("Winner must be one of the match participants");
    }

    // Create game records
    for (const game of games) {
      await prisma.game.create({
        data: { matchId, gameNumber: game.gameNumber, winnerId: game.winnerId },
      });
    }

    await this.handleMatchResult(matchId, winnerId);

    // Check if grand final is complete
    if (match.bracket?.type === "GRAND_FINAL" || !match.nextMatchId) {
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
  }

  async getStandings(tournamentId: string): Promise<Standing[]> {
    const matches = await prisma.match.findMany({
      where: { tournamentId, status: "COMPLETED" },
      include: { bracket: true },
      orderBy: { round: "desc" },
    });

    const placements = new Map<string, { round: number; bracketType: string }>();

    for (const match of matches) {
      if (!match.winnerId || !match.bracket) continue;
      const loserId = match.winnerId === match.homeTeamId ? match.awayTeamId : match.homeTeamId;

      if (loserId && !placements.has(loserId)) {
        placements.set(loserId, {
          round: match.round,
          bracketType: match.bracket.type,
        });
      }

      // Grand final winner
      if (match.bracket.type === "GRAND_FINAL" && !placements.has(match.winnerId)) {
        placements.set(match.winnerId, { round: 999, bracketType: "GRAND_FINAL" });
      }
    }

    const standings: Standing[] = [];
    for (const [teamId, info] of placements) {
      let score = info.round;
      if (info.bracketType === "GRAND_FINAL") score = 999;
      else if (info.bracketType === "WINNERS") score += 100;
      // Losers bracket = raw round number (lower placement)

      standings.push({
        teamId,
        wins: 0,
        losses: 0,
        draws: 0,
        points: score,
        rank: 0,
      });
    }

    standings.sort((a, b) => b.points - a.points);
    standings.forEach((s, i) => (s.rank = i + 1));

    return standings;
  }
}

