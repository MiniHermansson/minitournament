"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DraftBoard } from "@/components/tournament/draft-board";

interface UserInfo {
  id: string;
  name: string | null;
  image: string | null;
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

interface RankInfo {
  tier: string | null;
  rank: string | null;
  lp: number | null;
  wins: number | null;
  losses: number | null;
}

const ROLE_COLORS: Record<string, string> = {
  TOP: "bg-red-500/15 text-red-400 border-red-500/30",
  JUNGLE: "bg-green-500/15 text-green-400 border-green-500/30",
  MID: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  ADC: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  SUPPORT: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  FILL: "bg-purple-500/15 text-purple-400 border-purple-500/30",
};

const TIER_COLORS: Record<string, string> = {
  IRON: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  BRONZE: "bg-amber-700/15 text-amber-600 border-amber-700/30",
  SILVER: "bg-slate-300/15 text-slate-300 border-slate-300/30",
  GOLD: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  PLATINUM: "bg-cyan-400/15 text-cyan-300 border-cyan-400/30",
  EMERALD: "bg-green-400/15 text-green-300 border-green-400/30",
  DIAMOND: "bg-blue-400/15 text-blue-300 border-blue-400/30",
  MASTER: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  GRANDMASTER: "bg-red-500/15 text-red-400 border-red-500/30",
  CHALLENGER: "bg-amber-400/15 text-amber-300 border-amber-400/30",
};

function RankBadge({ rank }: { rank: RankInfo | null | undefined }) {
  if (!rank || !rank.tier) return null;
  const colors = TIER_COLORS[rank.tier] ?? "bg-gray-500/15 text-gray-400 border-gray-500/30";
  const label = `${rank.tier[0]}${rank.tier.slice(1).toLowerCase()} ${rank.rank ?? ""}`.trim();
  return (
    <Badge variant="outline" className={`text-xs ${colors}`} title={rank.lp != null ? `${rank.lp} LP · ${rank.wins}W ${rank.losses}L` : undefined}>
      {label}{rank.lp != null ? ` ${rank.lp}LP` : ""}
    </Badge>
  );
}

export default function DraftPage() {
  const router = useRouter();
  const { data: session } = useSession();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [draftData, setDraftData] = useState<any>(null);
  const [signups, setSignups] = useState<PlayerSignup[]>([]);
  const [loading, setLoading] = useState(true);

  // Captain assignment state
  const [captainAssignments, setCaptainAssignments] = useState<
    Map<number, string>
  >(new Map());
  const [teamCount, setTeamCount] = useState(2);
  const [starting, setStarting] = useState(false);
  const [ranks, setRanks] = useState<Record<string, RankInfo | null>>({});

  const fetchRanks = useCallback(async (playerSignups: PlayerSignup[]) => {
    const userIds = playerSignups.map((s) => s.userId);
    if (userIds.length === 0) return;

    try {
      const res = await fetch("/api/tournament/ranks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds }),
      });
      if (!res.ok) {
        console.error("[ranks] API error:", res.status, await res.text().catch(() => ""));
        return;
      }
      const data = await res.json();
      if (data.ranks) setRanks(data.ranks);
    } catch (err) {
      console.error("[ranks] Fetch error:", err);
    }
  }, []);

  const fetchDraft = useCallback(async () => {
    const res = await fetch("/api/tournament/draft");
    if (!res.ok) return;
    const data = await res.json();
    setDraftData(data);
    if (data.signups) {
      setSignups(data.signups);
      fetchRanks(data.signups);
    }
    if (!data.draftState && data.signups) {
      setTeamCount(Math.floor(data.signups.length / 5));
    }
    setLoading(false);
  }, [fetchRanks]);

  useEffect(() => {
    if (session) fetchDraft();
  }, [session, fetchDraft]);

  function toggleCaptain(userId: string, teamNumber: number) {
    const newMap = new Map(captainAssignments);
    for (const [tn, uid] of newMap) {
      if (uid === userId) {
        newMap.delete(tn);
        if (tn === teamNumber) {
          setCaptainAssignments(newMap);
          return;
        }
      }
    }
    if (newMap.has(teamNumber)) {
      newMap.delete(teamNumber);
    }
    newMap.set(teamNumber, userId);
    setCaptainAssignments(newMap);
  }

