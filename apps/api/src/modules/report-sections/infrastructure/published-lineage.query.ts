import { requirePublishedSnapshot } from "@customreport/report-persistence";
import type {
  PublishedLineage,
  ReportSectionReadModel,
} from "@customreport/shared";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import {
  EMPTY_PUBLISHED_LINEAGE,
  type LineageCandidates,
  resolvePublishedLineage,
} from "../application/published-lineage.js";

export function publishedLineageCandidates(
  section: ReportSectionReadModel,
): LineageCandidates {
  return {
    reportId: section.reportId,
    reportSectionId: section.reportSectionId,
    itemStableIds: section.items.flatMap((item) =>
      item.stableId ? [item.stableId] : [],
    ),
    decisionStableIds: section.decisions.flatMap((decision) =>
      decision.stableId ? [decision.stableId] : [],
    ),
  };
}

function lineageWhere(candidates: LineageCandidates) {
  return {
    OR: [
      ...(candidates.itemStableIds.length === 0
        ? []
        : [
            {
              recordType: "item" as const,
              stableId: { in: [...candidates.itemStableIds] },
            },
          ]),
      ...(candidates.decisionStableIds.length === 0
        ? []
        : [
            {
              recordType: "decision" as const,
              stableId: { in: [...candidates.decisionStableIds] },
            },
          ]),
    ],
  };
}

/**
 * Resolves published record locks from the immutable, indexed publication
 * projection. Closed and reopened reports never require live record rows.
 */
export async function queryPublishedLineage(
  prisma: PrismaService,
  candidates: LineageCandidates,
): Promise<PublishedLineage> {
  if (
    candidates.itemStableIds.length === 0 &&
    candidates.decisionStableIds.length === 0
  ) {
    return EMPTY_PUBLISHED_LINEAGE;
  }

  const [reports, rows] = await Promise.all([
    prisma.report.findMany({
      where: {
        OR: [
          { periodStatus: "published" },
          { periodStatus: "reopened" },
          { archived: true },
        ],
      },
      select: { id: true, publishedSnapshot: true },
    }),
    prisma.publishedSearchDocument.findMany({
      where: lineageWhere(candidates),
      select: { recordType: true, stableId: true },
    }),
  ]);

  // A reopened report keeps editing its live rows, but every frozen report's
  // original publication remains the authoritative lineage source. Reading
  // snapshots here also keeps the guard correct during recovery and in the
  // short window before a search projection is rebuilt.
  const frozenSources = reports.flatMap((report) => {
    const snapshot = requirePublishedSnapshot(
      report.publishedSnapshot,
      report.id,
    );
    const sections =
      report.id === candidates.reportId
        ? snapshot.sections.filter(
            (section) => section.reportSectionId === candidates.reportSectionId,
          )
        : snapshot.sections;
    return sections.map((section) => ({
      itemStableIds: section.items.map((item) => item.stableId),
      decisionStableIds: section.decisions.map((decision) => decision.stableId),
    }));
  });

  return resolvePublishedLineage(candidates, [
    {
      itemStableIds: [
        ...frozenSources.flatMap((source) => [...source.itemStableIds]),
        ...rows.flatMap((row) =>
          row.recordType === "item" ? [row.stableId] : [],
        ),
      ],
      decisionStableIds: [
        ...frozenSources.flatMap((source) => [...source.decisionStableIds]),
        ...rows.flatMap((row) =>
          row.recordType === "decision" ? [row.stableId] : [],
        ),
      ],
    },
  ]);
}
