import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const statusStyles: Record<string, string> = {
  DRAFT: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  REGISTRATION: "bg-green-500/15 text-green-400 border-green-500/30",
  IN_PROGRESS: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  COMPLETED: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  CANCELLED: "bg-red-500/15 text-red-400 border-red-500/30",
};

const formatLabels: Record<string, string> = {
  SINGLE_ELIMINATION: "Single Elim",
  DOUBLE_ELIMINATION: "Double Elim",
  ROUND_ROBIN: "Round Robin",
  GROUP_STAGE: "Group Stage",
  GROUP_STAGE_PLAYOFF: "Groups + Playoff",
};

interface TournamentCardProps {
  tournament: {
    id: string;
    name: string;
    format: string;
    status: string;
    maxTeams: number;
    startDate: string | null;
    organizer: { name: string | null };
    _count: { registrations: number };
  };
}

export function TournamentCard({ tournament }: TournamentCardProps) {
  return (
    <Link href={`/tournaments/${tournament.id}`}>
      <Card className="transition-colors hover:bg-muted/50 h-full">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base truncate">
              {tournament.name}
            </CardTitle>
            <Badge variant="outline" className={statusStyles[tournament.status] ?? ""}>
              {tournament.status.replace("_", " ")}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{formatLabels[tournament.format] ?? tournament.format}</span>
            <span>
              {tournament._count.registrations}/{tournament.maxTeams} teams
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>By {tournament.organizer.name ?? "Unknown"}</span>
            {tournament.startDate && (
              <span>
                {new Date(tournament.startDate).toLocaleDateString()}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
