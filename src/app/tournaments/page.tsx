import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-utils";
import { buttonVariants } from "@/components/ui/button";
import { TournamentCard } from "@/components/tournament/tournament-card";

export default async function TournamentsPage() {
  const session = await getSession();

  const tournaments = await prisma.tournament.findMany({
    include: {
      organizer: { select: { id: true, name: true, image: true } },
      _count: { select: { registrations: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Tournaments</h1>
          <p className="text-muted-foreground mt-1">
            Browse and join tournaments
          </p>
        </div>
        {session && (
          <Link href="/tournaments/new" className={buttonVariants()}>
            Create Tournament
          </Link>
        )}
      </div>

      {tournaments.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">
          No tournaments yet. Create the first one!
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tournaments.map((t) => (
            <TournamentCard key={t.id} tournament={{
              ...t,
              startDate: t.startDate?.toISOString() ?? null,
            }} />
          ))}
        </div>
      )}
    </div>
  );
}
