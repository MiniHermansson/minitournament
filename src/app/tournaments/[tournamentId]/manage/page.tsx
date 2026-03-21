"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/tournament/status-badge";

interface Registration {
  id: string;
  status: string;
  team: {
    id: string;
    name: string;
    tag: string;
    _count: { members: number };
  };
}

interface PlayerSignup {
  id: string;
  userId: string;
  mainRole: string;
  secondaryRole: string | null;
  wantsCaptain: boolean;
  opGgLink: string | null;
  discordName: string;
  user: { id: string; name: string | null; image: string | null };
}

interface TournamentData {
  id: string;
  name: string;
  status: string;
  format: string;
  teamMode: string;
  organizerId: string;
  maxTeams: number;
  registrations: Registration[];
  playerSignups: PlayerSignup[];
}

const statusTransitions: Record<string, { label: string; next: string }[]> = {
  DRAFT: [{ label: "Open Registration", next: "REGISTRATION" }],
  REGISTRATION: [{ label: "Back to Draft", next: "DRAFT" }],
  DRAFTING: [{ label: "Back to Registration", next: "REGISTRATION" }],
  IN_PROGRESS: [{ label: "Complete Tournament", next: "COMPLETED" }],
  COMPLETED: [],
  CANCELLED: [{ label: "Reopen as Draft", next: "DRAFT" }],
};

