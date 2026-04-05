"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Team {
  id: string;
  name: string;
  tag: string;
}

export default function RegisterTeamPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!session) return;
    fetch("/api/teams")
      .then((r) => r.json())
      .then((data) => {
        const owned = data.teams.filter(
          (t: any) => t.owner?.id === session.user.id
        );
        setTeams(owned);
        if (owned.length > 0) setSelectedTeamId(owned[0].id);
      });
  }, [session]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTeamId) return;
    setLoading(true);
    setError("");

    const res = await fetch("/api/tournament/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId: selectedTeamId }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error);
      setLoading(false);
      return;
    }

    router.push("/");
  }

  if (!session) {
    return (
      <div className="container mx-auto flex justify-center px-4 py-8">
        <p className="text-muted-foreground">Please sign in to register.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto flex justify-center px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Register for Tournament</CardTitle>
          <CardDescription>Select a team to register</CardDescription>
        </CardHeader>
        <CardContent>
          {teams.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You don&apos;t own any teams. Create a team first.
            </p>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                {teams.map((team) => (
                  <label
                    key={team.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                      selectedTeamId === team.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="team"
                      value={team.id}
                      checked={selectedTeamId === team.id}
                      onChange={(e) => setSelectedTeamId(e.target.value)}
                      className="sr-only"
                    />
                    <div>
                      <p className="font-medium text-sm">{team.name}</p>
                      <p className="text-xs text-muted-foreground">
                        [{team.tag}]
                      </p>
                    </div>
                  </label>
                ))}
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Registering..." : "Register Team"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
