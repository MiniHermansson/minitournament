import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/tournament/status-badge";
import { getSession } from "@/lib/auth-utils";

const GROUP_FORMATS = ["ROUND_ROBIN", "GROUP_STAGE", "GROUP_STAGE_PLAYOFF"];

export default async function HomePage() {
  const session = await getSession();

  if (!session) {
    return <LandingPage />;
  }

  const userId = session.user.id;

  // Fetch teams and tournaments in parallel
  const [teams, organizedTournaments, participatingTournaments] =
    await Promise.all([
      prisma.team.findMany({
        where: {
          OR: [
            { ownerId: userId },
            { members: { some: { userId } } },
          ],
        },
        include: { _count: { select: { members: true } } },
        orderBy: { createdAt: "desc" },
        take: 4,
      }),
      prisma.tournament.findMany({
        where: {
          OR: [
            { organizerId: userId },
            { coOrganizerId: userId },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 4,
      }),
      prisma.tournament.findMany({
        where: {
          AND: [
            { organizerId: { not: userId } },
            {
              OR: [
                { coOrganizerId: null },
                { coOrganizerId: { not: userId } },
              ],
            },
          ],
          OR: [
            {
              registrations: {
                some: {
                  teamId: {
                    in: (
                      await prisma.team.findMany({
                        where: {
                          OR: [
                            { ownerId: userId },
                            { members: { some: { userId } } },
                          ],
                        },
                        select: { id: true },
                      })
                    ).map((t) => t.id),
                  },
                  status: "ACCEPTED",
                },
              },
            },
            { playerSignups: { some: { userId } } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 4,
      }),
    ]);

  const teamIds = teams.map((t) => t.id);

  // Fetch upcoming matches (depends on teamIds)
  const upcomingMatches =
    teamIds.length > 0
      ? await prisma.match.findMany({
          where: {
            OR: [
              { homeTeamId: { in: teamIds } },
              { awayTeamId: { in: teamIds } },
            ],
            status: { in: ["PENDING", "SCHEDULED"] },
          },
          include: {
            tournament: { select: { id: true, name: true, format: true } },
            homeTeam: { select: { id: true, name: true, tag: true } },
            awayTeam: { select: { id: true, name: true, tag: true } },
          },
          orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
          take: 3,
        })
      : [];

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-1">
        Welcome back, {session.user.name}
      </h1>
      <p className="text-muted-foreground mb-8">
        Here&apos;s what&apos;s happening.
      </p>

      <div className="grid gap-6 md:grid-cols-2 mb-6">
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
              <div className="space-y-2">
                {teams.slice(0, 3).map((team) => (
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
                {teams.length > 3 && (
                  <Link
                    href="/dashboard"
                    className="block text-center text-sm text-primary hover:underline pt-1"
                  >
                    View all teams
                  </Link>
                )}
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
            {organizedTournaments.length === 0 &&
            participatingTournaments.length === 0 ? (
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
                      {organizedTournaments.slice(0, 3).map((t) => (
                        <Link
                          key={t.id}
                          href={`/tournaments/${t.id}/manage`}
                          className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                        >
                          <p className="text-sm font-medium truncate mr-2">
                            {t.name}
                          </p>
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
                      {participatingTournaments.slice(0, 3).map((t) => (
                        <Link
                          key={t.id}
                          href={`/tournaments/${t.id}`}
                          className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                        >
                          <p className="text-sm font-medium truncate mr-2">
                            {t.name}
                          </p>
                          <StatusBadge status={t.status} />
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {(organizedTournaments.length > 3 ||
                  participatingTournaments.length > 3) && (
                  <Link
                    href="/dashboard"
                    className="block text-center text-sm text-primary hover:underline pt-1"
                  >
                    View all tournaments
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Matches — only show if there are matches */}
      {upcomingMatches.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Upcoming Matches</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {upcomingMatches.map((match) => {
                const isHome = teamIds.includes(match.homeTeamId ?? "");
                const opponent = isHome ? match.awayTeam : match.homeTeam;
                const myTeam = isHome ? match.homeTeam : match.awayTeam;
                const matchLink = GROUP_FORMATS.includes(match.tournament.format)
                  ? `/tournaments/${match.tournament.id}/groups`
                  : `/tournaments/${match.tournament.id}/bracket`;

                return (
                  <Link
                    key={match.id}
                    href={matchLink}
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
          </CardContent>
        </Card>
      )}

      <div className="flex justify-center">
        <Link
          href="/tournaments"
          className={buttonVariants({ size: "lg" })}
        >
          Browse All Tournaments
        </Link>
      </div>
    </div>
  );
}

function LandingPage() {
  return (
    <div className="flex flex-col">
      <section className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-24 text-center">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            <span className="bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 bg-clip-text text-transparent">
              MiniTournament
            </span>
          </h1>
          <p className="mx-auto max-w-xl text-lg text-muted-foreground">
            Create and manage League of Legends tournaments. Set up brackets,
            round robin, group stages, and more.
          </p>
        </div>

        <div className="flex gap-4">
          <Link href="/tournaments" className={buttonVariants({ size: "lg" })}>
            Browse Tournaments
          </Link>
          <Link
            href="/register"
            className={buttonVariants({ size: "lg", variant: "outline" })}
          >
            Get Started
          </Link>
        </div>

        <div className="mt-16 grid gap-8 sm:grid-cols-3 max-w-3xl w-full">
          <div className="space-y-2 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500/10">
              <svg
                className="h-6 w-6 text-amber-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <h3 className="font-semibold">Multiple Formats</h3>
            <p className="text-sm text-muted-foreground">
              Single & double elimination, round robin, group stages, and
              playoffs.
            </p>
          </div>
          <div className="space-y-2 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500/10">
              <svg
                className="h-6 w-6 text-amber-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <h3 className="font-semibold">Team Management</h3>
            <p className="text-sm text-muted-foreground">
              Create teams, manage rosters with LoL roles, and register for
              events.
            </p>
          </div>
          <div className="space-y-2 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500/10">
              <svg
                className="h-6 w-6 text-amber-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="font-semibold">Live Brackets</h3>
            <p className="text-sm text-muted-foreground">
              Interactive bracket views with real-time results and standings.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
