import {
  type CarryOverExecution,
  carryOverExecutionSchema,
  type CarryOverRecord,
  type ReportSectionReadModel,
  reportSectionReadModelSchema,
} from "@customreport/shared";

import { cloneCarriedItem, cloneUnresolvedDecision } from "./carry-over-clones";

type SourceItem = ReportSectionReadModel["items"][number];
type SourceDecision = ReportSectionReadModel["decisions"][number];

export interface CarriedAuthorEntry {
  readonly authorId: string;
  readonly items: readonly { item: SourceItem; record: CarryOverRecord }[];
  readonly decisions: readonly {
    decision: SourceDecision;
    record: CarryOverRecord;
  }[];
}

// A carried record must keep a valid target parent. A product/activity which
// is no longer attached to the target section cannot receive carried work.
function isParentCarryable(
  productId: string | null | undefined,
  activityId: string | null | undefined,
  targetProjectIds: ReadonlySet<string>,
  targetActivityIds: ReadonlySet<string>,
): boolean {
  if (productId != null) {
    return targetProjectIds.has(productId);
  }
  return activityId != null && targetActivityIds.has(activityId);
}

// Lineages the target already holds — skipping them keeps counts accurate and
// avoids silent skipDuplicates / P2002 misread as a dedupe race.
function stableIdSet(
  records: readonly {
    readonly stableId?: string | null | undefined;
  }[],
): ReadonlySet<string> {
  return new Set(
    records.flatMap((record) => (record.stableId ? [record.stableId] : [])),
  );
}

function isCarryableItem(
  item: SourceItem,
  targetProjectIds: ReadonlySet<string>,
  targetActivityIds: ReadonlySet<string>,
  targetItemLineage: ReadonlySet<string>,
): boolean {
  return (
    ((item.type === "next" && !item.carriedOver) ||
      (item.type === "current" && Boolean(item.nextStepText?.trim()))) &&
    // Finished work is closed; postponed work was explicitly pushed beyond
    // this period — the lead re-plans it by hand, never auto.
    item.workflowStatus !== "done" &&
    item.workflowStatus !== "postponed" &&
    item.workflowStatus !== "paused" &&
    item.resolution == null &&
    isParentCarryable(
      item.projectId,
      item.activityId,
      targetProjectIds,
      targetActivityIds,
    ) &&
    !(item.stableId !== undefined && targetItemLineage.has(item.stableId))
  );
}

function isCarryableDecision(
  decision: SourceDecision,
  targetProjectIds: ReadonlySet<string>,
  targetActivityIds: ReadonlySet<string>,
  targetDecisionLineage: ReadonlySet<string>,
): boolean {
  return (
    !decision.resolvedAt &&
    isParentCarryable(
      decision.productId,
      decision.activityId,
      targetProjectIds,
      targetActivityIds,
    ) &&
    !(
      decision.stableId !== undefined &&
      targetDecisionLineage.has(decision.stableId)
    )
  );
}

function carryEntryForAuthor(
  sourceSection: ReportSectionReadModel,
  targetSection: ReportSectionReadModel,
  sourceReportId: string,
  targetReportId: string,
  carriedAt: Date,
): CarriedAuthorEntry {
  // Records can only carry into parents attached to this target section.
  const targetProjectIds = new Set(
    targetSection.projects.map((project) => project.projectId),
  );
  const targetActivityIds = new Set(
    targetSection.activities.map((activity) => activity.activityId),
  );
  const targetItemLineage = stableIdSet(targetSection.items);
  const targetDecisionLineage = stableIdSet(targetSection.decisions);

  return {
    authorId: targetSection.authorId,
    items: sourceSection.items
      .filter((item) =>
        isCarryableItem(
          item,
          targetProjectIds,
          targetActivityIds,
          targetItemLineage,
        ),
      )
      .map((item) =>
        cloneCarriedItem(sourceReportId, targetReportId, item, carriedAt),
      ),
    decisions: sourceSection.decisions
      .filter((decision) =>
        isCarryableDecision(
          decision,
          targetProjectIds,
          targetActivityIds,
          targetDecisionLineage,
        ),
      )
      .map((decision) =>
        cloneUnresolvedDecision(
          sourceReportId,
          targetReportId,
          decision,
          carriedAt,
        ),
      ),
  };
}

// Only authors with a target section; every carried record needs a target parent.
export function planCarriedEntries(
  sourceSections: readonly ReportSectionReadModel[],
  targetSections: readonly ReportSectionReadModel[],
  sourceReportId: string,
  targetReportId: string,
  carriedAt: Date,
): CarriedAuthorEntry[] {
  const targetByAuthor = new Map(
    targetSections.map((target) => [target.authorId, target] as const),
  );
  return sourceSections.flatMap((sourceSection) => {
    const targetSection = targetByAuthor.get(sourceSection.authorId);
    return targetSection
      ? [
          carryEntryForAuthor(
            sourceSection,
            targetSection,
            sourceReportId,
            targetReportId,
            carriedAt,
          ),
        ]
      : [];
  });
}

// Merge carried rows into every matched target section (not just the first),
// so the repository persists each lead's carried items/decisions.
export function mergeCarriedIntoTargets(
  targetSections: readonly ReportSectionReadModel[],
  carriedByAuthor: readonly CarriedAuthorEntry[],
): ReportSectionReadModel[] {
  return targetSections.map((targetSection) => {
    const carried = carriedByAuthor.find(
      (entry) => entry.authorId === targetSection.authorId,
    );
    if (!carried) {
      return targetSection;
    }
    return reportSectionReadModelSchema.parse({
      ...targetSection,
      items: [
        ...targetSection.items,
        ...carried.items.map((entry) => entry.item),
      ],
      decisions: [
        ...targetSection.decisions,
        ...carried.decisions.map((entry) => entry.decision),
      ],
    });
  });
}

export function carriedCounts(entries: readonly CarriedAuthorEntry[]): {
  items: number;
  decisions: number;
} {
  return {
    items: entries.reduce((total, entry) => total + entry.items.length, 0),
    decisions: entries.reduce(
      (total, entry) => total + entry.decisions.length,
      0,
    ),
  };
}

export function collectCarryOverRecords(
  entries: readonly CarriedAuthorEntry[],
): CarryOverRecord[] {
  return [
    ...entries.flatMap((entry) => entry.items.map((carried) => carried.record)),
    ...entries.flatMap((entry) =>
      entry.decisions.map((carried) => carried.record),
    ),
  ];
}

// Allocate a fresh execution identity while using the caller's timestamp.
export function buildCarryOverExecution(input: {
  sourceReportId: string;
  targetReportId: string;
  dedupeKey: string;
  carriedItemCount: number;
  carriedDecisionCount: number;
  now: Date;
}): CarryOverExecution {
  const { now, ...executionInput } = input;
  return carryOverExecutionSchema.parse({
    id: crypto.randomUUID(),
    ...executionInput,
    status: "completed",
    startedAt: now,
    completedAt: now,
  });
}
