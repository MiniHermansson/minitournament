import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

interface NoActiveTournamentProps {
  isAdmin: boolean;
}

export function NoActiveTournament({ isAdmin }: NoActiveTournamentProps) {
  return (
    <div className="container mx-auto px-4 py-24 text-center">
      <h1 className="text-3xl font-bold mb-4">No Active Tournament</h1>
      <p className="text-muted-foreground mb-8 max-w-md mx-auto">
        There is no tournament running right now. Check back soon!
      </p>
      {isAdmin && (
        <Link
          href="/admin/tournament/new"
          className={buttonVariants()}
        >
          Create Tournament
        </Link>
      )}
    </div>
  );
}
