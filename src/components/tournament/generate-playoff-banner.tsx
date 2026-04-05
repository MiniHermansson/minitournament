"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function GeneratePlayoffBanner({ tournamentId }: { tournamentId: string }) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);

  async function generatePlayoff() {
    setGenerating(true);
    const res = await fetch(`/api/tournament/groups`, {
      method: "POST",
    });
    if (res.ok) {
      router.refresh();
    }
    setGenerating(false);
  }

  return (
    <div className="mb-6 rounded-lg border border-primary/30 bg-primary/5 p-4 flex items-center justify-between">
      <p className="text-sm">
        All group matches are complete. Generate the playoff bracket?
      </p>
      <Button onClick={generatePlayoff} disabled={generating}>
        {generating ? "Generating..." : "Generate Playoff Bracket"}
      </Button>
    </div>
  );
}
