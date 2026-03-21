"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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

interface TournamentData {
  id: string;
  name: string;
  status: string;
  format: string;
  organizerId: string;
  maxTeams: number;
  registrations: Registration[];
}

const statusTransitions: Record<string, { label: string; next: string }[]> = {
  DRAFT: [{ label: "Open Registration", next: "REGISTRATION" }],
  REGISTRATION: [
    { label: "Back to Draft", next: "DRAFT" },
  ],
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

  const transitions = statusTransitions[tournament.status] ?? [];

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-1">{tournament.name}</h1>
          <StatusBadge status={tournament.status} />
        </div>
      </div>

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

      {tournament.status === "REGISTRATION" && (
        <Card className="mb-6 border-primary/30">
          <CardHeader>
            <CardTitle>Start Tournament</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Generate the bracket/schedule and start the tournament.
              {tournament.registrations.filter((r: Registration) => r.status === "ACCEPTED").length < 2
                ? " You need at least 2 accepted teams."
                : ""}
            </p>
            <Button
              onClick={handleGenerateBracket}
              disabled={
                generating ||
                tournament.registrations.filter((r: Registration) => r.status === "ACCEPTED").length < 2
              }
            >
              {generating ? "Generating..." : "Generate Bracket & Start"}
            </Button>
          </CardContent>
        </Card>
      )}

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
    </div>
  );
}
