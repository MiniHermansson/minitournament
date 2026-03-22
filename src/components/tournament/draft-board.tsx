"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface UserInfo {
  id: string;
  name: string | null;
  image: string | null;
}

interface Captain {
  id: string;
  userId: string;
  teamNumber: number;
  user: UserInfo;
}

interface Pick {
  id: string;
  teamNumber: number;
  pickNumber: number;
  userId: string;
  user: UserInfo;
}

interface PlayerSignup {
  id: string;
  userId: string;
  mainRole: string;
  secondaryRole: string | null;
  wantsCaptain: boolean;
  opGgLink: string | null;
  discordName: string;
  user: UserInfo;
}

interface DraftStateData {
  id: string;
  totalTeams: number;
  currentPick: number;
  nextPick: number;
  nextTeam: number | null;
  currentRound: number | null;
  isComplete: boolean;
  totalPicks: number;
  captains: Captain[];
  picks: Pick[];
}

interface DraftBoardProps {
  draftState: DraftStateData;
  availablePlayers: PlayerSignup[];
  signups: PlayerSignup[];
  tournamentId: string;
  onPickMade: () => void;
  onFinalized: () => void;
}

const ROLE_COLORS: Record<string, string> = {
  TOP: "bg-red-500/15 text-red-400 border-red-500/30",
  JUNGLE: "bg-green-500/15 text-green-400 border-green-500/30",
  MID: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  ADC: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  SUPPORT: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  FILL: "bg-purple-500/15 text-purple-400 border-purple-500/30",
};

