export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header skeleton */}
      <div className="sticky top-0 z-30 bg-primary shadow-md">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3.5">
          <div className="h-8 w-8 animate-pulse rounded-lg bg-primary-foreground/10" />
          <div className="h-4 w-32 animate-pulse rounded bg-primary-foreground/10" />
        </div>
      </div>

      <main className="mx-auto max-w-lg px-4">
        {/* Title skeleton */}
        <div className="mt-4 mb-5">
          <div className="h-7 w-48 animate-pulse rounded-lg bg-muted" />
          <div className="mt-2 h-4 w-28 animate-pulse rounded bg-muted" />
        </div>

        {/* Flag skeleton */}
        <div className="h-16 animate-pulse rounded-xl bg-muted" />

        {/* Quick stats skeleton */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>

        {/* Weather card skeleton */}
        <div className="mt-5 h-48 animate-pulse rounded-xl bg-muted" />
        <div className="mt-3 h-12 animate-pulse rounded-xl bg-muted" />
      </main>
    </div>
  )
}