  async function startDraft() {
    if (captainAssignments.size !== teamCount) {
      toast.error(`Please assign all ${teamCount} captains.`);
      return;
    }
    setStarting(true);

    const captains = Array.from(captainAssignments.entries()).map(
      ([teamNumber, userId]) => ({ userId, teamNumber })
    );

    const res = await fetch("/api/tournament/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ captains }),
    });

    if (res.ok) {
      fetchDraft();
    } else {
      const data = await res.json();
      toast.error(data.error);
    }
    setStarting(false);
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse h-64 bg-muted rounded" />
      </div>
    );
  }

  // Draft is active — show draft board
  if (draftData?.draftState) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">Captains Draft</h1>
        <p className="text-muted-foreground mb-6">
          Pick players for each team in snake draft order.
        </p>
        <DraftBoard
          draftState={draftData.draftState}
          availablePlayers={draftData.availablePlayers}
          signups={draftData.signups}
          tournamentId={draftData.draftState.tournamentId}
          onPickMade={fetchDraft}
          onFinalized={() => router.push("/manage")}
        />
      </div>
    );
  }

  // Draft not started — captain assignment phase
  const maxTeams = Math.floor(signups.length / 5);

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-3xl font-bold mb-2">Captain Assignment</h1>
      <p className="text-muted-foreground mb-6">
        {signups.length} players signed up. Assign captains to team slots, then start the draft.
      </p>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-sm">Number of Teams</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <select
              value={teamCount}
              onChange={(e) => {
                setTeamCount(Number(e.target.value));
                setCaptainAssignments(new Map());
              }}
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
            >
              {Array.from({ length: maxTeams - 1 }, (_, i) => i + 2).map((n) => (
                <option key={n} value={n}>
                  {n} teams ({n * 5} players drafted, {signups.length - n * 5 - n} subs)
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-sm">
            Assign Captains ({captainAssignments.size}/{teamCount})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-4">
            Players who requested to be captain are highlighted. Click a team slot to assign.
          </p>
          <div className="space-y-3">
            {signups.map((signup) => {
              let assignedTeam: number | null = null;
              for (const [tn, uid] of captainAssignments) {
                if (uid === signup.userId) {
                  assignedTeam = tn;
                  break;
                }
              }

              return (
                <div
                  key={signup.id}
                  className={`flex items-center justify-between rounded-lg border p-3 ${
                    signup.wantsCaptain ? "border-amber-500/30" : ""
                  } ${assignedTeam ? "bg-primary/5 border-primary/30" : ""}`}
                >
                  <div>
                    <p className="text-sm font-medium">
                      {signup.user.name}
                      <span className="text-muted-foreground ml-2 text-xs">
                        {signup.discordName}
                      </span>
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className={`text-xs ${ROLE_COLORS[signup.mainRole] ?? ""}`}>
                        {signup.mainRole}
                      </Badge>
                      {signup.secondaryRole && (
                        <Badge variant="outline" className="text-xs bg-gray-500/15 text-gray-400 border-gray-500/30">
                          {signup.secondaryRole}
                        </Badge>
                      )}
                      {signup.wantsCaptain && (
                        <Badge variant="outline" className="text-xs bg-amber-500/15 text-amber-400 border-amber-500/30">
                          Wants Captain
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <RankBadge rank={ranks[signup.userId]} />
                    {signup.opGgLink && (
                      <a
                        href={signup.opGgLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        OP.GG
                      </a>
                    )}
                    <div className="flex gap-1">
                    {Array.from({ length: teamCount }, (_, i) => i + 1).map((tn) => {
                      const isAssigned = assignedTeam === tn;
                      const slotTaken = captainAssignments.has(tn) && captainAssignments.get(tn) !== signup.userId;
                      return (
                        <button
                          key={tn}
                          className={`rounded px-2 py-1 text-xs transition-colors ${
                            isAssigned
                              ? "bg-primary text-primary-foreground"
                              : slotTaken
                              ? "bg-muted/30 text-muted-foreground cursor-not-allowed"
                              : "bg-muted/50 hover:bg-primary/20"
                          }`}
                          onClick={() => !slotTaken && toggleCaptain(signup.userId, tn)}
                          disabled={slotTaken}
                        >
                          T{tn}
                        </button>
                      );
                    })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Button
        onClick={startDraft}
        disabled={starting || captainAssignments.size !== teamCount}
        className="w-full"
      >
        {starting ? "Starting Draft..." : `Start Draft (${captainAssignments.size}/${teamCount} captains assigned)`}
      </Button>
    </div>
  );
}
