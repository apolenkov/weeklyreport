import type { ReportSectionReadModel } from "@weeklyreport/shared";

import {
  type PlanVerdict,
  planVerdictWrite,
} from "../../../../report-sections";
import { workSignature } from "./overview-undo";
import { SETTLE_MS, useEditorSettle } from "./use-editor-settle";
import type { ReadyEditor } from "./use-overview-controller";
import type { OverviewUndoWrite, UndoOffer } from "./use-overview-undo";
type SectionItem = ReportSectionReadModel["items"][number];
type ResolveWrite = Extract<
  ReturnType<typeof planVerdictWrite>,
  { kind: "resolve-plan" }
>;
export const verdictMessage: Record<PlanVerdict, string> = {
  done: "Marked Done in This week.",
  continue: "Kept in This week as In progress.",
  next: "Moved to Next week.",
  paused: "Paused in This week.",
  wont_do: "Closed as Won’t do. You can restore it until you submit.",
};
const FAILED = "The verdict could not be saved. Try again.";

const PAUSE_NOT_APPLIED =
  "The plan was continued, but the pause was not applied. Try Paused again.";
export const NOT_APPLIED = "The verdict was not applied. Try again.";
// The created occurrence reaches the draft with the command's own render.
const ADOPT_MS = 3000;

const hasPatch = (
  ready: ReadyEditor,
  itemId: string,
  patch: Partial<SectionItem>,
): boolean =>
  ready.draft.section.items.some(
    (item) =>
      item.id === itemId &&
      Object.entries(patch).every(
        ([key, value]) => item[key as keyof SectionItem] === value,
      ),
  );

function reverseOutcome(
  stableId: string,
  week: "current" | "next",
  verdict: PlanVerdict,
): UndoOffer["reverse"] {
  return (ready) => {
    const items =
      week === "current"
        ? ready.view.viewModel.ownCurrentWeekItems
        : ready.view.viewModel.ownNextWeekItems;
    const row = items.find((record) => record.stableId === stableId);
    if (!row) return null;
    if (verdict === "wont_do")
      return { kind: "restore-outcome", recordId: row.id, stableId };
    return {
      kind: "week-items",
      week,
      items: items.filter((record) => record !== row),
    };
  };
}

// The writes a verdict can need, each waiting for the editor instead of being
// dropped while a command or an autosave is in flight.
export function useVerdictWrites(
  editor: ReadyEditor | null,
  guardedWrite?: (change: OverviewUndoWrite) => Promise<boolean>,
  announce?: (offer: UndoOffer) => void,
) {
  const { until, whenIdle } = useEditorSettle(editor);

  // Applies a draft patch once no command is in flight and confirms the draft
  // took it, so a patch the draft refused is reported, never silently lost.
  const patchItem = async (
    itemId: string,
    patch: Partial<SectionItem>,
    failure: string,
    adoptMs: number = SETTLE_MS,
  ): Promise<string | null> => {
    const ready = await until(
      (next) =>
        !next.outcomes.pending &&
        next.draft.section.items.some((item) => item.id === itemId),
      adoptMs,
    );
    if (!ready) return failure;
    ready.draft.apply({ kind: "item-patch", itemId, patch });
    const applied = await until(
      (next) => hasPatch(next, itemId, patch),
      ADOPT_MS,
    );
    return applied ? null : failure;
  };

  // A patch leaves the draft dirty until autosave lands; the command needs a
  // clean saved baseline, so save now and wait for it instead of refusing.
  const settledForCommand = async (
    ready: ReadyEditor,
  ): Promise<ReadyEditor | string> => {
    if (ready.outcomes.canExecute) return ready;
    if (!ready.draft.dirty) return ready.outcomes.blockedReason ?? FAILED;
    await ready.draft.save();
    const fresh = await until(
      (next) =>
        next.outcomes.canExecute || next.draft.autosave.state === "error",
    );
    return fresh?.outcomes.canExecute
      ? fresh
      : ((fresh ?? ready).outcomes.blockedReason ?? FAILED);
  };

  const resolveVerdict = async (
    ready: ReadyEditor,
    stableId: string,
    write: ResolveWrite,
    verdict: PlanVerdict,
  ): Promise<string | null> => {
    const settled = await settledForCommand(ready);
    if (typeof settled === "string") return settled;
    const result = await settled.outcomes.resolve(
      { ...write.input, commandId: crypto.randomUUID() },
      stableId,
    );
    if (announce && guardedWrite)
      return recordConfirmedOutcome(
        { ready, stableId, write, verdict, result },
        { announce, guardedWrite, until },
      );
    if (!write.thenPatch) return null;
    const created = result.section.items.find(
      (candidate) =>
        candidate.stableId === result.stableId && candidate.type === "current",
    );
    return created?.id === undefined
      ? PAUSE_NOT_APPLIED
      : patchItem(created.id, write.thenPatch, PAUSE_NOT_APPLIED, ADOPT_MS);
  };

  return { patchItem, resolveVerdict, whenIdle };
}

async function recordConfirmedOutcome(
  {
    ready,
    stableId,
    write,
    verdict,
    result,
  }: {
    ready: ReadyEditor;
    stableId: string;
    write: ResolveWrite;
    verdict: PlanVerdict;
    result: Awaited<ReturnType<ReadyEditor["outcomes"]["resolve"]>>;
  },
  {
    announce,
    guardedWrite,
    until,
  }: {
    announce: (offer: UndoOffer) => void;
    guardedWrite: (change: OverviewUndoWrite) => Promise<boolean>;
    until: (
      predicate: (editor: ReadyEditor) => boolean,
    ) => Promise<ReadyEditor | null>;
  },
) {
  const target = { kind: "item" as const, stableId };
  const expected = workSignature(result.section, target);
  const confirmed = await until(
    (next) =>
      next.draft.receiptScope === ready.draft.receiptScope &&
      workSignature(next.draft.section, target) === expected,
  );
  if (!confirmed) return NOT_APPLIED;
  const row = result.section.items.find(
    (record) =>
      record.stableId === stableId &&
      (write.input.source.kind === "prior" ||
        record.id === write.input.source.recordId),
  );
  if (!row?.id) return NOT_APPLIED;
  const reverse = reverseOutcome(stableId, row.type, verdict);
  if (write.thenPatch) {
    const saved = await guardedWrite({
      section: confirmed.draft.section,
      target,
      patch: { kind: "item-patch", itemId: row.id, patch: write.thenPatch },
      reverse,
      message: verdictMessage[verdict],
    });
    return saved ? null : PAUSE_NOT_APPLIED;
  }
  announce({
    target,
    signature: expected,
    reverse,
    message: verdictMessage[verdict],
    scope: ready.draft.receiptScope,
  });
  return null;
}
