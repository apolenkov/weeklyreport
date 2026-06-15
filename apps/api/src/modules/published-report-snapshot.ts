import {
  type AssembledReport,
  assembledReportSchema,
  type Escalation,
  type PortfolioOverview,
  type PortfolioProductOverview,
  type ReportSectionReadModel,
} from "@customreport/shared";
import type { Prisma } from "@prisma/client";

import {
  mapPrismaToReportSection,
  reportSectionFullInclude,
} from "./report-sections/report-sections.prisma-repository";

export const reportFullIncludeForSnapshot = {
  sections: { include: reportSectionFullInclude },
  publishedBy: true,
} as const;

interface SnapshotSectionRow {
  id: string;
  projectStatuses: { status: string | null }[];
}

interface SnapshotReportRow {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  deadline: Date;
  status: string;
  publishedAt: Date | null;
  publishedById: string | null;
  publishedBy: { name: string } | null;
  sections: SnapshotSectionRow[];
}

export function buildAssembledReportFromPrismaRow(
  row: SnapshotReportRow,
): AssembledReport {
  const sections = row.sections.map((section) =>
    mapPrismaToReportSection(
      section as unknown as Parameters<typeof mapPrismaToReportSection>[0],
    ),
  );
  const portfolioOverview = computePortfolioOverviewFromProjectStatuses(
    row.sections,
  );

  return assembledReportSchema.parse({
    reportId: row.id,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    deadline: row.deadline,
    status: row.status,
    publishedAt: row.publishedAt,
    publishedById: row.publishedById,
    publishedByName: row.publishedBy?.name ?? null,
    portfolioOverview,
    sections,
  });
}

export function toPublishedSnapshotJson(
  report: AssembledReport,
): Prisma.InputJsonValue {
  const parsed = assembledReportSchema.parse(report);
  return JSON.parse(JSON.stringify(parsed)) as Prisma.InputJsonValue;
}

export function parsePublishedSnapshot(
  value: Prisma.JsonValue | null | undefined,
): AssembledReport | null {
  if (value == null) return null;
  return assembledReportSchema.parse(value);
}

export function filterSnapshotSections(
  snapshot: AssembledReport,
  allowedSectionIds: ReadonlySet<string> | undefined,
): AssembledReport {
  if (!allowedSectionIds) return snapshot;

  const sections = snapshot.sections.filter((section) =>
    allowedSectionIds.has(section.reportSectionId),
  );

  return assembledReportSchema.parse({
    ...snapshot,
    portfolioOverview: computePortfolioOverviewFromReadSections(sections),
    sections,
  });
}

export function computePortfolioOverviewFromReadSections(
  sections: readonly ReportSectionReadModel[],
): PortfolioOverview {
  const totals = { green: 0, yellow: 0, red: 0 };

  for (const section of sections) {
    for (const project of section.projects) {
      const status = project.trafficLight;
      if (status === "green" || status === "yellow" || status === "red") {
        totals[status]++;
      }
    }
  }

  const status: PortfolioOverview["status"] =
    totals.red > 0 ? "red" : totals.yellow > 0 ? "yellow" : "green";

  return { status, totals };
}

type TrafficLightStatus = "green" | "yellow" | "red";

export function buildPortfolioProductsFromSnapshotSections(
  sections: readonly ReportSectionReadModel[],
): PortfolioProductOverview[] {
  const byProduct = new Map<
    string,
    {
      productId: string;
      productName: string;
      statuses: TrafficLightStatus[];
      stageCount: number;
      leadNames: Set<string>;
    }
  >();

  for (const section of sections) {
    for (const project of section.projects) {
      const current = byProduct.get(project.projectId) ?? {
        productId: project.projectId,
        productName: project.projectName,
        statuses: [],
        stageCount: 0,
        leadNames: new Set<string>(),
      };

      current.stageCount = Math.max(
        current.stageCount,
        project.ownedStages?.length ?? 0,
      );

      if (
        project.trafficLight === "green" ||
        project.trafficLight === "yellow" ||
        project.trafficLight === "red"
      ) {
        current.statuses.push(project.trafficLight);
        current.leadNames.add(section.authorName);
      }

      byProduct.set(project.projectId, current);
    }
  }

  return [...byProduct.values()]
    .map((product) => ({
      productId: product.productId,
      productName: product.productName,
      worstStatus: computeWorstStatus(product.statuses),
      stageCount: product.stageCount,
      leadNames: [...product.leadNames].sort((a, b) =>
        a.localeCompare(b, "ru"),
      ),
    }))
    .sort((a, b) => a.productName.localeCompare(b.productName, "ru"));
}

