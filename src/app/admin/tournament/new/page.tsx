"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const FORMATS = [
  { value: "SINGLE_ELIMINATION", label: "Single Elimination", desc: "Lose once and you're out" },
  { value: "DOUBLE_ELIMINATION", label: "Double Elimination", desc: "Two losses to be eliminated" },
  { value: "ROUND_ROBIN", label: "Round Robin", desc: "Every team plays every other team" },
  { value: "GROUP_STAGE", label: "Group Stage", desc: "Teams split into groups, round robin within" },
  { value: "GROUP_STAGE_PLAYOFF", label: "Groups + Playoff", desc: "Group stage then elimination bracket" },
];

export default function AdminCreateTournamentPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [format, setFormat] = useState("SINGLE_ELIMINATION");
  const [teamMode, setTeamMode] = useState("PRE_MADE");
  const [coOrganizerEmail, setCoOrganizerEmail] = useState("");

  const [maxTeams, setMaxTeams] = useState(16);
  const [minTeams, setMinTeams] = useState(2);
  const [teamSize, setTeamSize] = useState(5);
  const [bestOf, setBestOf] = useState("1");

  const [groupCount, setGroupCount] = useState(4);
  const [advancingPerGroup, setAdvancingPerGroup] = useState(2);
  const [playoffBestOf, setPlayoffBestOf] = useState("1");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const isGroupFormat = format === "GROUP_STAGE" || format === "GROUP_STAGE_PLAYOFF";

  function buildFormatConfig() {
    const config: Record<string, unknown> = { bestOf: Number(bestOf) };
    if (format === "ROUND_ROBIN") {
      config.pointsForWin = 3;
      config.pointsForDraw = 1;
    }
    if (isGroupFormat) {
      config.groupCount = groupCount;
      config.pointsForWin = 3;
      config.pointsForDraw = 1;
    }
    if (format === "GROUP_STAGE_PLAYOFF") {
      config.advancingPerGroup = advancingPerGroup;
      config.playoffBestOf = Number(playoffBestOf);
    }
    return config;
  }

  async function onSubmit() {
    setLoading(true);
    setError("");

    const res = await fetch("/api/tournaments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description: description || undefined,
        format,
        teamMode,
        coOrganizerEmail: coOrganizerEmail || undefined,
        maxTeams,
        minTeams,
        teamSize,
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        endDate: endDate ? new Date(endDate).toISOString() : undefined,
        formatConfig: buildFormatConfig(),
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error);
      setLoading(false);
      return;
    }

    router.push("/manage");
  }

  return (
    <div className="container mx-auto flex justify-center px-4 py-8">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Create Tournament</CardTitle>
          <CardDescription>
            Step {teamMode === "CAPTAINS_DRAFT" ? (step === 1 ? 1 : 2) : step} of {teamMode === "CAPTAINS_DRAFT" ? 2 : 3}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="t-name">Tournament Name</Label>
                <Input
                  id="t-name"
                  placeholder="Summer Championship 2026"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-desc">Description (optional)</Label>
                <textarea
                  id="t-desc"
                  className="flex min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Describe your tournament..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Format</Label>
                <div className="grid gap-2">
                  {FORMATS.map((f) => (
                    <label
                      key={f.value}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                        format === f.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="format"
                        value={f.value}
                        checked={format === f.value}
                        onChange={(e) => setFormat(e.target.value)}
                        className="sr-only"
                      />
                      <div>
                        <p className="font-medium text-sm">{f.label}</p>
                        <p className="text-xs text-muted-foreground">{f.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Team Mode</Label>
                <div className="grid gap-2">
                  {[
                    { value: "PRE_MADE", label: "Pre-Made Teams", desc: "Teams register as existing rosters" },
                    { value: "CAPTAINS_DRAFT", label: "Captains Draft", desc: "Players sign up individually, captains draft teams live" },
                  ].map((m) => (
                    <label
                      key={m.value}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                        teamMode === m.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="teamMode"
                        value={m.value}
                        checked={teamMode === m.value}
                        onChange={(e) => setTeamMode(e.target.value)}
                        className="sr-only"
                      />
                      <div>
                        <p className="font-medium text-sm">{m.label}</p>
                        <p className="text-xs text-muted-foreground">{m.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="co-org">Co-Organizer Email (optional)</Label>
                <Input
                  id="co-org"
                  type="email"
                  placeholder="co-organizer@email.com"
                  value={coOrganizerEmail}
                  onChange={(e) => setCoOrganizerEmail(e.target.value)}
                />
              </div>

              <Button
                className="w-full"
                onClick={() => setStep(teamMode === "CAPTAINS_DRAFT" ? 3 : 2)}
                disabled={!name.trim()}
              >
                Next
              </Button>
            </div>
          )}

          {step === 2 && teamMode !== "CAPTAINS_DRAFT" && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="max-teams">Max Teams</Label>
                  <Input id="max-teams" type="number" min={2} max={128} value={maxTeams} onChange={(e) => setMaxTeams(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="min-teams">Min Teams</Label>
                  <Input id="min-teams" type="number" min={2} max={128} value={minTeams} onChange={(e) => setMinTeams(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="team-size">Team Size</Label>
                  <Input id="team-size" type="number" min={1} max={10} value={teamSize} onChange={(e) => setTeamSize(Number(e.target.value))} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="best-of">Best Of</Label>
                <select id="best-of" value={bestOf} onChange={(e) => setBestOf(e.target.value)} className="flex h-8 w-full rounded-lg border border-input bg-background px-3 text-sm">
                  <option value="1">Best of 1</option>
                  <option value="3">Best of 3</option>
                  <option value="5">Best of 5</option>
                </select>
              </div>

              {isGroupFormat && (
                <div className="space-y-2">
                  <Label htmlFor="group-count">Number of Groups</Label>
                  <Input id="group-count" type="number" min={2} max={16} value={groupCount} onChange={(e) => setGroupCount(Number(e.target.value))} />
                </div>
              )}

              {format === "GROUP_STAGE_PLAYOFF" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="advancing">Teams Advancing Per Group</Label>
                    <Input id="advancing" type="number" min={1} max={8} value={advancingPerGroup} onChange={(e) => setAdvancingPerGroup(Number(e.target.value))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="playoff-bo">Playoff Best Of</Label>
                    <select id="playoff-bo" value={playoffBestOf} onChange={(e) => setPlayoffBestOf(e.target.value)} className="flex h-8 w-full rounded-lg border border-input bg-background px-3 text-sm">
                      <option value="1">Best of 1</option>
                      <option value="3">Best of 3</option>
                      <option value="5">Best of 5</option>
                    </select>
                  </div>
                </>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Back</Button>
                <Button onClick={() => setStep(3)} className="flex-1">Next</Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date (optional)</Label>
                <Input id="start-date" type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">End Date (optional)</Label>
                <Input id="end-date" type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(teamMode === "CAPTAINS_DRAFT" ? 1 : 2)} className="flex-1">Back</Button>
                <Button onClick={onSubmit} disabled={loading} className="flex-1">
                  {loading ? "Creating..." : "Create Tournament"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
