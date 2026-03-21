import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-utils";
import { buttonVariants } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { RosterTable } from "@/components/team/roster-table";

export default async function TeamProfilePage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const session = await getSession();

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      owner: { select: { id: true, name: true, image: true, email: true } },
      members: {
        include: {
          user: { select: { id: true, name: true, image: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!team) notFound();

  const isOwner = session?.user?.id === team.ownerId;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            {team.logoUrl && <AvatarImage src={team.logoUrl} alt={team.name} />}
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl">
              {team.tag}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-3xl font-bold">{team.name}</h1>
            <p className="text-muted-foreground">[{team.tag}]</p>
          </div>
        </div>
        {isOwner && (
          <Link
            href={`/teams/${team.id}/manage`}
            className={buttonVariants({ variant: "outline" })}
          >
            Manage Team
          </Link>
        )}
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <span>Owner:</span>
        <Avatar className="h-5 w-5">
          <AvatarImage src={team.owner.image ?? undefined} />
          <AvatarFallback className="text-xs">
            {team.owner.name?.[0]?.toUpperCase() ?? "?"}
          </AvatarFallback>
        </Avatar>
        <span>{team.owner.name ?? team.owner.email}</span>
      </div>

      <Separator className="mb-6" />

      <Card>
        <CardHeader>
          <CardTitle>Roster ({team.members.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <RosterTable members={team.members} isOwner={false} />
        </CardContent>
      </Card>
    </div>
  );
}
