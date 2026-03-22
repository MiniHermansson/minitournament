import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { getSession } from "@/lib/auth-utils";

export default async function HomePage() {
  const session = await getSession();
  return (
    <div className="flex flex-col">
      <section className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-24 text-center">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            <span className="bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 bg-clip-text text-transparent">
              MiniTournament
            </span>
          </h1>
          <p className="mx-auto max-w-xl text-lg text-muted-foreground">
            Create and manage League of Legends tournaments. Set up brackets,
            round robin, group stages, and more.
          </p>
        </div>

        <div className="flex gap-4">
          <Link href="/tournaments" className={buttonVariants({ size: "lg" })}>
            Browse Tournaments
          </Link>
          {!session && (
            <Link href="/register" className={buttonVariants({ size: "lg", variant: "outline" })}>
              Get Started
            </Link>
          )}
        </div>

        <div className="mt-16 grid gap-8 sm:grid-cols-3 max-w-3xl w-full">
          <div className="space-y-2 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500/10">
              <svg className="h-6 w-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="font-semibold">Multiple Formats</h3>
            <p className="text-sm text-muted-foreground">
              Single & double elimination, round robin, group stages, and playoffs.
            </p>
          </div>
          <div className="space-y-2 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500/10">
              <svg className="h-6 w-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="font-semibold">Team Management</h3>
            <p className="text-sm text-muted-foreground">
              Create teams, manage rosters with LoL roles, and register for events.
            </p>
          </div>
          <div className="space-y-2 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500/10">
              <svg className="h-6 w-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="font-semibold">Live Brackets</h3>
            <p className="text-sm text-muted-foreground">
              Interactive bracket views with real-time results and standings.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
