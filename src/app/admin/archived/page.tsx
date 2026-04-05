import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/tournament/status-badge";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { ArrowLeft, Trophy, Users, Swords, CalendarDays } from "lucide-react";

const formatLabels: Record<string, string> = {
  SINGLE_ELIMINATION: "Single Elimination",
  DOUBLE_ELIMINATION: "Double Elimination",
  ROUND_ROBIN: "Round Robin",
  GROUP_STAGE: "Group Stage",
  GROUP_STAGE_PLAYOFF: "Groups + Playoff",
};

export default async function ArchivedTournamentsPage() {
  const session = await getSession();
  const role =
    (session?.user as Record<string, unknown> | undefined)?.role as
      | string
      | undefined;

  if (!role || !["ADMIN", "SUPER_ADMIN"].includes(role)) {
    redirect("/");
  }

  const tournaments = await prisma.tournament.findMany({
    where: { status: "ARCHIVED" },
    include: {
      organizer: { select: { name: true } },
      registrations: {
        include: {
          team: {
            select: {
              name: true,
              tag: true,
              _count: { select: { members: true } },
            },
          },
        },
      },
      playerSignups: { select: { id: true } },
      matches: {
        where: { status: "COMPLETED" },
        include: {
          homeTeam: { select: { name: true, tag: true } },
          awayTeam: { select: { name: true, tag: true } },
          winner: { select: { name: true, tag: true } },
          group: { select: { name: true } },
          bracket: { select: { type: true } },
        },
        orderBy: [{ round: "asc" }, { position: "asc" }],
      },
      groups: { select: { name: true } },
      brackets: { select: { type: true } },
      _count: { select: { matches: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/admin"
          className={buttonVariants({ variant: "ghost", size: "icon" })}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-2xl font-bold">Archived Tournaments</h1>
      </div>

      {tournaments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No archived tournaments yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {tournaments.map((t) => {
            const isCaptainsDraft = t.teamMode === "CAPTAINS_DRAFT";
            const teamCount = isCaptainsDraft
              ? 0
              : t.registrations.length;
            const playerCount = isCaptainsDraft
              ? t.playerSignups.length
              : t.registrations.reduce(
                  (sum, r) => sum + (r.team._count.members + 1),
                  0
                );
            const completedMatches = t.matches.length;

            // Group matches by context (group name or bracket type)
            const groupedMatches = new Map<string, typeof t.matches>();
            for (const m of t.matches) {
              const key = m.group
                ? `Group: ${m.group.name}`
                : m.bracket
                  ? m.bracket.type === "WINNERS"
                    ? "Winners Bracket"
                    : m.bracket.type === "LOSERS"
                      ? "Losers Bracket"
                      : "Grand Final"
                  : "Matches";
              if (!groupedMatches.has(key)) groupedMatches.set(key, []);
              groupedMatches.get(key)!.push(m);
            }

            return (
              <Card key={t.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{t.name}</CardTitle>
                        <StatusBadge status={t.status} />
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {formatLabels[t.format] ?? t.format}
                        {" · "}
                        Organized by {t.organizer.name ?? "Unknown"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {t.startDate
                        ? new Date(t.startDate).toLocaleDateString()
                        : new Date(t.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Stats */}
                  <div className="flex gap-4 text-sm">
                    {!isCaptainsDraft && teamCount > 0 && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Trophy className="h-3.5 w-3.5" />
                        {teamCount} teams
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      {playerCount} players
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Swords className="h-3.5 w-3.5" />
                      {completedMatches}/{t._count.matches} matches played
                    </div>
                  </div>

                  {/* Teams */}
                  {!isCaptainsDraft && t.registrations.length > 0 && (
                    <details className="group">
                      <summary className="text-sm font-medium cursor-pointer select-none text-muted-foreground hover:text-foreground">
                        Teams ({t.registrations.length})
                      </summary>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {t.registrations.map((r) => (
                          <Badge
                            key={r.id}
                            variant="secondary"
                            className="text-xs"
                          >
                            {r.team.tag ? `[${r.team.tag}] ` : ""}
                            {r.team.name}
                          </Badge>
                        ))}
                      </div>
                    </details>
                  )}

                  {/* Match Results */}
                  {completedMatches > 0 && (
                    <details className="group">
                      <summary className="text-sm font-medium cursor-pointer select-none text-muted-foreground hover:text-foreground">
                        Match Results ({completedMatches})
                      </summary>
                      <div className="mt-2 space-y-3">
                        {Array.from(groupedMatches.entries()).map(
                          ([section, matches]) => (
                            <div key={section}>
                              {groupedMatches.size > 1 && (
                                <p className="text-xs font-medium text-muted-foreground mb-1">
                                  {section}
                                </p>
                              )}
                              <div className="space-y-1">
                                {matches.map((m) => (
                                  <div
                                    key={m.id}
                                    className="flex items-center gap-2 text-xs"
                                  >
                                    <span
                                      className={
                                        m.winnerId === m.homeTeamId
                                          ? "font-semibold text-foreground"
                                          : "text-muted-foreground"
                                      }
                                    >
                                      {m.homeTeam?.tag ?? m.homeTeam?.name ?? "TBD"}
                                    </span>
                                    <span className="text-muted-foreground">
                                      vs
                                    </span>
                                    <span
                                      className={
                                        m.winnerId === m.awayTeamId
                                          ? "font-semibold text-foreground"
                                          : "text-muted-foreground"
                                      }
                                    >
                                      {m.awayTeam?.tag ?? m.awayTeam?.name ?? "TBD"}
                                    </span>
                                    {m.winner && (
                                      <>
                                        <span className="text-muted-foreground">
                                          →
                                        </span>
                                        <span className="font-medium text-green-400">
                                          {m.winner.tag ?? m.winner.name}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </details>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
