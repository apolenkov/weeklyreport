import { requirePublishedSnapshot } from "@customreport/report-persistence";
import type {
  PublishedLineage,
  ReportSectionReadModel,
} from "@customreport/shared";
import type { Prisma } from "@prisma/client";

import {
  EMPTY_PUBLISHED_LINEAGE,
  type LineageCandidates,
  resolvePublishedLineage,
} from "../application/published-lineage.js";

type PublishedLineageQueryClient = Pick<
  Prisma.TransactionClient,
  "report" | "publishedSearchDocument"
>;

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
  prisma: PublishedLineageQueryClient,
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
        status: "published",
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
    return snapshot.sections.map((section) => ({
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
