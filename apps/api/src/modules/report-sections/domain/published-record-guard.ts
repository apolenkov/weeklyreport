import type {
  DraftSaveInput,
  DraftSaveValidationError,
  SubmitSectionInput,
} from "@customreport/shared";

// Payload must retain every published item/decision stableId (rewrite = omit).
// Risks excluded — re-raised, not carried. See openspec durable-record-identity.
export function findPublishedRecordViolation(
  published: {
    itemStableIds: readonly string[];
    decisionStableIds: readonly string[];
  },
  input: DraftSaveInput | SubmitSectionInput,
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
  if (!dropped) return null;
  return {
    code: "PUBLISHED_RECORD_LOCKED",
    message:
      "This record is part of the published report. Mark it done or carry it forward — it cannot be deleted.",
  };
}
