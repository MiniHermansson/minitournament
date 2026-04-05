import { getSession } from "@/lib/auth-utils";
import { isOrganizer } from "@/lib/organizer-utils";
import { getActiveTournament } from "@/lib/active-tournament";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SignupList } from "@/components/tournament/signup-list";

export default async function OverviewPage() {
  const session = await getSession();
  const tournament = await getActiveTournament();
  if (!tournament) return null;

  const userIsOrganizer = session?.user
    ? isOrganizer(tournament, session.user.id)
    : false;
  const isCaptainsDraft = tournament.teamMode === "CAPTAINS_DRAFT";

  return (
    <>
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
            <p className="text-2xl font-bold">
              {tournament.teamSize}v{tournament.teamSize}
            </p>
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
              isOrganizer={userIsOrganizer}
              canRemove={tournament.status === "REGISTRATION"}
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
    </>
  );
}