const UNKNOWN_PRODUCT_NAME = "Unknown";
const STAGE_NAME_SEPARATOR = ", ";

/**
 * Joins all stage names carried by a row into a multi-stage display label,
 * or null for legacy stage-less rows. `stageIds` is a misnomer — it holds
 * stage NAMES, not UUIDs (see TODO(STAGE-NAMING-01) in report-primitives).
 */
function resolveStageName(
  stageIds: readonly string[] | undefined,
): string | null {
  if (!stageIds || stageIds.length === 0) return null;
  return stageIds.join(STAGE_NAME_SEPARATOR);
}

/**
 * The single Blocked-&-At-Risk builder for BOTH the live and published-
 * snapshot paths. Both feed `ReportSectionReadModel[]`: the live path maps
 * Prisma rows via `mapPrismaToReportSection` first; the snapshot path reads
 * the persisted read model directly. Sharing one function guarantees
 * byte-identical stage/product output across the two surfaces (W7/W8 parity).
 *
 * Product names resolve report-wide WITHIN the caller's authorized read
 * model: `section.projects` (stage-owned) plus `section.referencedProjects`
 * (rows referencing a product the author owns no stage on). No unscoped
 * `prisma.project` query — that would leak products outside the caller's
 * scope (W8).
 */
export function buildEscalationsFromReadSections(
  sections: readonly ReportSectionReadModel[],
): Escalation[] {
  const escalations: Escalation[] = [];

  for (const section of sections) {
    const productNames = new Map(
      [...section.projects, ...(section.referencedProjects ?? [])].map(
        (project) => [project.projectId, project.projectName],
      ),
    );

    for (const item of section.items) {
      if (item.workflowStatus !== "blocked") continue;
      escalations.push({
        type: "blocked",
        productName: productNames.get(item.projectId) ?? UNKNOWN_PRODUCT_NAME,
        stageName: resolveStageName(item.stageIds),
        leadName: section.authorName,
        description: item.text,
      });
    }

    for (const project of section.projects) {
      if (project.trafficLight !== "red") continue;
      escalations.push({
        type: "at_risk",
        productName: project.projectName,
        stageName: null,
        leadName: section.authorName,
        description: `Project ${project.projectName} is flagged red.`,
      });
    }

    for (const risk of section.risks) {
      escalations.push({
        type: "unresolved_risk",
        productName: productNames.get(risk.projectId) ?? UNKNOWN_PRODUCT_NAME,
        stageName: resolveStageName(risk.stageIds),
        leadName: section.authorName,
        description: risk.risk,
      });
    }
  }

  return escalations;
}

function computePortfolioOverviewFromProjectStatuses(
  sections: readonly {
    projectStatuses: readonly { status: string | null }[];
  }[],
): PortfolioOverview {
  const totals = { green: 0, yellow: 0, red: 0 };

  for (const section of sections) {
    for (const projectStatus of section.projectStatuses) {
      const status = projectStatus.status;
      if (status === "green" || status === "yellow" || status === "red") {
        totals[status]++;
      }
    }
  }

  const status: PortfolioOverview["status"] =
    totals.red > 0 ? "red" : totals.yellow > 0 ? "yellow" : "green";

  return { status, totals };
}

const statusSeverity: Record<TrafficLightStatus, number> = {
  green: 0,
  yellow: 1,
  red: 2,
};

function computeWorstStatus(
  statuses: readonly TrafficLightStatus[],
): TrafficLightStatus | null {
  if (statuses.length === 0) return null;

  let worst: TrafficLightStatus = "green";
  for (const status of statuses) {
    if (statusSeverity[status] > statusSeverity[worst]) {
      worst = status;
    }
  }
  return worst;
}
