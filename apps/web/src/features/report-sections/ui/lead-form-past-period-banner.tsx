"use client";

interface LeadFormPastPeriodBannerProps {
  readonly pinnedReportId: string | undefined;
  readonly activeReportId: string;
  readonly isSubmitted: boolean;
}

/**
 * Read-only banner for past periods. Triggered when the page renders under a
 * `[reportId]` segment that points at a past report instead of the lead's
 * active section. Self-suppresses otherwise.
 */
export function LeadFormPastPeriodBanner({
  pinnedReportId,
  activeReportId,
  isSubmitted,
}: LeadFormPastPeriodBannerProps) {
  const isPastPeriod =
    Boolean(pinnedReportId) &&
    activeReportId !== "" &&
    pinnedReportId !== activeReportId &&
    !isSubmitted;
  if (!isPastPeriod) return null;
  return (
    <div className="flex items-center gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-muted)] p-4">
      <span className="text-sm text-[var(--color-muted-foreground)]">
        Viewing past period. This form is read-only.
      </span>
    </div>
  );
}
