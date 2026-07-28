export function JobsSkeleton() {
  return (
    <div
      className="rounded-[var(--radius)] border border-[var(--color-border)]"
      data-testid="jobs-loading-state"
      role="status"
      aria-label="Loading failed jobs"
      aria-live="polite"
    >
      <div className="grid grid-cols-6 gap-4 border-b border-[var(--color-border)] bg-[var(--color-background)] px-4 py-3">
        {Array.from({ length: 6 }, (_, col) => (
          <div
            key={col}
            className="h-4 w-20 animate-pulse rounded bg-[var(--color-border)]"
          />
        ))}
      </div>
      {Array.from({ length: 4 }, (_, row) => (
        <div
          key={row}
          className="grid grid-cols-6 gap-4 border-b border-[var(--color-border)] px-4 py-3 last:border-0"
        >
          {Array.from({ length: 6 }, (_, col) => (
            <div
              key={col}
              className="h-4 w-full animate-pulse rounded bg-[var(--color-border)]"
            />
          ))}
        </div>
      ))}
    </div>
  );
}
