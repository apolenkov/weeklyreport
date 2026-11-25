import { toast } from "sonner";

import { applyDraftPatch, type DraftPatch } from "../../../../report-sections";
import { type UndoTarget, workSignature } from "./overview-undo";
import type { ReadyEditor } from "./use-overview-controller";

export async function persistOverviewChange(
  ready: ReadyEditor,
  target: UndoTarget,
  patch: DraftPatch,
  until: (
    predicate: (editor: ReadyEditor) => boolean,
  ) => Promise<ReadyEditor | null>,
) {
  const { draft } = ready;
  const expected = workSignature(applyDraftPatch(draft.section, patch), target);
  if (expected === workSignature(draft.section, target)) return false;
  draft.apply(patch);
  const adopted = await until(
    (next) =>
      next.draft.receiptScope === draft.receiptScope &&
      workSignature(next.draft.section, target) === expected,
  );
  if (!adopted) return false;
  const token = crypto.randomUUID();
  const result = await adopted.draft.savePersisted(token);
  if (result.status !== "accepted") {
    toast.error("The save was not confirmed.");
    return false;
  }
  const confirmed = await until(
    (next) =>
      next.draft.receiptScope === draft.receiptScope &&
      next.draft.lastSaveReceipt?.attemptToken === token,
  );
  const receipt = confirmed?.draft.lastSaveReceipt;
  if (
    !confirmed ||
    !receipt?.persistedItems ||
    !receipt.persistedRisks ||
    !receipt.persistedDecisions
  )
    return false;
  const persisted = {
    ...confirmed.draft.section,
    items: receipt.persistedItems,
    risks: receipt.persistedRisks,
    decisions: receipt.persistedDecisions,
  };
  if (
    workSignature(persisted, target) !== expected ||
    workSignature(confirmed.draft.section, target) !== expected
  )
    return false;
  return expected;
}
