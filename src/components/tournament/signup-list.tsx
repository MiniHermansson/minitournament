"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface Signup {
  id: string;
  userId: string;
  mainRole: string;
  secondaryRole: string | null;
  wantsCaptain: boolean;
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
  canRemove: boolean; // only during REGISTRATION
}

export function SignupList({ tournamentId, signups, isOrganizer, canRemove }: SignupListProps) {
  const router = useRouter();
  const [removing, setRemoving] = useState<string | null>(null);

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
              <p className="text-xs text-muted-foreground">
                {signup.mainRole}
                {signup.secondaryRole ? ` / ${signup.secondaryRole}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
