"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RulesEditorProps {
  tournamentId: string;
  rules: string | null;
  isOrganizer: boolean;
}

export function RulesEditor({ tournamentId, rules, isOrganizer }: RulesEditorProps) {
  const router = useRouter();
  const [editRules, setEditRules] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/tournament`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rules: editRules }),
    });
    if (res.ok) {
      setEditing(false);
      router.refresh();
    }
    setSaving(false);
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
