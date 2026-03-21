"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { GroupTable } from "@/components/tournament/group-table";
import { Button } from "@/components/ui/button";

interface TournamentInfo {
  organizerId: string;
  coOrganizerId: string | null;
  name: string;
  status: string;
  format: string;
}

export default function GroupsPage() {
  const params = useParams<{ tournamentId: string }>();
  const { data: session } = useSession();
  const [groups, setGroups] = useState<any[]>([]);
  const [tournament, setTournament] = useState<TournamentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchData = useCallback(async () => {
    const [groupsRes, tournamentRes] = await Promise.all([
      fetch(`/api/tournaments/${params.tournamentId}/groups`),
      fetch(`/api/tournaments/${params.tournamentId}`),
    ]);

    if (groupsRes.ok) {
      const data = await groupsRes.json();
      setGroups(data.groups);
    }
    if (tournamentRes.ok) {
      const data = await tournamentRes.json();
      setTournament(data.tournament);
    }
    setLoading(false);
  }, [params.tournamentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const isOrganizer = session?.user?.id === tournament?.organizerId || session?.user?.id === tournament?.coOrganizerId;
  const isGroupPlayoff = tournament?.format === "GROUP_STAGE_PLAYOFF";

  const allGroupMatchesComplete = groups.every((g: any) =>
    g.matches.every((m: any) => m.status === "COMPLETED")
  );

  async function generatePlayoff() {
    setGenerating(true);
    const res = await fetch(
      `/api/tournaments/${params.tournamentId}/groups`,
      { method: "POST" }
    );
    if (res.ok) {
      fetchData();
    }
    setGenerating(false);
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse h-64 bg-muted rounded" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">{tournament?.name}</h1>
      <p className="text-muted-foreground mb-6">Group Stage</p>

      {groups.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">
          Groups not generated yet.
        </p>
      ) : (
        <>
          {isOrganizer && isGroupPlayoff && allGroupMatchesComplete && (
            <div className="mb-6 rounded-lg border border-primary/30 bg-primary/5 p-4 flex items-center justify-between">
              <p className="text-sm">
                All group matches are complete. Generate the playoff bracket?
              </p>
              <Button onClick={generatePlayoff} disabled={generating}>
                {generating ? "Generating..." : "Generate Playoff Bracket"}
              </Button>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            {groups.map((group: any) => (
              <GroupTable
                key={group.id}
                group={group}
                isOrganizer={isOrganizer}
                tournamentId={params.tournamentId}
                onResultSubmitted={fetchData}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
