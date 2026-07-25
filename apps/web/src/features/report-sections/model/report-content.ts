/**
 * The minimal shape needed to decide whether a product report carries authored
 * content. Both the mapper's `WeeklyProductReport` and the presentation
 * `ProductReport` satisfy it structurally.
 */
export interface ReportContentSummary {
  readonly needsAttention?: string;
  readonly currentWeek: readonly unknown[];
  readonly nextWeek: readonly unknown[];
  readonly risks: readonly unknown[];
  readonly decisions: readonly unknown[];
  readonly priorities: readonly unknown[];
}

/**
 * A product report has content — worth an accordion row and eligible to
 * publish — when it flags needs-attention or carries any authored item, risk,
 * decision, or priority. Single source for the publish gate, the accordion
 * render guard, and the per-lead grouping filter so the three cannot diverge.
  * @param report - The report argument.
 */
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
