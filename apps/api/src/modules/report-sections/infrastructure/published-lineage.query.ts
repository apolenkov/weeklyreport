import type { Prisma } from "@prisma/client";
import { requirePublishedSnapshot } from "@weeklyreport/report-persistence";
import type {
  PublishedLineage,
  ReportSectionReadModel,
} from "@weeklyreport/shared";

import {
  EMPTY_PUBLISHED_LINEAGE,
  type LineageCandidates,
  resolvePublishedLineage,
} from "../application/published-lineage.js";

type PublishedLineageQueryClient = Pick<
  Prisma.TransactionClient,
  "report" | "publishedSearchDocument"
>;

interface FrozenLineage {
  readonly updatedAt: number;
  readonly itemStableIds: readonly string[];
  readonly decisionStableIds: readonly string[];
}

// Validated stable ids per published report. Snapshots are rewritten only
// through Prisma writes (publish, restore, projection rebuild), each of which
// bumps `updatedAt`; so a snapshot is read, parsed and validated once per
// version instead of on every lineage lookup, and the per-call read is just
// (id, updatedAt). Process-local and bounded by the published-report count.
const frozenLineageCache = new Map<string, FrozenLineage>();

/** Test hook: drops validated snapshots so each case starts cold. */
export function resetFrozenLineageCache(): void {
  frozenLineageCache.clear();
}

async function loadFrozenLineage(
  prisma: PublishedLineageQueryClient,
): Promise<readonly FrozenLineage[]> {
  const heads = await prisma.report.findMany({
    where: { status: "published" },
    select: { id: true, updatedAt: true },
  });
  const liveIds = new Set(heads.map((head) => head.id));
  for (const id of frozenLineageCache.keys()) {
    if (!liveIds.has(id)) frozenLineageCache.delete(id);
  }
  const staleIds = heads
    .filter(
      (head) =>
        frozenLineageCache.get(head.id)?.updatedAt !== head.updatedAt.getTime(),
    )
    .map((head) => head.id);
  if (staleIds.length > 0) {
    const snapshots = await prisma.report.findMany({
      where: { id: { in: staleIds } },
      select: { id: true, updatedAt: true, publishedSnapshot: true },
    });
    for (const report of snapshots) {
      // Absent or malformed snapshots throw here and are never cached, so a
      // corrupt publication keeps failing every lookup.
      const { sections } = requirePublishedSnapshot(
        report.publishedSnapshot,
        report.id,
      );
      frozenLineageCache.set(report.id, {
        updatedAt: report.updatedAt.getTime(),
        itemStableIds: sections.flatMap((section) =>
          section.items.map((item) => item.stableId),
        ),
        decisionStableIds: sections.flatMap((section) =>
          section.decisions.map((decision) => decision.stableId),
        ),
      });
    }
  }
  return heads.flatMap((head) => frozenLineageCache.get(head.id) ?? []);
}

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

  const [frozen, rows] = await Promise.all([
    loadFrozenLineage(prisma),
    prisma.publishedSearchDocument.findMany({
      where: lineageWhere(candidates),
      select: { recordType: true, stableId: true },
    }),
  ]);

  // A reopened report keeps editing its live rows, but every frozen report's
  // original publication remains the authoritative lineage source. Reading
  // snapshots here also keeps the guard correct during recovery and in the
  // short window before a search projection is rebuilt.
  return resolvePublishedLineage(candidates, [
    {
      itemStableIds: [
        ...frozen.flatMap((source) => [...source.itemStableIds]),
        ...rows.flatMap((row) =>
          row.recordType === "item" ? [row.stableId] : [],
        ),
      ],
      decisionStableIds: [
        ...frozen.flatMap((source) => [...source.decisionStableIds]),
        ...rows.flatMap((row) =>
          row.recordType === "decision" ? [row.stableId] : [],
        ),
      ],
    },
  ]);
}
