"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
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

const ROLE_COLORS: Record<string, string> = {
  TOP: "bg-red-500/15 text-red-400 border-red-500/30",
  JUNGLE: "bg-green-500/15 text-green-400 border-green-500/30",
  MID: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  ADC: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  SUPPORT: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  FILL: "bg-purple-500/15 text-purple-400 border-purple-500/30",
};

export default function DraftPage() {
  const params = useParams<{ tournamentId: string }>();
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

  const fetchDraft = useCallback(async () => {
    const res = await fetch(`/api/tournaments/${params.tournamentId}/draft`);
    if (!res.ok) return;
    const data = await res.json();
    setDraftData(data);
    if (data.signups) setSignups(data.signups);
    if (!data.draftState && data.signups) {
      setTeamCount(Math.floor(data.signups.length / 5));
    }
    setLoading(false);
  }, [params.tournamentId]);

  useEffect(() => {
    if (session) fetchDraft();
  }, [session, fetchDraft]);

  function toggleCaptain(userId: string, teamNumber: number) {
    const newMap = new Map(captainAssignments);
    // Check if this user is already assigned
    for (const [tn, uid] of newMap) {
      if (uid === userId) {
        newMap.delete(tn);
        if (tn === teamNumber) {
          setCaptainAssignments(newMap);
          return;
        }
      }
    }
    // Check if this team slot is already taken
    if (newMap.has(teamNumber)) {
      newMap.delete(teamNumber);
    }
    newMap.set(teamNumber, userId);
    setCaptainAssignments(newMap);
  }

  async function startDraft() {
    if (captainAssignments.size !== teamCount) {
      alert(`Please assign all ${teamCount} captains.`);
      return;
    }
    setStarting(true);

    const captains = Array.from(captainAssignments.entries()).map(
      ([teamNumber, userId]) => ({ userId, teamNumber })
    );

    const res = await fetch(`/api/tournaments/${params.tournamentId}/draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ captains }),
    });

    if (res.ok) {
      fetchDraft();
    } else {
      const data = await res.json();
      alert(data.error);
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
          tournamentId={params.tournamentId}
          onPickMade={fetchDraft}
          onFinalized={() => router.push(`/tournaments/${params.tournamentId}/manage`)}
        />
      </div>
    );
  }

  // Draft not started — captain assignment phase
  const wantsCaptainPlayers = signups.filter((s) => s.wantsCaptain);
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
              // Find which team this player is assigned to
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
                        <Badge variant="outline" className={`text-xs ${ROLE_COLORS[signup.secondaryRole] ?? ""}`}>
                          {signup.secondaryRole}
                        </Badge>
                      )}
                      {signup.wantsCaptain && (
                        <Badge variant="outline" className="text-xs bg-amber-500/15 text-amber-400 border-amber-500/30">
                          Wants Captain
                        </Badge>
                      )}
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
                    </div>
                  </div>
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
