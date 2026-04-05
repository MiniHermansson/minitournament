import Link from "next/link";
import { getSession } from "@/lib/auth-utils";
import { isOrganizer } from "@/lib/organizer-utils";
import { getActiveTournament } from "@/lib/active-tournament";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/tournament/status-badge";
import { TournamentTabs } from "@/components/tournament/tournament-tabs";
import { NoActiveTournament } from "@/components/tournament/no-active-tournament";
import { prisma } from "@/lib/prisma";

export default async function TabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const tournament = await getActiveTournament();

  if (!tournament) {
    const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(
      (session?.user as Record<string, unknown> | undefined)?.role as string ?? ""
    );
    return <NoActiveTournament isAdmin={isAdmin} />;
  }

  const userIsOrganizer = session?.user
    ? isOrganizer(tournament, session.user.id)
    : false;

  const isCaptainsDraft = tournament.teamMode === "CAPTAINS_DRAFT";
  const isGroupFormat = ["ROUND_ROBIN", "GROUP_STAGE", "GROUP_STAGE_PLAYOFF"].includes(tournament.format);

  // Build tabs
  const tabs = [
    { label: "Overview", href: "/" },
  ];

  if (isGroupFormat && tournament._count.groups > 0) {
    tabs.push({ label: "Groups", href: "/groups" });
  }

  if (tournament._count.brackets > 0) {
    tabs.push({ label: "Bracket", href: "/bracket" });
  }

  tabs.push({ label: "Rules", href: "/rules" });

  if (userIsOrganizer) {
    tabs.push({ label: "Organizer", href: "/manage" });
  }

  // Determine action buttons
  const userTeams = session
    ? await prisma.team.findMany({
        where: { ownerId: session.user.id },
        select: { id: true },
      })
    : [];

  const registeredTeamIds = isCaptainsDraft
    ? new Set<string>()
    : new Set(
        tournament.registrations.map((r) => r.teamId)
      );

  const canRegister =
    !isCaptainsDraft &&
    tournament.status === "REGISTRATION" &&
    session &&
    userTeams.some((t) => !registeredTeamIds.has(t.id));

  const alreadySignedUp =
    isCaptainsDraft && session
      ? tournament.playerSignups.some((s) => s.userId === session.user.id)
      : false;

  const canSignUp =
    isCaptainsDraft &&
    tournament.status === "REGISTRATION" &&
    session &&
    !alreadySignedUp;

  const formatLabels: Record<string, string> = {
    SINGLE_ELIMINATION: "Single Elimination",
    DOUBLE_ELIMINATION: "Double Elimination",
    ROUND_ROBIN: "Round Robin",
    GROUP_STAGE: "Group Stage",
    GROUP_STAGE_PLAYOFF: "Groups + Playoff",
  };

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
              href="/register-team"
              className={buttonVariants()}
            >
              Register Team
            </Link>
          )}
          {canSignUp && (
            <Link
              href="/signup"
              className={buttonVariants()}
            >
              Sign Up
            </Link>
          )}
          {alreadySignedUp && (
            <Badge
              variant="outline"
              className="bg-green-500/15 text-green-400 border-green-500/30"
            >
              Signed Up
            </Badge>
          )}
          {tournament.status === "DRAFTING" && (
            <Link
              href="/draft"
              className={buttonVariants({ variant: "secondary" })}
            >
              Watch Draft
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

      <TournamentTabs tabs={tabs} />

      {children}
    </div>
  );
}
