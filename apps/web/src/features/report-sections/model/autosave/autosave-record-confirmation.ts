import type { LeadFormGeneration } from "../lead-form/lead-form-generation";
import { encodeAutosaveComparisonKey } from "./autosave-stable-stringify";
import type { AutosaveSaveReceipt } from "./autosave-types";

interface RecordTarget {
  readonly kind: "risk" | "decision";
  readonly stableId: string;
  readonly scope: string;
  readonly generation: LeadFormGeneration;
  readonly reportSectionId: string;
  readonly attemptToken: string;
}

function scopeMatches(
  receipt: AutosaveSaveReceipt,
  target: RecordTarget,
): boolean {
  return !(
    ![target.stableId, target.scope, target.attemptToken].every(Boolean) ||
    receipt.scope !== target.scope ||
    receipt.generation !== target.generation ||
    receipt.reportSectionId !== target.reportSectionId ||
    receipt.attemptToken !== target.attemptToken ||
    receipt.expectedVersion === undefined ||
    receipt.version <= receipt.expectedVersion ||
    receipt.submittedPayload?.reportSectionId !== target.reportSectionId
  );
}

/** Confirms one record on a direct save response, never the whole payload. */
export function confirmSavedRecord(
  receipt: AutosaveSaveReceipt,
  target: RecordTarget,
): boolean {
  if (!scopeMatches(receipt, target) || !receipt.submittedPayload) return false;
  const payload = receipt.submittedPayload;
  if (target.kind === "risk") {
    const submitted = payload.risks.filter(
      (r) => r.stableId === target.stableId,
    );
    const returned =
      receipt.persistedRisks?.filter((r) => r.stableId === target.stableId) ??
      [];
    const [a] = submitted;
    const [b] = returned;
    if (submitted.length !== 1 || returned.length !== 1 || !a || !b)
      return false;
    const fields = (r: typeof a) => ({
      projectId: r.projectId ?? null,
      activityId: r.activityId ?? null,
      risk: r.risk,
      impact: r.impact,
      mitigation: r.mitigation,
      severity: r.severity,
      stageNames: r.stageNames,
    });
    return (
      encodeAutosaveComparisonKey(fields(a)) ===
      encodeAutosaveComparisonKey(fields(b))
    );
  }
  const submitted = payload.decisions.filter(
    (d) => d.stableId === target.stableId,
  );
  const returned =
    receipt.persistedDecisions?.filter((d) => d.stableId === target.stableId) ??
    [];
  const [a] = submitted;
  const [b] = returned;
  if (submitted.length !== 1 || returned.length !== 1 || !a || !b) return false;
  const fields = (d: typeof a) => ({
    productId: d.productId ?? null,
    activityId: d.activityId ?? null,
    text: d.text,
    owner: d.owner,
    deadline: d.deadline ?? null,
    impact: d.impact,
    resolvedAt: d.resolvedAt ?? null,
    stageNames: d.stageNames,
  });
  return (
    encodeAutosaveComparisonKey(fields(a)) ===
    encodeAutosaveComparisonKey(fields(b))
  );
}
