/**
 * Loading skeleton shown while authenticated app routes fetch data.
 * Replaces a blank flash with a polished placeholder.
 */
export default function AppLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-muted mb-8 h-9 w-64 animate-pulse rounded-full" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="border-border bg-card h-32 animate-pulse rounded-xl border" />
        ))}
      </div>
      <div className="mt-12">
        <div className="bg-muted mb-4 h-7 w-48 animate-pulse rounded-full" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="border-border bg-card h-36 animate-pulse rounded-xl border" />
          ))}
        </div>
      </div>
    </div>
  );
}
