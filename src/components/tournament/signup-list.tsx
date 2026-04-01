"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface RankInfo {
  tier: string | null;
  rank: string | null;
  lp: number | null;
  wins: number | null;
  losses: number | null;
}

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

interface Signup {
  id: string;
  userId: string;
  mainRole: string;
  secondaryRole: string | null;
  wantsCaptain: boolean;
  opGgLink?: string | null;
  user: {
    id: string;
    name: string | null;
    image: string | null;
  };
}

interface SignupListProps {
  tournamentId: string;
  signups: Signup[];
  isOrganizer: boolean;
  canRemove: boolean;
}

export function SignupList({ tournamentId, signups, isOrganizer, canRemove }: SignupListProps) {
  const router = useRouter();
  const [removing, setRemoving] = useState<string | null>(null);
  const [ranks, setRanks] = useState<Record<string, RankInfo | null>>({});

  // Lazy-load ranks on the client after initial render
  useEffect(() => {
    const userIds = signups
      .filter((s) => s.opGgLink)
      .map((s) => s.userId);
    if (userIds.length === 0) return;

    fetch(`/api/tournaments/${tournamentId}/ranks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.ranks) setRanks(data.ranks);
      })
      .catch(() => {});
  }, [tournamentId, signups]);

  const handleRemove = async (userId: string) => {
    setRemoving(userId);
    const res = await fetch(
      `/api/tournaments/${tournamentId}/signup?userId=${userId}`,
      { method: "DELETE" }
    );

    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error);
    } else {
      toast.success("Player removed from signup");
      router.refresh();
    }
    setRemoving(null);
  };

  if (signups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No players signed up yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {signups.map((signup) => (
        <div
          key={signup.id}
          className="flex items-center justify-between rounded-lg border p-3"
        >
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={signup.user.image ?? undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                {signup.user.name?.[0]?.toUpperCase() ?? "?"}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">{signup.user.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground">
                  {signup.mainRole}
                  {signup.secondaryRole ? ` / ${signup.secondaryRole}` : ""}
                </span>
              </div>
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
            {signup.wantsCaptain && (
              <Badge variant="outline" className="bg-amber-500/15 text-amber-400 border-amber-500/30">
                Captain
              </Badge>
            )}
            {isOrganizer && canRemove && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                disabled={removing === signup.userId}
                onClick={() => handleRemove(signup.userId)}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
