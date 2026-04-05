"use client";

import { useRouter } from "next/navigation";

interface Team {
  id: string;
  name: string;
  tag: string;
}

interface Match {
  id: string;
  round: number;
  position: number;
  bestOf: number;
  status: string;
  homeTeam: Team | null;
  awayTeam: Team | null;
  winner: Team | null;
  games: { gameNumber: number; winnerId: string | null }[];
  nextMatchId: string | null;
}

interface Bracket {
  id: string;
  type: string;
  rounds: number;
  matches: Match[];
}

interface BracketViewProps {
  brackets: Bracket[];
  isOrganizer: boolean;
  tournamentId: string;
}

export function BracketView({
  brackets,
  isOrganizer,
  tournamentId,
}: BracketViewProps) {
  const router = useRouter();
  const onResultSubmitted = () => router.refresh();

  const winnersBracket = brackets.find((b) => b.type === "WINNERS");
  const losersBracket = brackets.find((b) => b.type === "LOSERS");
  const grandFinal = brackets.find((b) => b.type === "GRAND_FINAL");

  return (
    <div className="space-y-8">
      {winnersBracket && (
        <div>
          <h3 className="text-lg font-semibold mb-4">
            {losersBracket ? "Winners Bracket" : "Bracket"}
          </h3>
          <BracketGrid
            bracket={winnersBracket}
            isOrganizer={isOrganizer}
            tournamentId={tournamentId}
            onResultSubmitted={onResultSubmitted}
          />
        </div>
      )}

      {losersBracket && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Losers Bracket</h3>
          <BracketGrid
            bracket={losersBracket}
            isOrganizer={isOrganizer}
            tournamentId={tournamentId}
            onResultSubmitted={onResultSubmitted}
          />
        </div>
      )}

      {grandFinal && grandFinal.matches.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Grand Final</h3>
          <div className="flex justify-center">
            <MatchCard
              match={grandFinal.matches[0]}
              isOrganizer={isOrganizer}
              tournamentId={tournamentId}
              onResultSubmitted={onResultSubmitted}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function BracketGrid({
  bracket,
  isOrganizer,
  tournamentId,
  onResultSubmitted,
}: {
  bracket: Bracket;
  isOrganizer: boolean;
  tournamentId: string;
  onResultSubmitted?: () => void;
}) {
  // Group matches by round
  const rounds: Match[][] = [];
  for (let r = 1; r <= bracket.rounds; r++) {
    rounds.push(
      bracket.matches
        .filter((m) => m.round === r)
        .sort((a, b) => a.position - b.position)
    );
  }

  const roundLabels = rounds.map((_, i) => {
    if (i === rounds.length - 1) return "Final";
    if (i === rounds.length - 2) return "Semi-Final";
    if (i === rounds.length - 3) return "Quarter-Final";
    return `Round ${i + 1}`;
  });

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-6 min-w-max py-2">
        {rounds.map((roundMatches, roundIndex) => (
          <div key={roundIndex} className="flex flex-col">
            <p className="text-xs text-muted-foreground mb-3 text-center font-medium">
              {roundLabels[roundIndex]}
            </p>
            <div
              className="flex flex-col gap-4 justify-around flex-1"
              style={{ minWidth: "220px" }}
            >
              {roundMatches.map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  isOrganizer={isOrganizer}
                  tournamentId={tournamentId}
                  onResultSubmitted={onResultSubmitted}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MatchCard({
  match,
  isOrganizer,
  tournamentId,
  onResultSubmitted,
}: {
  match: Match;
  isOrganizer: boolean;
  tournamentId: string;
  onResultSubmitted?: () => void;
}) {
  const canSubmitResult =
    isOrganizer &&
    match.status !== "COMPLETED" &&
    match.homeTeam &&
    match.awayTeam;

  async function submitWinner(winnerId: string) {
    const games = [{ gameNumber: 1, winnerId }];

    const res = await fetch(
      `/api/tournament/matches/${match.id}/result`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winnerId, games }),
      }
    );

    if (res.ok) {
      onResultSubmitted?.();
    }
  }

  return (
    <div
      className={`rounded-lg border text-sm ${
        match.status === "COMPLETED"
          ? "border-border bg-card"
          : match.homeTeam && match.awayTeam
          ? "border-primary/30 bg-card"
          : "border-border/50 bg-muted/30"
      }`}
      style={{ width: "220px" }}
    >
      <TeamSlot
        team={match.homeTeam}
        isWinner={match.winner?.id === match.homeTeam?.id}
        canSelect={!!canSubmitResult}
        onSelect={() => match.homeTeam && submitWinner(match.homeTeam.id)}
        gameWins={
          match.games.filter((g) => g.winnerId === match.homeTeam?.id).length
        }
      />
      <div className="border-t border-border/50" />
      <TeamSlot
        team={match.awayTeam}
        isWinner={match.winner?.id === match.awayTeam?.id}
        canSelect={!!canSubmitResult}
        onSelect={() => match.awayTeam && submitWinner(match.awayTeam.id)}
        gameWins={
          match.games.filter((g) => g.winnerId === match.awayTeam?.id).length
        }
      />
    </div>
  );
}

function TeamSlot({
  team,
  isWinner,
  canSelect,
  onSelect,
  gameWins,
}: {
  team: Team | null;
  isWinner: boolean;
  canSelect: boolean;
  onSelect: () => void;
  gameWins: number;
}) {
  return (
    <div
      className={`flex items-center justify-between px-3 py-2 ${
        isWinner ? "bg-primary/10 font-semibold" : ""
      } ${canSelect ? "cursor-pointer hover:bg-muted/50" : ""}`}
      onClick={canSelect ? onSelect : undefined}
    >
      <span className={`truncate ${!team ? "text-muted-foreground italic" : ""}`}>
        {team ? `[${team.tag}] ${team.name}` : "TBD"}
      </span>
      {team && gameWins > 0 && (
        <span className="ml-2 text-xs font-bold text-muted-foreground">
          {gameWins}
        </span>
      )}
    </div>
  );
}
