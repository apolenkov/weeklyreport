// Structural minimum for the content check: both the mapper's
// `WeeklyProductReport` and the presentation `ProductReport` satisfy it.
export interface ReportContentSummary {
  readonly needsAttention?: string;
  readonly currentWeek: readonly unknown[];
  readonly nextWeek: readonly unknown[];
  readonly risks: readonly unknown[];
  readonly decisions: readonly unknown[];
  readonly priorities: readonly unknown[];
}

// Single source for the publish gate, the accordion render guard, and the
// per-lead grouping filter, so the three cannot diverge on what "has content"
// means.
export function reportHasContent(report: ReportContentSummary): boolean {
  return (
    Boolean(report.needsAttention) ||
    report.currentWeek.length > 0 ||
    report.nextWeek.length > 0 ||
    report.risks.length > 0 ||
    report.decisions.length > 0 ||
    report.priorities.length > 0
  );
}
