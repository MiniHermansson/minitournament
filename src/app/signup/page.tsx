"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
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

const ROLES = [
  { value: "TOP", label: "Top" },
  { value: "JUNGLE", label: "Jungle" },
  { value: "MID", label: "Mid" },
  { value: "ADC", label: "ADC" },
  { value: "SUPPORT", label: "Support" },
  { value: "FILL", label: "Fill" },
];

const SECONDARY_ROLES = ROLES;

export default function SignupPage() {
  const router = useRouter();
  const { data: session } = useSession();

  const [mainRole, setMainRole] = useState("");
  const [secondaryRole, setSecondaryRole] = useState("");
  const [wantsCaptain, setWantsCaptain] = useState(false);
  const [opGgLink, setOpGgLink] = useState("");
  const [discordName, setDiscordName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [alreadySignedUp, setAlreadySignedUp] = useState(false);

  useEffect(() => {
    if (!session) return;
    fetch("/api/tournament/signup")
      .then((res) => res.json())
      .then((data) => {
        const mySignup = data.signups?.find(
          (s: any) => s.userId === session.user.id
        );
        if (mySignup) setAlreadySignedUp(true);
      });
  }, [session]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/tournament/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mainRole,
        secondaryRole: mainRole === "FILL" ? undefined : secondaryRole || undefined,
        wantsCaptain,
        opGgLink: opGgLink || undefined,
        discordName,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error);
      setLoading(false);
      return;
    }

    router.push("/");
  }

  async function onWithdraw() {
    setLoading(true);
    await fetch("/api/tournament/signup", { method: "DELETE" });
    router.push("/");
  }

  if (!session) {
    return (
      <div className="container mx-auto flex justify-center px-4 py-8">
        <p className="text-muted-foreground">Please sign in to sign up.</p>
      </div>
    );
  }

  if (alreadySignedUp) {
    return (
      <div className="container mx-auto flex justify-center px-4 py-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Already Signed Up</CardTitle>
            <CardDescription>
              You have already signed up for this tournament.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              onClick={onWithdraw}
              disabled={loading}
            >
              {loading ? "Withdrawing..." : "Withdraw Signup"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto flex justify-center px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign Up as Player</CardTitle>
          <CardDescription>
            Sign up individually for the captains draft.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="discord">Discord Username</Label>
              <Input
                id="discord"
                placeholder="username#1234"
                value={discordName}
                onChange={(e) => setDiscordName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="main-role">Main Role</Label>
              <select
                id="main-role"
                value={mainRole}
                onChange={(e) => {
                  setMainRole(e.target.value);
                  if (e.target.value === "FILL") setSecondaryRole("");
                }}
                required
                className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Select role...</option>
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            {mainRole && mainRole !== "FILL" && (
              <div className="space-y-2">
                <Label htmlFor="secondary-role">Secondary Role</Label>
                <select
                  id="secondary-role"
                  value={secondaryRole}
                  onChange={(e) => setSecondaryRole(e.target.value)}
                  required
                  className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Select role...</option>
                  {SECONDARY_ROLES.filter((r) => r.value !== mainRole).map(
                    (r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    )
                  )}
                </select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="opgg">OP.GG Link</Label>
              <Input
                id="opgg"
                type="url"
                placeholder="https://op.gg/summoners/euw/..."
                value={opGgLink}
                onChange={(e) => setOpGgLink(e.target.value)}
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={wantsCaptain}
                onChange={(e) => setWantsCaptain(e.target.checked)}
                className="rounded border-input"
              />
              <span className="text-sm">I want to be a captain</span>
            </label>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button
              type="submit"
              className="w-full"
              disabled={loading || !mainRole || !discordName || (mainRole !== "FILL" && !secondaryRole)}
            >
              {loading ? "Signing up..." : "Sign Up"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
