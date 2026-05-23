/**
 * Loading skeleton shown while authenticated app routes fetch data.
 * Replaces a blank flash with a polished placeholder.
 */
export default function AppLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 h-9 w-64 animate-pulse rounded bg-neutral-200" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-xl border border-neutral-200 bg-white"
          />
        ))}
      </div>
      <div className="mt-12">
        <div className="mb-4 h-7 w-48 animate-pulse rounded bg-neutral-200" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-36 animate-pulse rounded-xl border border-neutral-200 bg-white"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
