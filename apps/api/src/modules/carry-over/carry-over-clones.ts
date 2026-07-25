import {
  type CarryOverRecord,
  carryOverRecordSchema,
  type ReportSectionReadModel,
} from "@customreport/shared";

/**
 * Clone Carried Item.
 * @param sourceReportId - The sourceReportId argument.
 * @param targetReportId - The targetReportId argument.
 * @param item - The item argument.
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
      carriedAt: new Date(),
    }),
  };
}

/**
 * Clone Unresolved Decision.
 * @param sourceReportId - The sourceReportId argument.
 * @param targetReportId - The targetReportId argument.
 * @param decision - The decision argument.
 */
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
