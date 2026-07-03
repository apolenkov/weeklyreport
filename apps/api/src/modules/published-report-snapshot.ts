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
  deriveEffectiveProductStatus,
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
  // fix-published-empty-stage-risk-floor (D3 / blind-spot #7): compute the
  // top-line portfolio totals from the floored `trafficLight` of the mapped
  // sections, NOT from raw `projectStatuses`. The mapper already floors each
  // product card by the author's own covering risks; counting the same source
  // keeps the per-product cards and the top-line totals in agreement inside the
  // same snapshot.
  const portfolioOverview = computePortfolioOverviewFromReadSections(sections);

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

/**
 * fix-published-empty-stage-risk-floor: the read-model snapshot readers receive
 * `ReportSectionReadModel`s directly (the persisted read model, or a
 * schema-built fixture) and must NOT trust the stored `project.trafficLight` —
 * it can be a stale green that predates the author's own covering risk. Fold
 * the section author's own risks (scoped to the product) over the owned stages
 * the same way the mapper does, so the snapshot readers agree with the PDF and
 * slide surfaces. Idempotent: re-flooring an already-floored trafficLight is a
 * no-op.
 */
function effectiveProjectStatus(
  section: ReportSectionReadModel,
  project: ReportSectionReadModel["projects"][number],
): TrafficLightStatus | null {
  return deriveEffectiveProductStatus({
    projectId: project.projectId,
    trafficLight: project.trafficLight,
    ownedStages: project.ownedStages,
    risks: section.risks,
  });
}

export function computePortfolioOverviewFromReadSections(
  sections: readonly ReportSectionReadModel[],
): PortfolioOverview {
  const totals = { green: 0, yellow: 0, red: 0 };

  for (const section of sections) {
    for (const project of section.projects) {
      const status = effectiveProjectStatus(section, project);
      if (status === "green" || status === "yellow" || status === "red") {
        totals[status]++;
      }
    }
  }

  const status: PortfolioOverview["status"] =
    totals.red > 0 ? "red" : totals.yellow > 0 ? "yellow" : "green";

  return { status, totals };
}

export type TrafficLightStatus = "green" | "yellow" | "red";

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

      const status = effectiveProjectStatus(section, project);
      if (status === "green" || status === "yellow" || status === "red") {
        current.statuses.push(status);
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
/**
 * fix-published-empty-stage-risk-floor: fire the "flagged red" escalation off
 * the risk-aware effective status, not the stale stored trafficLight, so the
 * bug case (owned empty stage covered by a blocked own risk) emits the at_risk
 * escalation alongside the existing unresolved_risk one.
 *
 * fix-flagged-red-escalation-dedup: a co-owned red product appears once per
 * co-owner section, so the push is gated on `seen` to emit one escalation per
 * `projectId` across the whole builder run. Returns null when the product is
 * not red or was already emitted; mutates `seen` on first emission.
 */
function flaggedRedEscalation(
  section: ReportSectionReadModel,
  project: ReportSectionReadModel["projects"][number],
  seen: Set<string>,
): Escalation | null {
  if (effectiveProjectStatus(section, project) !== "red") return null;
  if (seen.has(project.projectId)) return null;
  seen.add(project.projectId);
  return {
    type: "at_risk",
    productName: project.projectName,
    stageName: null,
    leadName: section.authorName,
    description: `Project ${project.projectName} is flagged red.`,
  };
}

// activity-first-class (Phase-1, LOCKED decision 0.1): the per-record escalation
// loops skip activity-parented rows (null product FK) so an activity's
// blockers/risks floor only its own pill, never the product-level roll-up.
// Extracted so `buildEscalationsFromReadSections` stays under the complexity gate.
function blockedItemEscalations(
  section: ReportSectionReadModel,
  productNames: ReadonlyMap<string, string>,
): Escalation[] {
  return section.items.flatMap((item) => {
    if (item.workflowStatus !== "blocked" || !item.projectId) return [];
    return [
      {
        type: "blocked" as const,
        productName: productNames.get(item.projectId) ?? UNKNOWN_PRODUCT_NAME,
        stageName: resolveStageName(item.stageIds),
        leadName: section.authorName,
        description: item.text,
      },
    ];
  });
}

function unresolvedRiskEscalations(
  section: ReportSectionReadModel,
  productNames: ReadonlyMap<string, string>,
): Escalation[] {
  return section.risks.flatMap((risk) => {
    if (!risk.projectId) return [];
    return [
      {
        type: "unresolved_risk" as const,
        productName: productNames.get(risk.projectId) ?? UNKNOWN_PRODUCT_NAME,
        stageName: resolveStageName(risk.stageIds),
        leadName: section.authorName,
        description: risk.risk,
      },
    ];
  });
}

export function buildEscalationsFromReadSections(
  sections: readonly ReportSectionReadModel[],
): Escalation[] {
  const escalations: Escalation[] = [];
  // fix-flagged-red-escalation-dedup: a co-owned red product appears once in
  // EACH co-owner's section, so without this the project-level flagged-red
  // push fires N identical rows. Track seen projectIds across the WHOLE section
  // loop and emit the flagged-red escalation once per product; the first
  // contributing lead's name survives (deterministic by loop order). Only the
  // `at_risk` flagged-red push is gated — `blocked` items and `unresolved_risk`
  // risks are genuinely per-record and stay un-deduped.
  const seenFlaggedRedProjectIds = new Set<string>();

  for (const section of sections) {
    const productNames = new Map(
      [...section.projects, ...(section.referencedProjects ?? [])].map(
        (project) => [project.projectId, project.projectName] as const,
      ),
    );

    escalations.push(...blockedItemEscalations(section, productNames));

    for (const project of section.projects) {
      const flaggedRed = flaggedRedEscalation(
        section,
        project,
        seenFlaggedRedProjectIds,
      );
      if (flaggedRed) escalations.push(flaggedRed);
    }

    escalations.push(...unresolvedRiskEscalations(section, productNames));
  }

  return escalations;
}

const statusSeverity: Record<TrafficLightStatus, number> = {
  green: 0,
  yellow: 1,
  red: 2,
};

export function computeWorstStatus(
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
