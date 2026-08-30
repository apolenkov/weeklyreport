import Link from "next/link";

export function NoSubmissionsEmptyState({
  periodLabel,
}: {
  readonly periodLabel: string;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-empty)] py-16 text-center"
      data-testid="empty-submissions-state"
    >
      <p className="text-base font-semibold text-[var(--color-foreground)]">
        No submissions yet for {periodLabel}
      </p>
      <p className="mt-1.5 text-sm text-[var(--color-muted-foreground)]">
        Leads have not filed their sections for this period.
      </p>
      <Link
        href="/reports"
        className="mt-4 text-sm font-medium text-[var(--color-primary)] underline-offset-4 hover:underline"
      >
        View report history &rarr;
      </Link>
    </div>
  );
}
