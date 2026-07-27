import {
  type MyHistoryEntry,
  myHistoryEntrySchema,
  type ReportSectionStatus,
  type ReportStatus,
  type TrafficLightStatus,
} from "@customreport/shared";

// Prisma-free row shape for myHistory (service must not import @prisma/client).
export interface MyHistorySectionRow {
  readonly id: string;
  readonly status: ReportSectionStatus;
  readonly submittedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly report: {
    readonly id: string;
    readonly periodStart: Date;
    readonly periodEnd: Date;
    readonly status: ReportStatus;
    readonly archived: boolean;
    readonly publishedAt: Date | null;
  };
  readonly items: readonly {
    readonly projectId: string | null;
    readonly updatedAt: Date;
    readonly priorityRank: number | null;
  }[];
  readonly risks: readonly {
    readonly projectId: string | null;
    readonly updatedAt: Date;
  }[];
  readonly decisions: readonly {
    readonly productId: string | null;
    readonly updatedAt: Date;
  }[];
  readonly projectStatuses: readonly {
    readonly projectId: string;
    readonly status: TrafficLightStatus | null;
    readonly updatedAt: Date;
  }[];
  readonly stageStatuses: readonly {
    readonly projectId: string;
    readonly updatedAt: Date;
  }[];
}

function countTrafficLights(s: MyHistorySectionRow): {
  green: number;
  yellow: number;
  red: number;
} {
  return s.projectStatuses.reduce(
    (acc, row) => ({
      green: acc.green + (row.status === "green" ? 1 : 0),
      yellow: acc.yellow + (row.status === "yellow" ? 1 : 0),
      red: acc.red + (row.status === "red" ? 1 : 0),
    }),
    { green: 0, yellow: 0, red: 0 },
  );
}

// Activity-parented rows carry null product FK — no product-id count.
function countDistinctProducts(s: MyHistorySectionRow): number {
  return new Set([
    ...s.projectStatuses.map((row) => row.projectId),
    ...s.stageStatuses.map((row) => row.projectId),
    ...s.items.flatMap((row) => (row.projectId ? [row.projectId] : [])),
    ...s.risks.flatMap((row) => (row.projectId ? [row.projectId] : [])),
    ...s.decisions.flatMap((row) => (row.productId ? [row.productId] : [])),
  ]).size;
}

// Newest touch across the section itself and every child row it owns.
function resolveLastEditAt(s: MyHistorySectionRow): Date {
  return [
    s.updatedAt,
    ...s.items.map((row) => row.updatedAt),
    ...s.risks.map((row) => row.updatedAt),
    ...s.decisions.map((row) => row.updatedAt),
    ...s.projectStatuses.map((row) => row.updatedAt),
    ...s.stageStatuses.map((row) => row.updatedAt),
  ].reduce((latest, date) => (date > latest ? date : latest), s.updatedAt);
}

function toHistoryEntry(s: MyHistorySectionRow) {
  return {
    sectionId: s.id,
    reportId: s.report.id,
    periodStart: s.report.periodStart,
    periodEnd: s.report.periodEnd,
    reportStatus: s.report.status,
    sectionStatus: s.status,
    archived: s.report.archived,
    submittedAt: s.submittedAt,
    publishedAt: s.report.publishedAt,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    lastEditAt: resolveLastEditAt(s),
    itemCount: s.items.length,
    riskCount: s.risks.length,
    decisionCount: s.decisions.length,
    priorityCount: s.items.filter((i) => i.priorityRank != null).length,
    productCount: countDistinctProducts(s),
    trafficLights: countTrafficLights(s),
  };
}

export function buildMyHistoryEntries(
  sections: readonly MyHistorySectionRow[],
): MyHistoryEntry[] {
  return myHistoryEntrySchema.array().parse(sections.map(toHistoryEntry));
}
