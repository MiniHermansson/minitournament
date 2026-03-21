export default function TeamDetailLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="animate-pulse space-y-2 mb-6">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="h-5 w-24 bg-muted rounded" />
      </div>
      <div className="rounded-lg border bg-card p-6 animate-pulse">
        <div className="h-5 w-32 bg-muted rounded mb-4" />
        <div className="space-y-3">
          <div className="h-12 bg-muted rounded" />
          <div className="h-12 bg-muted rounded" />
          <div className="h-12 bg-muted rounded" />
        </div>
      </div>
    </div>
  );
}