export default function ManageTournamentPage() {
  const params = useParams<{ tournamentId: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const [tournament, setTournament] = useState<TournamentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Format config state (for captains draft — configured after draft)
  const [bestOf, setBestOf] = useState("1");
  const [groupCount, setGroupCount] = useState(4);
  const [advancingPerGroup, setAdvancingPerGroup] = useState(2);
  const [playoffBestOf, setPlayoffBestOf] = useState("1");

  const fetchTournament = useCallback(async () => {
    const res = await fetch(`/api/tournaments/${params.tournamentId}`);
    if (!res.ok) {
      router.push("/tournaments");
      return;
    }
    const data = await res.json();
    if (data.tournament.organizerId !== session?.user?.id) {
      router.push(`/tournaments/${params.tournamentId}`);
      return;
    }
    setTournament(data.tournament);
    setLoading(false);
  }, [params.tournamentId, session?.user?.id, router]);

  useEffect(() => {
    if (session) fetchTournament();
  }, [session, fetchTournament]);

  async function handleStatusChange(newStatus: string) {
    const res = await fetch(`/api/tournaments/${params.tournamentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) fetchTournament();
  }

  async function handleGenerateBracket() {
    setGenerating(true);

    // For captains draft, save format config first
    if (tournament?.teamMode === "CAPTAINS_DRAFT") {
      const config: Record<string, unknown> = { bestOf: Number(bestOf) };
      const fmt = tournament.format;
      if (fmt === "ROUND_ROBIN" || fmt === "GROUP_STAGE" || fmt === "GROUP_STAGE_PLAYOFF") {
        config.pointsForWin = 3;
        config.pointsForDraw = 1;
      }
      if (fmt === "GROUP_STAGE" || fmt === "GROUP_STAGE_PLAYOFF") {
        config.groupCount = groupCount;
      }
      if (fmt === "GROUP_STAGE_PLAYOFF") {
        config.advancingPerGroup = advancingPerGroup;
        config.playoffBestOf = Number(playoffBestOf);
      }

      await fetch(`/api/tournaments/${params.tournamentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formatConfig: config }),
      });
    }

    const res = await fetch(
      `/api/tournaments/${params.tournamentId}/bracket`,
      { method: "POST" }
    );
    if (res.ok) {
      router.push(`/tournaments/${params.tournamentId}/bracket`);
    } else {
      const data = await res.json();
      alert(data.error);
    }
    setGenerating(false);
  }

  async function handleRegistration(registrationId: string, status: "ACCEPTED" | "REJECTED") {
    const res = await fetch(
      `/api/tournaments/${params.tournamentId}/register`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId, status }),
      }
    );
    if (res.ok) fetchTournament();
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!tournament) return null;

  const isCaptainsDraft = tournament.teamMode === "CAPTAINS_DRAFT";
  const transitions = statusTransitions[tournament.status] ?? [];
  const acceptedTeams = tournament.registrations.filter((r) => r.status === "ACCEPTED").length;

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-1">{tournament.name}</h1>
          <div className="flex gap-2">
            <StatusBadge status={tournament.status} />
            {isCaptainsDraft && (
              <Badge variant="outline" className="bg-purple-500/15 text-purple-400 border-purple-500/30">
                Captains Draft
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Status transitions */}
      {transitions.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Tournament Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 flex-wrap">
              {transitions.map((t) => (
                <Button
                  key={t.next}
                  variant={t.next === "CANCELLED" ? "destructive" : "default"}
                  onClick={() => handleStatusChange(t.next)}
                >
                  {t.label}
                </Button>
              ))}
              {tournament.status !== "CANCELLED" && tournament.status !== "COMPLETED" && (
                <Button
                  variant="destructive"
                  onClick={() => handleStatusChange("CANCELLED")}
                >
                  Cancel Tournament
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Captains Draft: Start Draft button */}
      {isCaptainsDraft && tournament.status === "REGISTRATION" && (
        <Card className="mb-6 border-primary/30">
          <CardHeader>
            <CardTitle>Captains Draft</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {tournament.playerSignups.length} players signed up.
              {tournament.playerSignups.length < 10
                ? " You need at least 10 players to form 2 teams."
                : ` You can form ${Math.floor(tournament.playerSignups.length / 5)} teams.`}
            </p>
            <Link href={`/tournaments/${params.tournamentId}/draft`}>
              <Button disabled={tournament.playerSignups.length < 10}>
                Start Draft
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Captains Draft: Link to draft board when DRAFTING */}
      {isCaptainsDraft && tournament.status === "DRAFTING" && (
        <Card className="mb-6 border-primary/30">
          <CardHeader>
            <CardTitle>Draft in Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href={`/tournaments/${params.tournamentId}/draft`}>
              <Button>Go to Draft Board</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Pre-made teams: Generate bracket */}
      {!isCaptainsDraft && tournament.status === "REGISTRATION" && (
        <Card className="mb-6 border-primary/30">
          <CardHeader>
            <CardTitle>Start Tournament</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Generate the bracket/schedule and start the tournament.
              {acceptedTeams < 2 ? " You need at least 2 accepted teams." : ""}
            </p>
            <Button
              onClick={handleGenerateBracket}
              disabled={generating || acceptedTeams < 2}
            >
              {generating ? "Generating..." : "Generate Bracket & Start"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Generate bracket after draft is finalized (teams have been created) */}
      {isCaptainsDraft && tournament.status === "REGISTRATION" && acceptedTeams >= 2 && (
        <Card className="mb-6 border-green-500/30">
          <CardHeader>
            <CardTitle>Draft Complete — Configure & Start</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {acceptedTeams} teams created from the draft. Configure match settings, then generate the bracket.
            </p>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="best-of">Best Of</Label>
                <select
                  id="best-of"
                  value={bestOf}
                  onChange={(e) => setBestOf(e.target.value)}
                  className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option value="1">Best of 1</option>
                  <option value="3">Best of 3</option>
                  <option value="5">Best of 5</option>
                </select>
              </div>

              {(tournament.format === "GROUP_STAGE" || tournament.format === "GROUP_STAGE_PLAYOFF") && (
                <div className="space-y-2">
                  <Label htmlFor="group-count">Number of Groups</Label>
                  <Input
                    id="group-count"
                    type="number"
                    min={2}
                    max={Math.floor(acceptedTeams / 2)}
                    value={groupCount}
                    onChange={(e) => setGroupCount(Number(e.target.value))}
                  />
                </div>
              )}

              {tournament.format === "GROUP_STAGE_PLAYOFF" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="advancing">Teams Advancing Per Group</Label>
                    <Input
                      id="advancing"
                      type="number"
                      min={1}
                      max={8}
                      value={advancingPerGroup}
                      onChange={(e) => setAdvancingPerGroup(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="playoff-bo">Playoff Best Of</Label>
                    <select
                      id="playoff-bo"
                      value={playoffBestOf}
                      onChange={(e) => setPlayoffBestOf(e.target.value)}
                      className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                    >
                      <option value="1">Best of 1</option>
                      <option value="3">Best of 3</option>
                      <option value="5">Best of 5</option>
                    </select>
                  </div>
                </>
              )}
            </div>

            <Button onClick={handleGenerateBracket} disabled={generating}>
              {generating ? "Generating..." : "Generate Bracket & Start"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Player signups list (captains draft) */}
      {isCaptainsDraft && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>
              Player Signups ({tournament.playerSignups.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tournament.playerSignups.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No players signed up yet.
              </p>
            ) : (
              <div className="space-y-3">
                {tournament.playerSignups.map((signup) => (
                  <div
                    key={signup.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {signup.user.name ?? "Unknown"}
                        <span className="text-muted-foreground ml-2 text-xs">
                          {signup.discordName}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {signup.mainRole}
                        {signup.secondaryRole ? ` / ${signup.secondaryRole}` : ""}
                        {signup.opGgLink && (
                          <>
                            {" · "}
                            <a
                              href={signup.opGgLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              OP.GG
                            </a>
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {signup.wantsCaptain && (
                        <Badge
                          variant="outline"
                          className="bg-amber-500/15 text-amber-400 border-amber-500/30"
                        >
                          Captain
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Team registrations (pre-made) */}
      {!isCaptainsDraft && (
        <Card>
          <CardHeader>
            <CardTitle>
              Registrations ({tournament.registrations.length}/{tournament.maxTeams})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tournament.registrations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No registrations yet.
              </p>
            ) : (
              <div className="space-y-3">
                {tournament.registrations.map((reg) => (
                  <div
                    key={reg.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-sm font-medium">
                          {reg.team.name}{" "}
                          <span className="text-muted-foreground">
                            [{reg.team.tag}]
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {reg.team._count.members} members
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={
                          reg.status === "ACCEPTED"
                            ? "bg-green-500/15 text-green-400 border-green-500/30"
                            : reg.status === "REJECTED"
                            ? "bg-red-500/15 text-red-400 border-red-500/30"
                            : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                        }
                      >
                        {reg.status}
                      </Badge>
                      {reg.status === "PENDING" && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleRegistration(reg.id, "ACCEPTED")}
                          >
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleRegistration(reg.id, "REJECTED")}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
