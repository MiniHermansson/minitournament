import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { TeamCard } from "@/components/team/team-card";
import { getSession } from "@/lib/auth-utils";

export default async function TeamsPage() {
  const session = await getSession();

  const teams = await prisma.team.findMany({
    include: {
      owner: { select: { id: true, name: true, image: true } },
      _count: { select: { members: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Teams</h1>
          <p className="text-muted-foreground mt-1">Browse all teams</p>
        </div>
        {session && (
          <Link href="/teams/new" className={buttonVariants()}>
            Create Team
          </Link>
        )}
      </div>

      {teams.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">
          No teams yet. Be the first to create one!
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <TeamCard key={team.id} team={team} />
          ))}
        </div>
      )}
    </div>
  );
}
