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

// Activity-parented only if re-attached on the target; product-parented always qualifies.
function isActivityCarryable(
  activityId: string | null | undefined,
  targetActivityIds: ReadonlySet<string>,
): boolean {
  return activityId == null || targetActivityIds.has(activityId);
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
  targetActivityIds: ReadonlySet<string>,
  targetItemLineage: ReadonlySet<string>,
): boolean {
  return (
    item.type === "next" &&
    !item.carriedOver &&
    // Finished work is closed; postponed work was explicitly pushed beyond
    // this period — the lead re-plans it by hand, never auto.
    item.workflowStatus !== "done" &&
    item.workflowStatus !== "postponed" &&
    isActivityCarryable(item.activityId, targetActivityIds) &&
    !(item.stableId !== undefined && targetItemLineage.has(item.stableId))
  );
}

function isCarryableDecision(
  decision: SourceDecision,
  targetActivityIds: ReadonlySet<string>,
  targetDecisionLineage: ReadonlySet<string>,
): boolean {
  return (
    !decision.resolvedAt &&
    isActivityCarryable(decision.activityId, targetActivityIds) &&
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
): CarriedAuthorEntry {
  // Activities re-attached to this author's target section — an
  // activity-parented source record carries only when its parent is here.
  const targetActivityIds = new Set(
    targetSection.activities.map((activity) => activity.activityId),
  );
  const targetItemLineage = stableIdSet(targetSection.items);
  const targetDecisionLineage = stableIdSet(targetSection.decisions);

  return {
    authorId: targetSection.authorId,
    items: sourceSection.items
      .filter((item) =>
        isCarryableItem(item, targetActivityIds, targetItemLineage),
      )
      .map((item) => cloneCarriedItem(sourceReportId, targetReportId, item)),
    decisions: sourceSection.decisions
      .filter((decision) =>
        isCarryableDecision(decision, targetActivityIds, targetDecisionLineage),
      )
      .map((decision) =>
        cloneUnresolvedDecision(sourceReportId, targetReportId, decision),
      ),
  };
}

// Only authors with a target section; activity-parented needs re-attachment.
export function planCarriedEntries(
  sourceSections: readonly ReportSectionReadModel[],
  targetSections: readonly ReportSectionReadModel[],
  sourceReportId: string,
  targetReportId: string,
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

export function buildCarryOverExecution(input: {
  sourceReportId: string;
  targetReportId: string;
  dedupeKey: string;
  carriedItemCount: number;
  carriedDecisionCount: number;
}): CarryOverExecution {
  return carryOverExecutionSchema.parse({
    id: crypto.randomUUID(),
    ...input,
    status: "completed",
    startedAt: new Date(),
    completedAt: new Date(),
  });
}
