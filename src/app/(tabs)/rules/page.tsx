import { getSession } from "@/lib/auth-utils";
import { getActiveTournament } from "@/lib/active-tournament";
import { isOrganizer } from "@/lib/organizer-utils";
import { RulesEditor } from "@/components/tournament/rules-editor";

export default async function RulesPage() {
  const [session, tournament] = await Promise.all([
    getSession(),
    getActiveTournament(),
  ]);

  if (!tournament) return null;

  const userIsOrganizer = session?.user
    ? isOrganizer(tournament, session.user.id)
    : false;

  return (
    <RulesEditor
      tournamentId={tournament.id}
      rules={tournament.rules ?? null}
      isOrganizer={userIsOrganizer}
    />
  );
}
