import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth-utils";
import { getTournament } from "@/lib/tournament-cache";
import { isOrganizer } from "@/lib/organizer-utils";
import { RulesEditor } from "@/components/tournament/rules-editor";

export default async function RulesPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = await params;
  const [session, tournament] = await Promise.all([
    getSession(),
    getTournament(tournamentId),
  ]);

  if (!tournament) notFound();

  const userIsOrganizer = session?.user
    ? isOrganizer(tournament, session.user.id)
    : false;

  return (
    <RulesEditor
      tournamentId={tournamentId}
      rules={tournament.rules ?? null}
      isOrganizer={userIsOrganizer}
    />
  );
}
