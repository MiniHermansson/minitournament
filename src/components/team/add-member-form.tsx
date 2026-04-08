"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ROLES = [
  { value: "TOP", label: "Top" },
  { value: "JUNGLE", label: "Jungle" },
  { value: "MID", label: "Mid" },
  { value: "ADC", label: "ADC" },
  { value: "SUPPORT", label: "Support" },
  { value: "SUBSTITUTE", label: "Substitute" },
];

interface AddMemberFormProps {
  teamId: string;
  onAdded: () => void;
}

export function AddMemberForm({ teamId, onAdded }: AddMemberFormProps) {
  const [discordUsername, setDiscordUsername] = useState("");
  const [role, setRole] = useState("TOP");
  const [summonerName, setSummonerName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch(`/api/teams/${teamId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ discordUsername, role, summonerName: summonerName || undefined }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error);
      setLoading(false);
      return;
    }

    setDiscordUsername("");
    setSummonerName("");
    setLoading(false);
    onAdded();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="member-discord">Discord Username</Label>
          <Input
            id="member-discord"
            type="text"
            placeholder="username"
            value={discordUsername}
            onChange={(e) => setDiscordUsername(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="member-role">Role</Label>
          <select
            id="member-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="flex h-8 w-full rounded-lg border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="summoner-name">Summoner Name (optional)</Label>
        <Input
          id="summoner-name"
          placeholder="Summoner name"
          value={summonerName}
          onChange={(e) => setSummonerName(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={loading}>
        {loading ? "Adding..." : "Add Member"}
      </Button>
    </form>
  );
}
