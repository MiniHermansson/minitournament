import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-utils";
import { getActiveTournament } from "@/lib/active-tournament";
import { isOrganizer } from "@/lib/organizer-utils";
import { BracketView } from "@/components/tournament/bracket-view";

export default async function BracketPage() {
  const tournament = await getActiveTournament();
  if (!tournament) return null;

  const tournamentId = tournament.id;
  const [session, brackets] = await Promise.all([
    getSession(),
    prisma.bracket.findMany({
      where: { tournamentId },
      include: {
        matches: {
          include: {
            homeTeam: { select: { id: true, name: true, tag: true } },
            awayTeam: { select: { id: true, name: true, tag: true } },
            winner: { select: { id: true, name: true, tag: true } },
            games: { orderBy: { gameNumber: "asc" } },
          },
          orderBy: [{ round: "asc" }, { position: "asc" }],
        },
      },
      orderBy: { type: "asc" },
    }),
  ]);

  const userIsOrganizer = session?.user
    ? isOrganizer(tournament, session.user.id)
    : false;

  return (
    <>
      {brackets.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">
          Bracket not generated yet.
        </p>
      ) : (
        <BracketView
          brackets={brackets}
          isOrganizer={userIsOrganizer}
          tournamentId={tournamentId}
        />
      )}
    </>
  );
}
