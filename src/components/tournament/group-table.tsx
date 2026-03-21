"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface GroupTeam {
  teamId: string;
  wins: number;
  losses: number;
  draws: number;
  points: number;
  seed: number | null;
  team?: { id: string; name: string; tag: string } | null;
}

interface MatchData {
  id: string;
  round: number;
  status: string;
  homeTeam: { id: string; name: string; tag: string } | null;
  awayTeam: { id: string; name: string; tag: string } | null;
  winner: { id: string; name: string; tag: string } | null;
}

interface GroupData {
  id: string;
  name: string;
  teams: GroupTeam[];
  matches: MatchData[];
}

interface GroupTableProps {
  group: GroupData;
  isOrganizer: boolean;
  tournamentId: string;
  onResultSubmitted?: () => void;
}

export function GroupTable({
  group,
  isOrganizer,
  tournamentId,
  onResultSubmitted,
}: GroupTableProps) {
  async function submitWinner(matchId: string, winnerId: string) {
    const res = await fetch(
      `/api/tournaments/${tournamentId}/matches/${matchId}/result`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          winnerId,
          games: [{ gameNumber: 1, winnerId }],
        }),
      }
    );
    if (res.ok) onResultSubmitted?.();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{group.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Standings Table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">#</TableHead>
              <TableHead>Team</TableHead>
              <TableHead className="text-center w-12">W</TableHead>
              <TableHead className="text-center w-12">L</TableHead>
              <TableHead className="text-center w-12">Pts</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {group.teams.map((gt, i) => (
              <TableRow key={gt.teamId}>
                <TableCell className="font-medium">{i + 1}</TableCell>
                <TableCell>
                  {gt.team ? (
                    <span>
                      <span className="text-muted-foreground">[{gt.team.tag}]</span>{" "}
                      {gt.team.name}
                    </span>
                  ) : (
                    "Unknown"
                  )}
                </TableCell>
                <TableCell className="text-center text-green-400">{gt.wins}</TableCell>
                <TableCell className="text-center text-red-400">{gt.losses}</TableCell>
                <TableCell className="text-center font-bold">{gt.points}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Matches */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Matches</p>
          {group.matches.map((match) => (
            <div
              key={match.id}
              className="flex items-center justify-between rounded-lg border p-2 text-sm"
            >
              <div className="flex items-center gap-2 flex-1">
                <span
                  className={`truncate ${
                    match.winner?.id === match.homeTeam?.id ? "font-semibold" : ""
                  }`}
                >
                  {match.homeTeam
                    ? `[${match.homeTeam.tag}] ${match.homeTeam.name}`
                    : "TBD"}
                </span>
                <span className="text-muted-foreground text-xs">vs</span>
                <span
                  className={`truncate ${
                    match.winner?.id === match.awayTeam?.id ? "font-semibold" : ""
                  }`}
                >
                  {match.awayTeam
                    ? `[${match.awayTeam.tag}] ${match.awayTeam.name}`
                    : "TBD"}
                </span>
              </div>

              {match.status === "COMPLETED" ? (
                <Badge
                  variant="outline"
                  className="bg-green-500/15 text-green-400 border-green-500/30"
                >
                  {match.winner?.tag} won
                </Badge>
              ) : isOrganizer && match.homeTeam && match.awayTeam ? (
                <div className="flex gap-1">
                  <button
                    className="rounded px-2 py-1 text-xs bg-primary/10 hover:bg-primary/20 transition-colors"
                    onClick={() => submitWinner(match.id, match.homeTeam!.id)}
                  >
                    {match.homeTeam.tag} wins
                  </button>
                  <button
                    className="rounded px-2 py-1 text-xs bg-primary/10 hover:bg-primary/20 transition-colors"
                    onClick={() => submitWinner(match.id, match.awayTeam!.id)}
                  >
                    {match.awayTeam.tag} wins
                  </button>
                </div>
              ) : (
                <Badge variant="outline">Pending</Badge>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
