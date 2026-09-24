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
    // Explicit write fields only: the read model's comments, resolution and
    // outcomeHistory extras are dead data past this boundary.
    item: {
      id: targetItemId,
      stableId: item.stableId,
      projectId: item.projectId,
      activityId: item.activityId,
      type: "current",
      // Legacy next-period plans keep their text. A current-period result
      // consumes its explicit next-period commitment as the new text.
      text:
        item.type === "current" && item.nextStepText?.trim()
          ? item.nextStepText
          : item.text,
      tag: item.tag,
      // An explicit commitment restarts as planned — entering a new period
      // must not claim that work has already started. A bare Current
      // in-progress continues in progress; the carriedOver marker, not a
      // status rewrite, records that the occurrence is unconfirmed.
      workflowStatus:
        item.type === "current" && !item.nextStepText?.trim()
          ? "in_progress"
          : "planned",
      carriedOver: true,
      // Keep priorityRank; resetting would force re-prioritize every boundary.
      priorityRank: item.priorityRank,
      pausedReason: null,
      nextStepText: null,
      stageNames: item.stageNames,
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
    // Same projection boundary: read-model comments never reach the write side.
    decision: {
      id: targetDecisionId,
      stableId: decision.stableId,
      text: decision.text,
      owner: decision.owner,
      deadline: decision.deadline,
      impact: decision.impact,
      resolvedAt: null,
      stageNames: decision.stageNames,
      productId: decision.productId,
      activityId: decision.activityId,
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
