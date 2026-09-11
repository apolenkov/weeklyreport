import Link from "next/link";

export function ReportEmptyState({
  periodLabel,
  submissionCount,
}: {
  readonly periodLabel: string;
  readonly submissionCount: number;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-empty)] py-16 text-center"
      data-testid="empty-report-state"
    >
      <p className="text-base font-semibold text-[var(--color-foreground)]">
        No report content for {periodLabel}
      </p>
      <p className="mt-1.5 text-sm text-[var(--color-muted-foreground)]">
        {submissionCount > 0
          ? "Submitted sections contain no report content."
          : "No sections have been submitted for this period."}
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
