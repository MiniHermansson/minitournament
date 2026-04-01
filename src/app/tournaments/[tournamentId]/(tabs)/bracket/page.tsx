import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-utils";
import { getTournament } from "@/lib/tournament-cache";
import { isOrganizer } from "@/lib/organizer-utils";
import { BracketView } from "@/components/tournament/bracket-view";

export default async function BracketPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = await params;
  const [session, tournament, brackets] = await Promise.all([
    getSession(),
    getTournament(tournamentId),
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

  if (!tournament) notFound();

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
