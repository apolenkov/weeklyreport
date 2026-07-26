import {
  type CompiledHistoryEntry,
  type TrafficLightStatus,
} from "@customreport/shared";

// Display sentinel when publisher is missing from the read model.
const UNKNOWN_PUBLISHER_NAME = "Unknown";

// Raw report shape for getCompiledHistory; kept Prisma-free so Zone-4b
// weekly-report.service never imports @prisma/client.
export interface CompiledHistoryReportRow {
  readonly id: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly publishedAt: Date | null;
  readonly archived: boolean;
  readonly publishedBy: { readonly name: string } | null;
  readonly sections: readonly {
    readonly items: readonly {
      readonly projectId: string | null;
      readonly priorityRank: number | null;
    }[];
    readonly risks: readonly { readonly projectId: string | null }[];
    readonly decisions: readonly { readonly productId: string | null }[];
    readonly projectStatuses: readonly {
      readonly projectId: string;
      readonly status: TrafficLightStatus | null;
    }[];
    readonly stageStatuses: readonly { readonly projectId: string }[];
  }[];
}

function foldReportEntry(
  report: CompiledHistoryReportRow,
): CompiledHistoryEntry {
  const projectStatuses = report.sections.flatMap((s) => s.projectStatuses);
  const items = report.sections.flatMap((s) => s.items);
  const risks = report.sections.flatMap((s) => s.risks);
  const decisions = report.sections.flatMap((s) => s.decisions);
  const stageStatuses = report.sections.flatMap((s) => s.stageStatuses);

  const trafficLights = projectStatuses.reduce(
    (acc, row) => ({
      green: acc.green + (row.status === "green" ? 1 : 0),
      yellow: acc.yellow + (row.status === "yellow" ? 1 : 0),
      red: acc.red + (row.status === "red" ? 1 : 0),
    }),
    { green: 0, yellow: 0, red: 0 },
  );

  // Activity-parented rows carry a null product FK and contribute no product id.
  const productIds = new Set([
    ...projectStatuses.map((row) => row.projectId),
    ...stageStatuses.map((row) => row.projectId),
    ...items.flatMap((row) => (row.projectId ? [row.projectId] : [])),
    ...risks.flatMap((row) => (row.projectId ? [row.projectId] : [])),
    ...decisions.flatMap((row) => (row.productId ? [row.productId] : [])),
  ]);

  return {
    reportId: report.id,
    periodStart: report.periodStart,
    periodEnd: report.periodEnd,
    publishedAt: report.publishedAt,
    archived: report.archived,
    publishedByName: report.publishedBy?.name ?? UNKNOWN_PUBLISHER_NAME,
    trafficLights,
    itemCount: items.length,
    riskCount: risks.length,
    decisionCount: decisions.length,
    priorityCount: items.filter((i) => i.priorityRank != null).length,
    sectionCount: report.sections.length,
    productCount: productIds.size,
  };
}

export function buildCompiledHistoryEntries(
  reports: readonly CompiledHistoryReportRow[],
): CompiledHistoryEntry[] {
  return reports
    .filter((report) => report.sections.length > 0)
    .map(foldReportEntry);
}
