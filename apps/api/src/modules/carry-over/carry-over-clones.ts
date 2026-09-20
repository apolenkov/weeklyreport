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
      // Legacy next-period plans continue unchanged. Only a current-period
      // result consumes its explicit next-period commitment as the new text.
      text:
        item.type === "current" && item.nextStepText?.trim()
          ? item.nextStepText
          : item.text,
      // Commitments restart as planned; only a bare unfinished Current item
      // continues in progress. The marker records that it is unconfirmed.
      workflowStatus:
        item.type === "current" && !item.nextStepText?.trim()
          ? "in_progress"
          : "planned",
      nextStepText: null,
      pausedReason: null,
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
