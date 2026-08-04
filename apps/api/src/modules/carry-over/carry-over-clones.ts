import {
  type CarryOverRecord,
  carryOverRecordSchema,
  type ReportSectionReadModel,
} from "@customreport/shared";

export function cloneCarriedItem(
  sourceReportId: string,
  targetReportId: string,
  item: ReportSectionReadModel["items"][number],
  carriedAt: Date,
): {
  item: ReportSectionReadModel["items"][number];
  record: CarryOverRecord;
} {
  const targetItemId = crypto.randomUUID();

  return {
    // Keep priorityRank; resetting would force re-prioritize every boundary.
    item: {
      ...item,
      id: targetItemId,
      type: "current",
      carriedOver: true,
      // The type flips next → current, so the status must land in the
      // current vocabulary: a carried planned item is being worked on now.
      workflowStatus: "in_progress",
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
      carriedAt,
    }),
  };
}

export function cloneUnresolvedDecision(
  sourceReportId: string,
  targetReportId: string,
  decision: ReportSectionReadModel["decisions"][number],
  carriedAt: Date,
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
      carriedAt,
    }),
  };
}
