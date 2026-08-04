"use client";

interface LeadFormPastPeriodBannerProps {
  readonly pinnedReportId: string | undefined;
  readonly activeReportId: string | null;
  readonly isSubmitted: boolean;
}

// Shows when the [reportId] segment is not the active report.
export function LeadFormPastPeriodBanner({
  pinnedReportId,
  activeReportId,
  isSubmitted,
}: LeadFormPastPeriodBannerProps) {
  const isPastPeriod =
    Boolean(pinnedReportId) &&
    activeReportId !== null &&
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
