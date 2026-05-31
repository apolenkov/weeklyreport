export function SlideSkeleton() {
  return (
    <div
      className="space-y-5"
      role="status"
      aria-busy="true"
      aria-label="Loading slides"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="h-7 w-56 animate-pulse rounded-[var(--radius)] bg-[var(--color-muted)]" />
          <div className="h-4 w-96 max-w-full animate-pulse rounded-[var(--radius)] bg-[var(--color-muted)]" />
        </div>
        <div className="h-8 w-32 animate-pulse rounded-[var(--radius-pill)] bg-[var(--color-muted)]" />
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(220px,300px)_1fr]">
        <div className="hidden space-y-2 lg:block">
          {[0, 1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-24 animate-pulse rounded-[var(--radius)] bg-[var(--color-muted)]"
            />
          ))}
        </div>
        <div className="h-[460px] animate-pulse rounded-[var(--radius)] bg-[var(--color-muted)]" />
      </div>
    </div>
  );
}
