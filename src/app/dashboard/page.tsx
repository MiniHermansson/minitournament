import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <p className="mt-2 text-muted-foreground">
        Welcome back, {session.user.name}!
      </p>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border bg-card p-6">
          <h2 className="font-semibold">My Teams</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            No teams yet. Create one to get started.
          </p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <h2 className="font-semibold">My Tournaments</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            No tournaments yet.
          </p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <h2 className="font-semibold">Upcoming Matches</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            No upcoming matches.
          </p>
        </div>
      </div>
    </div>
  );
}
