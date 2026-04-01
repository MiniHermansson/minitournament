export default function TournamentDetailLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="animate-pulse space-y-2 mb-6">
        <div className="h-8 w-64 bg-muted rounded" />
        <div className="h-5 w-40 bg-muted rounded" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border bg-card p-6 animate-pulse">
            <div className="h-4 w-20 bg-muted rounded mb-2" />
            <div className="h-8 w-16 bg-muted rounded" />
          </div>
        ))}
      </div>
      <div className="h-px bg-border mb-6" />
      <div className="rounded-lg border bg-card p-6 animate-pulse">
        <div className="h-5 w-40 bg-muted rounded mb-4" />
        <div className="space-y-3">
          <div className="h-14 bg-muted rounded" />
          <div className="h-14 bg-muted rounded" />
          <div className="h-14 bg-muted rounded" />
        </div>
      </div>
    </div>
  );
}
