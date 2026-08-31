// Structural minimum for the content check: both the mapper's
// `WeeklyProductReport` and the presentation `ProductReport` satisfy it.
export interface ReportContentSummary {
  readonly needsAttention?: string | undefined;
  readonly currentWeek: readonly unknown[];
  readonly nextWeek: readonly unknown[];
  readonly risks: readonly unknown[];
  readonly decisions: readonly unknown[];
  readonly priorities: readonly unknown[];
}

// Single source for accordion visibility, focused-product selection, and
// per-lead grouping so those views cannot diverge on what "has content" means.
export function reportHasContent(report: ReportContentSummary): boolean {
  return (
    (report.needsAttention?.trim().length ?? 0) > 0 ||
    report.currentWeek.length > 0 ||
    report.nextWeek.length > 0 ||
    report.risks.length > 0 ||
    report.decisions.length > 0 ||
    report.priorities.length > 0
  );
}
