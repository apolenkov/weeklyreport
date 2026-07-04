import {
  type CarryOverRecord,
  carryOverRecordSchema,
  type ReportSectionReadModel,
} from "@customreport/shared";

/**
 * Clone builders for carry-over (extracted from carry-over.service.ts): each
 * produces the target-period copy of a source record plus its CarryOverRecord
 * audit row, preserving the durable `stableId` lineage via the spread.
 */

export function cloneCarriedItem(
  sourceReportId: string,
  targetReportId: string,
  item: ReportSectionReadModel["items"][number],
): {
  item: ReportSectionReadModel["items"][number];
  record: CarryOverRecord;
} {
  const targetItemId = crypto.randomUUID();

  return {
    // Q8 default (plan §20.5/§21.6 T-G4): the spread preserves
    // `priorityRank` across the carry-over so a lead doesn't lose ranking
    // when an unfinished next-week item lands in the new period. Reset
    // intentionally rejected — leads otherwise re-prioritize on every
    // boundary, undoing the previous week's signal.
    item: {
      ...item,
      id: targetItemId,
      type: "current",
      carriedOver: true,
      completed: null,
    },
    record: carryOverRecordSchema.parse({
      id: crypto.randomUUID(),
      sourceReportId,
      targetReportId,
      sourceItemId: item.id ?? null,
      targetItemId,
      sourceDecisionId: null,
      targetDecisionId: null,
      status: "completed",
      carriedAt: new Date(),
    }),
  };
}

export function cloneUnresolvedDecision(
  sourceReportId: string,
  targetReportId: string,
  decision: ReportSectionReadModel["decisions"][number],
): {
  decision: ReportSectionReadModel["decisions"][number];
  record: CarryOverRecord;
} {
  const targetDecisionId = crypto.randomUUID();

  return {
    decision: {
      ...decision,
      id: targetDecisionId,
      resolvedAt: null,
    },
    record: carryOverRecordSchema.parse({
      id: crypto.randomUUID(),
      sourceReportId,
      targetReportId,
      sourceItemId: null,
      targetItemId: null,
      sourceDecisionId: decision.id ?? null,
      targetDecisionId,
      status: "completed",
      carriedAt: new Date(),
    }),
  };
}