export function DraftBoard({
  draftState,
  availablePlayers,
  signups,
  tournamentId,
  onPickMade,
  onFinalized,
}: DraftBoardProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const signupByUser = new Map(signups.map((s) => [s.userId, s]));

  async function handlePick() {
    if (!selectedPlayer) return;
    setPicking(true);

    const res = await fetch(`/api/tournaments/${tournamentId}/draft/pick`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: selectedPlayer }),
    });

    if (res.ok) {
      setSelectedPlayer(null);
      onPickMade();
    } else {
      const data = await res.json();
      toast.error(data.error);
    }
    setPicking(false);
  }

  async function handleFinalize() {
    if (!confirm("Finalize the draft? This will create teams and cannot be undone.")) return;
    setFinalizing(true);

    const res = await fetch(`/api/tournaments/${tournamentId}/draft/finalize`, {
      method: "POST",
    });

    if (res.ok) {
      onFinalized();
    } else {
      const data = await res.json();
      toast.error(data.error);
    }
    setFinalizing(false);
  }

  // Build team rosters
  const teams: { teamNumber: number; captain: Captain; players: Pick[] }[] = [];
  for (let i = 1; i <= draftState.totalTeams; i++) {
    const captain = draftState.captains.find((c) => c.teamNumber === i);
    if (!captain) continue;
    const players = draftState.picks.filter((p) => p.teamNumber === i);
    teams.push({ teamNumber: i, captain, players });
  }

  const currentCaptain = draftState.nextTeam
    ? draftState.captains.find((c) => c.teamNumber === draftState.nextTeam)
    : null;

  const filteredPlayers = availablePlayers.filter((p) => {
    if (roleFilter !== "ALL" && p.mainRole !== roleFilter && p.secondaryRole !== roleFilter) {
      return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        p.user.name?.toLowerCase().includes(q) ||
        p.discordName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Pick indicator */}
      {!draftState.isComplete && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-center">
          <p className="text-sm text-muted-foreground">
            Round {draftState.currentRound} · Pick {draftState.nextPick} of {draftState.totalPicks}
          </p>
          <p className="text-lg font-semibold mt-1">
            Team {draftState.nextTeam}&apos;s turn
            {currentCaptain && (
              <span className="text-muted-foreground font-normal">
                {" "}— Captain: {currentCaptain.user.name}
              </span>
            )}
          </p>
        </div>
      )}

      {draftState.isComplete && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4 text-center">
          <p className="text-lg font-semibold text-green-400">Draft Complete!</p>
          <p className="text-sm text-muted-foreground mt-1">
            All picks are in. Finalize to create the teams.
          </p>
          <Button onClick={handleFinalize} disabled={finalizing} className="mt-3">
            {finalizing ? "Finalizing..." : "Finalize Draft & Create Teams"}
          </Button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Team columns */}
        <div className="lg:col-span-1 space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground">Teams</h3>
          {teams.map((team) => (
            <Card
              key={team.teamNumber}
              className={
                draftState.nextTeam === team.teamNumber
                  ? "border-primary/50"
                  : ""
              }
            >
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm">
                  Team {team.teamNumber}
                  {draftState.nextTeam === team.teamNumber && (
                    <span className="text-primary ml-2 text-xs">← picking</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-2">
                {/* Captain */}
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-xs">
                    C
                  </Badge>
                  <span className="font-medium">{team.captain.user.name}</span>
                  {signupByUser.get(team.captain.userId) && (
                    <Badge variant="outline" className={`text-xs ${ROLE_COLORS[signupByUser.get(team.captain.userId)!.mainRole] ?? ""}`}>
                      {signupByUser.get(team.captain.userId)!.mainRole}
                    </Badge>
                  )}
                </div>
                {/* Drafted players */}
                {team.players.map((pick) => {
                  const signup = signupByUser.get(pick.userId);
                  return (
                    <div key={pick.id} className="flex items-center gap-2 text-sm">
                      <span className="text-xs text-muted-foreground w-5">#{pick.pickNumber}</span>
                      <span>{pick.user.name}</span>
                      {signup && (
                        <Badge variant="outline" className={`text-xs ${ROLE_COLORS[signup.mainRole] ?? ""}`}>
                          {signup.mainRole}
                        </Badge>
                      )}
                    </div>
                  );
                })}
                {/* Empty slots */}
                {Array.from({ length: 4 - team.players.length }).map((_, i) => (
                  <div key={i} className="text-sm text-muted-foreground italic">
                    — empty slot —
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Player pool */}
        <div className="lg:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
            <h3 className="text-sm font-medium text-muted-foreground">
              Available Players ({filteredPlayers.length}/{availablePlayers.length})
            </h3>
            <div className="flex items-center gap-2 sm:ml-auto">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search players..."
                className="h-8 rounded-lg border border-input bg-background px-3 text-xs w-40"
              />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="h-8 rounded-lg border border-input bg-background px-2 text-xs"
              >
                <option value="ALL">All Roles</option>
                <option value="TOP">Top</option>
                <option value="JUNGLE">Jungle</option>
                <option value="MID">Mid</option>
                <option value="ADC">ADC</option>
                <option value="SUPPORT">Support</option>
                <option value="FILL">Fill</option>
              </select>
            </div>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {filteredPlayers.map((player) => (
              <div
                key={player.id}
                className={`flex items-center justify-between rounded-lg border p-3 cursor-pointer transition-colors ${
                  selectedPlayer === player.userId
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/50"
                } ${draftState.isComplete ? "pointer-events-none opacity-50" : ""}`}
                onClick={() => !draftState.isComplete && setSelectedPlayer(
                  selectedPlayer === player.userId ? null : player.userId
                )}
              >
                <div>
                  <p className="text-sm font-medium">
                    {player.user.name}
                    <span className="text-muted-foreground ml-2 text-xs">
                      {player.discordName}
                    </span>
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className={`text-xs ${ROLE_COLORS[player.mainRole] ?? ""}`}>
                      {player.mainRole}
                    </Badge>
                    {player.secondaryRole && (
                      <Badge variant="outline" className="text-xs bg-gray-500/15 text-gray-400 border-gray-500/30">
                        {player.secondaryRole}
                      </Badge>
                    )}
                    {player.opGgLink && (
                      <a
                        href={player.opGgLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        OP.GG
                      </a>
                    )}
                  </div>
                </div>
                {selectedPlayer === player.userId && !draftState.isComplete && (
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePick();
                    }}
                    disabled={picking}
                  >
                    {picking ? "Picking..." : "Pick"}
                  </Button>
                )}
              </div>
            ))}

            {filteredPlayers.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No players available{roleFilter !== "ALL" ? ` for ${roleFilter}` : ""}.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
