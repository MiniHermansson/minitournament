import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-utils";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/tournament/status-badge";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const userId = session.user.id;

  // Fetch user's teams (owned or member of)
  const teams = await prisma.team.findMany({
    where: {
      OR: [
        { ownerId: userId },
        { members: { some: { userId } } },
      ],
    },
    include: {
      _count: { select: { members: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const teamIds = teams.map((t) => t.id);

  // Fetch tournaments the user organizes or co-organizes
  const organizedTournaments = await prisma.tournament.findMany({
    where: {
      OR: [
        { organizerId: userId },
        { coOrganizerId: userId },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  // Fetch tournaments the user participates in (team registered or player signup)
  const participatingTournaments = await prisma.tournament.findMany({
    where: {
      AND: [
        { organizerId: { not: userId } },
        { OR: [{ coOrganizerId: null }, { coOrganizerId: { not: userId } }] },
      ],
      OR: [
        {
          registrations: {
            some: { teamId: { in: teamIds }, status: "ACCEPTED" },
          },
        },
        {
          playerSignups: { some: { userId } },
        },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  // Fetch upcoming matches for user's teams
  const upcomingMatches = teamIds.length > 0
    ? await prisma.match.findMany({
        where: {
          OR: [
            { homeTeamId: { in: teamIds } },
            { awayTeamId: { in: teamIds } },
          ],
          status: { in: ["PENDING", "SCHEDULED"] },
        },
        include: {
          tournament: { select: { id: true, name: true } },
          homeTeam: { select: { id: true, name: true, tag: true } },
          awayTeam: { select: { id: true, name: true, tag: true } },
        },
        orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
        take: 10,
      })
    : [];

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-1">Dashboard</h1>
      <p className="text-muted-foreground mb-8">
        Welcome back, {session.user.name}!
      </p>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* My Teams */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">My Teams</CardTitle>
            <Link
              href="/teams/new"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Create
            </Link>
          </CardHeader>
          <CardContent>
            {teams.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No teams yet. Create one to get started.
              </p>
            ) : (
              <div className="space-y-3">
                {teams.map((team) => (
                  <Link
                    key={team.id}
                    href={`/teams/${team.id}`}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {team.name}{" "}
                        <span className="text-muted-foreground">
                          [{team.tag}]
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {team._count.members} members
                        {team.ownerId === userId && " · Owner"}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* My Tournaments */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">My Tournaments</CardTitle>
            <Link
              href="/tournaments/new"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Create
            </Link>
          </CardHeader>
          <CardContent>
            {organizedTournaments.length === 0 && participatingTournaments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No tournaments yet.
              </p>
            ) : (
              <div className="space-y-4">
                {organizedTournaments.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                      Organizing
                    </p>
                    <div className="space-y-2">
                      {organizedTournaments.map((t) => (
                        <Link
                          key={t.id}
                          href={`/tournaments/${t.id}/manage`}
                          className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                        >
                          <p className="text-sm font-medium truncate mr-2">{t.name}</p>
                          <StatusBadge status={t.status} />
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {participatingTournaments.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                      Participating
                    </p>
                    <div className="space-y-2">
                      {participatingTournaments.map((t) => (
                        <Link
                          key={t.id}
                          href={`/tournaments/${t.id}`}
                          className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                        >
                          <p className="text-sm font-medium truncate mr-2">{t.name}</p>
                          <StatusBadge status={t.status} />
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Matches */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Upcoming Matches</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingMatches.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No upcoming matches.
              </p>
            ) : (
              <div className="space-y-3">
                {upcomingMatches.map((match) => {
                  const isHome = teamIds.includes(match.homeTeamId ?? "");
                  const opponent = isHome ? match.awayTeam : match.homeTeam;
                  const myTeam = isHome ? match.homeTeam : match.awayTeam;

                  return (
                    <Link
                      key={match.id}
                      href={`/tournaments/${match.tournament.id}/bracket`}
                      className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {myTeam?.name ?? "TBD"}{" "}
                          <span className="text-muted-foreground">vs</span>{" "}
                          {opponent?.name ?? "TBD"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {match.tournament.name} · Round {match.round}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {match.status === "SCHEDULED" && match.scheduledAt
                          ? new Date(match.scheduledAt).toLocaleDateString()
                          : match.status}
                      </Badge>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
