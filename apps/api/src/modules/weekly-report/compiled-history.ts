import {
  type AssembledReport,
  type CompiledHistoryEntry,
} from "@customreport/shared";

// Display sentinel when publisher is missing from the read model.
const UNKNOWN_PUBLISHER_NAME = "Unknown";

// Frozen, already-scoped report shape keeps compiled-history projection
// independent of Prisma query types.
export interface CompiledHistoryReportRow {
  readonly archived: boolean;
  readonly reopened: boolean;
  readonly snapshot: AssembledReport;
}

function foldReportEntry(
  report: CompiledHistoryReportRow,
): CompiledHistoryEntry {
  const { snapshot } = report;
  const items = snapshot.sections.flatMap((section) => section.items);
  const risks = snapshot.sections.flatMap((section) => section.risks);
  const decisions = snapshot.sections.flatMap((section) => section.decisions);

  // Activity-parented rows carry a null product FK and contribute no product id.
  const productIds = new Set([
    ...snapshot.sections.flatMap((section) =>
      section.projects.map(({ projectId }) => projectId),
    ),
    ...items.flatMap((row) => (row.projectId ? [row.projectId] : [])),
    ...risks.flatMap((row) => (row.projectId ? [row.projectId] : [])),
    ...decisions.flatMap((row) => (row.productId ? [row.productId] : [])),
  ]);

  return {
    reportId: snapshot.reportId,
    periodStart: snapshot.periodStart,
    periodEnd: snapshot.periodEnd,
    publishedAt: snapshot.publishedAt,
    archived: report.archived,
    reopened: report.reopened,
    publishedByName: snapshot.publishedByName ?? UNKNOWN_PUBLISHER_NAME,
    trafficLights: snapshot.portfolioOverview.totals,
    itemCount: items.length,
    riskCount: risks.length,
    decisionCount: decisions.length,
    priorityCount: items.filter((i) => i.priorityRank != null).length,
    sectionCount: snapshot.sections.length,
    productCount: productIds.size,
  };
}

export function buildCompiledHistoryEntries(
  reports: readonly CompiledHistoryReportRow[],
): CompiledHistoryEntry[] {
  return reports
    .filter((report) => report.snapshot.sections.length > 0)
    .map(foldReportEntry);
}
