import type { DraftSaveValidationError } from "@weeklyreport/shared";

interface IdentifiedRecord {
  readonly stableId?: string | undefined;
}

interface IdentifiedDecision extends IdentifiedRecord {
  readonly impact?: string | null | undefined;
}

const DELETED: DraftSaveValidationError = {
  code: "PUBLISHED_RECORD_LOCKED",
  message:
    "This record is part of the published report. Mark it done or carry it forward — it cannot be deleted.",
};

// Names the field, never fills it in: the author restores or rewrites Impact.
const IMPACT_CLEARED: DraftSaveValidationError = {
  code: "PUBLISHED_RECORD_LOCKED",
  message:
    "This decision is part of the published report, so its Impact cannot be left empty. Restore the Impact or enter a new one.",
};

// Payload must retain every published item/decision stableId (rewrite = omit),
// and a retained published decision must keep its Impact: the frozen report is
// its only witness, so an emptied one would drop out of the next publication.
// Risks excluded — re-raised, not carried. See openspec durable-record-identity
// and report-record-ordering.
export function findPublishedRecordViolation(
  published: {
    itemStableIds: readonly string[];
    decisionStableIds: readonly string[];
  },
  input: {
    readonly items: readonly IdentifiedRecord[];
    readonly decisions: readonly IdentifiedDecision[];
  },
): DraftSaveValidationError | null {
  if (
    published.itemStableIds.length === 0 &&
    published.decisionStableIds.length === 0
  ) {
    return null;
  }
  const payloadItemLineage = new Set(
    input.items.flatMap((item) => (item.stableId ? [item.stableId] : [])),
  );
  const payloadDecisionLineage = new Set(
    input.decisions.flatMap((decision) =>
      decision.stableId ? [decision.stableId] : [],
    ),
  );
  const dropped =
    published.itemStableIds.some((id) => !payloadItemLineage.has(id)) ||
    published.decisionStableIds.some((id) => !payloadDecisionLineage.has(id));
  if (dropped) return DELETED;
  const publishedDecisions = new Set(published.decisionStableIds);
  const emptied = input.decisions.some(
    (decision) =>
      decision.stableId !== undefined &&
      publishedDecisions.has(decision.stableId) &&
      (decision.impact ?? null) === null,
  );
  return emptied ? IMPACT_CLEARED : null;
}
