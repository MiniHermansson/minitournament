import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-utils";
import { fetchRankedData, RankInfo } from "@/lib/riot-api";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/tournament/status-badge";
import { SignupList } from "@/components/tournament/signup-list";

const formatLabels: Record<string, string> = {
  SINGLE_ELIMINATION: "Single Elimination",
  DOUBLE_ELIMINATION: "Double Elimination",
  ROUND_ROBIN: "Round Robin",
  GROUP_STAGE: "Group Stage",
  GROUP_STAGE_PLAYOFF: "Groups + Playoff",
};

export default async function TournamentDetailPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = await params;
  const session = await getSession();

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      organizer: { select: { id: true, name: true, image: true } },
      registrations: {
        include: {
          team: {
            include: {
              owner: { select: { id: true, name: true } },
              _count: { select: { members: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      playerSignups: {
        include: {
          user: { select: { id: true, name: true, image: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!tournament) notFound();

  const isOrganizer = session?.user?.id === tournament.organizerId || session?.user?.id === tournament.coOrganizerId;
  const userTeams = session
    ? await prisma.team.findMany({
        where: { ownerId: session.user.id },
        select: { id: true, name: true, tag: true },
      })
    : [];

  const isCaptainsDraft = tournament.teamMode === "CAPTAINS_DRAFT";

  // Fetch ranks server-side for captains draft signups
  let ranks: Record<string, RankInfo | null> = {};
  if (isCaptainsDraft && tournament.playerSignups.length > 0) {
    const signupsWithLinks = tournament.playerSignups.filter((s) => s.opGgLink);
    const results = await Promise.allSettled(
      signupsWithLinks.map(async (signup) => {
        try {
          const result = await fetchRankedData(signup.opGgLink!);
          return { userId: signup.userId, rank: result?.rank ?? null };
        } catch {
          return { userId: signup.userId, rank: null };
        }
      })
    );
    for (const r of results) {
      if (r.status === "fulfilled") {
        ranks[r.value.userId] = r.value.rank;
      }
    }
  }

  const registeredTeamIds = new Set(
    tournament.registrations.map((r) => r.teamId)
  );
  const canRegister =
    !isCaptainsDraft &&
    tournament.status === "REGISTRATION" &&
    session &&
    userTeams.some((t) => !registeredTeamIds.has(t.id));

  const alreadySignedUp = isCaptainsDraft && session
    ? tournament.playerSignups.some((s) => s.userId === session.user.id)
    : false;
  const canSignUp =
    isCaptainsDraft &&
    tournament.status === "REGISTRATION" &&
    session &&
    !alreadySignedUp;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold">{tournament.name}</h1>
            <StatusBadge status={tournament.status} />
          </div>
          <p className="text-muted-foreground">
            {formatLabels[tournament.format]}
          </p>
        </div>
        <div className="flex gap-2">
          {canRegister && (
            <Link
              href={`/tournaments/${tournament.id}/register`}
              className={buttonVariants()}
            >
              Register Team
            </Link>
          )}
          {canSignUp && (
            <Link
              href={`/tournaments/${tournament.id}/signup`}
              className={buttonVariants()}
            >
              Sign Up
            </Link>
          )}
          {alreadySignedUp && (
            <Badge variant="outline" className="bg-green-500/15 text-green-400 border-green-500/30">
              Signed Up
            </Badge>
          )}
          {tournament.status === "DRAFTING" && (
            <Link
              href={`/tournaments/${tournament.id}/draft`}
              className={buttonVariants({ variant: "secondary" })}
            >
              Watch Draft
            </Link>
          )}
          {isOrganizer && (
            <Link
              href={`/tournaments/${tournament.id}/manage`}
              className={buttonVariants({ variant: "outline" })}
            >
              Manage
            </Link>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <span>Organized by</span>
        <Avatar className="h-5 w-5">
          <AvatarImage src={tournament.organizer.image ?? undefined} />
          <AvatarFallback className="text-xs">
            {tournament.organizer.name?.[0]?.toUpperCase() ?? "?"}
          </AvatarFallback>
        </Avatar>
        <span>{tournament.organizer.name}</span>
      </div>

      {tournament.description && (
        <p className="text-sm mb-6 whitespace-pre-wrap">
          {tournament.description}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">
              {isCaptainsDraft ? "Players" : "Teams"}
            </p>
            <p className="text-2xl font-bold">
              {isCaptainsDraft
                ? tournament.playerSignups.length
                : tournament.registrations.filter((r) => r.status === "ACCEPTED").length}
              {!isCaptainsDraft && (
                <span className="text-sm font-normal text-muted-foreground">
                  /{tournament.maxTeams}
                </span>
              )}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Team Size</p>
            <p className="text-2xl font-bold">{tournament.teamSize}v{tournament.teamSize}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Start Date</p>
            <p className="text-2xl font-bold">
              {tournament.startDate
                ? new Date(tournament.startDate).toLocaleDateString()
                : "TBD"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* DEBUG: remove after confirming ranks work */}
      <pre className="text-xs bg-muted p-2 rounded mb-4 overflow-auto">
        DEBUG ranks: {JSON.stringify(ranks, null, 2)}
      </pre>

      <Separator className="mb-6" />

      {isCaptainsDraft ? (
        <Card>
          <CardHeader>
            <CardTitle>
              Signed Up Players ({tournament.playerSignups.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SignupList
              tournamentId={tournament.id}
              signups={tournament.playerSignups}
              isOrganizer={isOrganizer}
              canRemove={tournament.status === "REGISTRATION"}
              ranks={ranks}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              Registered Teams ({tournament.registrations.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tournament.registrations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No teams registered yet.
              </p>
            ) : (
              <div className="space-y-3">
                {tournament.registrations.map((reg) => (
                  <div
                    key={reg.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                          {reg.team.tag}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{reg.team.name}</p>
                        <p className="text-xs text-muted-foreground">
                          [{reg.team.tag}] · {reg.team._count.members} members
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        reg.status === "ACCEPTED"
                          ? "bg-green-500/15 text-green-400 border-green-500/30"
                          : reg.status === "REJECTED"
                          ? "bg-red-500/15 text-red-400 border-red-500/30"
                          : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                      }
                    >
                      {reg.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
