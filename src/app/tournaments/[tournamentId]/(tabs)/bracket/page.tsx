"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { BracketView } from "@/components/tournament/bracket-view";

interface TournamentInfo {
  organizerId: string;
  coOrganizerId: string | null;
  name: string;
  status: string;
}

export default function BracketPage() {
  const params = useParams<{ tournamentId: string }>();
  const { data: session } = useSession();
  const [brackets, setBrackets] = useState<any[]>([]);
  const [tournament, setTournament] = useState<TournamentInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [bracketRes, tournamentRes] = await Promise.all([
      fetch(`/api/tournaments/${params.tournamentId}/bracket`),
      fetch(`/api/tournaments/${params.tournamentId}`),
    ]);

    if (bracketRes.ok) {
      const data = await bracketRes.json();
      setBrackets(data.brackets);
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

  if (loading) {
    return <div className="animate-pulse h-64 bg-muted rounded" />;
  }

  const isOrganizer = session?.user?.id === tournament?.organizerId || session?.user?.id === tournament?.coOrganizerId;

  return (
    <>
      {brackets.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">
          Bracket not generated yet.
        </p>
      ) : (
        <BracketView
          brackets={brackets}
          isOrganizer={isOrganizer}
          tournamentId={params.tournamentId}
          onResultSubmitted={fetchData}
        />
      )}
    </>
  );
}
