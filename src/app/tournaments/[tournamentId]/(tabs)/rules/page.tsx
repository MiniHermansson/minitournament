"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function RulesPage() {
  const params = useParams<{ tournamentId: string }>();
  const { data: session } = useSession();
  const [rules, setRules] = useState<string | null>(null);
  const [editRules, setEditRules] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isOrganizer, setIsOrganizer] = useState(false);

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/tournaments/${params.tournamentId}`);
    if (res.ok) {
      const data = await res.json();
      const t = data.tournament;
      setRules(t.rules ?? null);
      setIsOrganizer(
        session?.user?.id === t.organizerId ||
          session?.user?.id === t.coOrganizerId
      );
    }
    setLoading(false);
  }, [params.tournamentId, session?.user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/tournaments/${params.tournamentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rules: editRules }),
    });
    if (res.ok) {
      setRules(editRules || null);
      setEditing(false);
    }
    setSaving(false);
  }

  if (loading) {
    return <div className="animate-pulse h-48 bg-muted rounded" />;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Rules</CardTitle>
        {isOrganizer && !editing && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditRules(rules ?? "");
              setEditing(true);
            }}
          >
            Edit Rules
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="space-y-4">
            <Textarea
              value={editRules}
              onChange={(e) => setEditRules(e.target.value)}
              rows={12}
              placeholder="Write tournament rules here..."
              className="min-h-[200px]"
            />
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save Rules"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setEditing(false)}
                disabled={saving}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : rules ? (
          <p className="text-sm whitespace-pre-wrap">{rules}</p>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            No rules have been set for this tournament yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
