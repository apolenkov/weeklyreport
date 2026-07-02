import type { Prisma } from "@prisma/client";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";

/**
 * Published lineage of a section's records: the durable `stableId`s of items
 * and decisions that have appeared in a published report. The delete-lock
 * (resolve-not-delete, ADR 0015) keys on this set — a saveSection payload that
 * omits or rewrites one of these lineages is rejected server-side, because the
 * client-authoritative `stableId` cannot be trusted to preserve identity.
 *
 * Risks are intentionally absent: a risk is re-raised, not carried, so the
 * lifecycle rule is narrowed to items + decisions (see the change design).
 */
export interface PublishedLineage {
  readonly itemStableIds: readonly string[];
  readonly decisionStableIds: readonly string[];
}

export interface LineageCandidates {
  readonly reportId: string;
  readonly reportSectionId: string;
  readonly itemStableIds: readonly string[];
  readonly decisionStableIds: readonly string[];
}

export const EMPTY_PUBLISHED_LINEAGE: PublishedLineage = {
  itemStableIds: [],
  decisionStableIds: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectStableIds(rows: unknown): Set<string> {
  if (!Array.isArray(rows)) return new Set();
  return new Set(
    rows.flatMap((row) =>
      isRecord(row) && typeof row.stableId === "string" ? [row.stableId] : [],
    ),
  );
}

/**
 * Tolerant reader over the frozen `Report.publishedSnapshot` JSON (a
 * serialized `AssembledReport`). Returns the item/decision `stableId`s the
 * snapshot holds for one section. Hand-rolled instead of a Zod parse so a
 * legacy snapshot (pre-stableId, or a shape drift) degrades to an empty set —
 * the lock then simply does not fire for those rows — rather than 500-ing
 * every save on a reopened period.
 */
export function snapshotLineageForSection(
  snapshot: Prisma.JsonValue | null | undefined,
  reportSectionId: string,
): { itemStableIds: Set<string>; decisionStableIds: Set<string> } {
  const empty = {
    itemStableIds: new Set<string>(),
    decisionStableIds: new Set<string>(),
  };
  if (!isRecord(snapshot) || !Array.isArray(snapshot.sections)) return empty;
  const section = snapshot.sections.find(
    (candidate) =>
      isRecord(candidate) && candidate.reportSectionId === reportSectionId,
  );
  if (!isRecord(section)) return empty;
  return {
    itemStableIds: collectStableIds(section.items),
    decisionStableIds: collectStableIds(section.decisions),
  };
}

/**
 * A report whose LIVE rows are a faithful record of published content: a
 * currently published or archived period. Both are frozen (not editable), so a
 * live row sharing a candidate `stableId` genuinely continues a published
 * lineage. A `reopened` report is deliberately EXCLUDED here — its rows are
 * editable again, so a record ADDED after the reopen would be mistaken for
 * published lineage and its carried clone falsely delete-locked. Reopened
 * periods contribute through their FROZEN snapshot instead (see below), which
 * pins exactly what was signed off.
 */
const PUBLISHED_REPORT_FILTER = {
  OR: [{ periodStatus: "published" as const }, { archived: true }],
};

/**
 * Union of every item/decision `stableId` a snapshot holds across ALL its
 * sections. Used for cross-report lineage from OTHER reopened periods, where
 * the live rows are untrustworthy (editable) but the frozen snapshot is not.
 */
export function snapshotLineageAllSections(
  snapshot: Prisma.JsonValue | null | undefined,
): { itemStableIds: Set<string>; decisionStableIds: Set<string> } {
  const itemStableIds = new Set<string>();
  const decisionStableIds = new Set<string>();
  if (!isRecord(snapshot) || !Array.isArray(snapshot.sections)) {
    return { itemStableIds, decisionStableIds };
  }
  for (const section of snapshot.sections) {
    if (!isRecord(section)) continue;
    for (const id of collectStableIds(section.items)) itemStableIds.add(id);
    for (const id of collectStableIds(section.decisions))
      decisionStableIds.add(id);
  }
  return { itemStableIds, decisionStableIds };
}

/**
 * Resolve which of a section's current lineages are published, from the two
 * places published content lives:
 *
 *  1. the section's own report's frozen `publishedSnapshot` (the reopened
 *     period: live rows are editable again, but the snapshot pins what was
 *     signed off), and
 *  2. live rows in OTHER, frozen published/archived reports sharing the same
 *     `stableId` (a carried clone continues a published позиция's lineage, so
 *     it stays locked in the new period), and
 *  3. the FROZEN snapshots of OTHER reopened reports — a reopened source's live
 *     rows are editable (and may hold post-reopen additions), so only its
 *     snapshot proves what was published; this keeps a carried clone locked
 *     while its source is reopened WITHOUT over-locking a never-published row.
 *
 * Candidates are the section's CURRENT row lineages, so the result is always
 * "published AND still present" — the lock never demands resurrecting a row
 * that was already gone.
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

  const [ownReport, publishedItems, publishedDecisions, reopenedReports] =
    await Promise.all([
      prisma.report.findUnique({
        where: { id: candidates.reportId },
        select: { publishedSnapshot: true },
      }),
      candidates.itemStableIds.length > 0
        ? prisma.item.findMany({
            where: {
              stableId: { in: [...candidates.itemStableIds] },
              reportSectionId: { not: candidates.reportSectionId },
              reportSection: { report: PUBLISHED_REPORT_FILTER },
            },
            select: { stableId: true },
          })
        : Promise.resolve([]),
      candidates.decisionStableIds.length > 0
        ? prisma.decision.findMany({
            where: {
              stableId: { in: [...candidates.decisionStableIds] },
              reportSectionId: { not: candidates.reportSectionId },
              reportSection: { report: PUBLISHED_REPORT_FILTER },
            },
            select: { stableId: true },
          })
        : Promise.resolve([]),
      prisma.report.findMany({
        where: {
          id: { not: candidates.reportId },
          periodStatus: "reopened",
        },
        select: { publishedSnapshot: true },
      }),
    ]);

  const snapshotLineage = snapshotLineageForSection(
    ownReport?.publishedSnapshot,
    candidates.reportSectionId,
  );
  const reopenedLineage = reopenedReports.map((report) =>
    snapshotLineageAllSections(report.publishedSnapshot),
  );
  const publishedItemSet = new Set([
    ...snapshotLineage.itemStableIds,
    ...publishedItems.map((row) => row.stableId),
    ...reopenedLineage.flatMap((lineage) => [...lineage.itemStableIds]),
  ]);
  const publishedDecisionSet = new Set([
    ...snapshotLineage.decisionStableIds,
    ...publishedDecisions.map((row) => row.stableId),
    ...reopenedLineage.flatMap((lineage) => [...lineage.decisionStableIds]),
  ]);

  return {
    itemStableIds: candidates.itemStableIds.filter((id) =>
      publishedItemSet.has(id),
    ),
    decisionStableIds: candidates.decisionStableIds.filter((id) =>
      publishedDecisionSet.has(id),
    ),
  };
}
