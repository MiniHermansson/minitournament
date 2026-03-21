export default function DashboardLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="animate-pulse space-y-2 mb-8">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="h-5 w-64 bg-muted rounded" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border bg-card p-6 space-y-4">
            <div className="h-5 w-32 bg-muted rounded animate-pulse" />
            <div className="space-y-3">
              <div className="h-14 bg-muted rounded animate-pulse" />
              <div className="h-14 bg-muted rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
