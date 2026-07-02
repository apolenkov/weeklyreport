import type {
  DraftSaveInput,
  DraftSaveValidationError,
  SubmitSectionInput,
} from "@customreport/shared";

/**
 * Pure resolve-not-delete comparison (ADR 0015). `published` is the section's
 * published lineage set — the item/decision `stableId`s that appeared in a
 * published report AND are still present on the section's current rows. The
 * incoming payload must retain every one of them: an omitted lineage is a
 * delete, a rewritten `stableId` also surfaces as an omission (the original
 * lineage is gone from the payload), so one check covers both evasions.
 * Risks are excluded by design — a risk is re-raised, not carried.
 */
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
