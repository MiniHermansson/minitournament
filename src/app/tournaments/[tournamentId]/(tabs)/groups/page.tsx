import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-utils";
import { getTournament } from "@/lib/tournament-cache";
import { isOrganizer } from "@/lib/organizer-utils";
import { GroupTable } from "@/components/tournament/group-table";
import { GeneratePlayoffBanner } from "@/components/tournament/generate-playoff-banner";

export default async function GroupsPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = await params;
  const [session, tournament, groups] = await Promise.all([
    getSession(),
    getTournament(tournamentId),
    prisma.group.findMany({
      where: { tournamentId },
      include: {
        teams: {
          include: { group: true },
          orderBy: { points: "desc" },
        },
        matches: {
          include: {
            homeTeam: { select: { id: true, name: true, tag: true } },
            awayTeam: { select: { id: true, name: true, tag: true } },
            winner: { select: { id: true, name: true, tag: true } },
          },
          orderBy: [{ round: "asc" }, { position: "asc" }],
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!tournament) notFound();

  // Resolve team names for standings
  const teamIds = groups.flatMap((g) => g.teams.map((t) => t.teamId));
  const teams = await prisma.team.findMany({
    where: { id: { in: teamIds } },
    select: { id: true, name: true, tag: true },
  });
  const teamMap = new Map(teams.map((t) => [t.id, t]));

  const groupsWithTeamInfo = groups.map((group) => ({
    ...group,
    teams: group.teams
      .map((gt) => ({
        ...gt,
        team: teamMap.get(gt.teamId),
      }))
      .sort((a, b) => b.points - a.points || b.wins - a.wins || a.losses - b.losses),
  }));

  const userIsOrganizer = session?.user
    ? isOrganizer(tournament, session.user.id)
    : false;
  const isGroupPlayoff = tournament.format === "GROUP_STAGE_PLAYOFF";
  const allGroupMatchesComplete = groups.every((g) =>
    g.matches.every((m) => m.status === "COMPLETED")
  );

  return (
    <>
      {groups.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">
          Groups not generated yet.
        </p>
      ) : (
        <>
          {userIsOrganizer && isGroupPlayoff && allGroupMatchesComplete && (
            <GeneratePlayoffBanner tournamentId={tournamentId} />
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            {groupsWithTeamInfo.map((group) => (
              <GroupTable
                key={group.id}
                group={group}
                isOrganizer={userIsOrganizer}
                tournamentId={tournamentId}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}
