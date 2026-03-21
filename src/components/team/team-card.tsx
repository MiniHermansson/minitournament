import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface TeamCardProps {
  team: {
    id: string;
    name: string;
    tag: string;
    logoUrl: string | null;
    owner: { name: string | null; image: string | null };
    _count: { members: number };
  };
}

export function TeamCard({ team }: TeamCardProps) {
  return (
    <Link href={`/teams/${team.id}`}>
      <Card className="transition-colors hover:bg-muted/50 h-full">
        <CardHeader className="flex flex-row items-center gap-3 pb-2">
          <Avatar className="h-10 w-10">
            {team.logoUrl && <AvatarImage src={team.logoUrl} alt={team.name} />}
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
              {team.tag}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <CardTitle className="text-base truncate">{team.name}</CardTitle>
            <p className="text-xs text-muted-foreground">[{team.tag}]</p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{team._count.members} member{team._count.members !== 1 ? "s" : ""}</span>
            <span>Owner: {team.owner.name ?? "Unknown"}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
