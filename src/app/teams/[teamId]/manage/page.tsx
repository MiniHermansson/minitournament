"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { RosterTable } from "@/components/team/roster-table";
import { AddMemberForm } from "@/components/team/add-member-form";

interface TeamData {
  id: string;
  name: string;
  tag: string;
  ownerId: string;
  members: Array<{
    id: string;
    role: string;
    summonerName: string | null;
    user: {
      id: string;
      name: string | null;
      image: string | null;
      email: string;
    };
  }>;
}

export default function ManageTeamPage() {
  const params = useParams<{ teamId: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const [team, setTeam] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const fetchTeam = useCallback(async () => {
    const res = await fetch(`/api/teams/${params.teamId}`);
    if (!res.ok) {
      router.push("/teams");
      return;
    }
    const data = await res.json();
    if (data.team.ownerId !== session?.user?.id) {
      router.push(`/teams/${params.teamId}`);
      return;
    }
    setTeam(data.team);
    setLoading(false);
  }, [params.teamId, session?.user?.id, router]);

  useEffect(() => {
    if (session) fetchTeam();
  }, [session, fetchTeam]);

  async function handleDeleteTeam() {
    if (!confirm("Are you sure you want to delete this team? This cannot be undone.")) return;
    setDeleting(true);
    const res = await fetch(`/api/teams/${params.teamId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/teams");
    } else {
      const data = await res.json();
      alert(data.error);
    }
    setDeleting(false);
  }

  async function handleRemoveMember(memberId: string) {
    const res = await fetch(
      `/api/teams/${params.teamId}/members/${memberId}`,
      { method: "DELETE" }
    );
    if (res.ok) fetchTeam();
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

  if (!team) return null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-3xl font-bold mb-2">Manage {team.name}</h1>
      <p className="text-muted-foreground mb-6">[{team.tag}]</p>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Roster ({team.members.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <RosterTable
            members={team.members}
            isOwner={true}
            onRemove={handleRemoveMember}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add Member</CardTitle>
        </CardHeader>
        <CardContent>
          <Separator className="mb-4" />
          <AddMemberForm teamId={team.id} onAdded={fetchTeam} />
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Permanently delete this team. Cannot be done if the team is active in a tournament.
          </p>
          <Button
            variant="destructive"
            onClick={handleDeleteTeam}
            disabled={deleting}
          >
            {deleting ? "Deleting..." : "Delete Team"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
