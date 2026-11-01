import type { ReportSectionReadModel } from "@weeklyreport/shared";
import { toast } from "sonner";

import type { StatusOverviewItem } from "../../../../report-sections";
import {
  buildMoveItemPatch,
  buildNextWeekPlanAcknowledgementPatch,
  isSavedNextWeekPlan,
} from "../../../../report-sections";
import { NEXT_WEEK_PLAN_CONFIRMED_MESSAGE } from "../chrome/lead-form-draft-actions";
import type { LeadFormEditorHandle } from "./use-lead-form-editor";

type ReadyEditor = Extract<LeadFormEditorHandle, { status: "ready" }>;

export type WhenIdle = (action: (ready: ReadyEditor) => void) => void;

const ACKNOWLEDGEMENT_UNAVAILABLE =
  "This update can no longer be confirmed. Reload the report.";
const MOVE_UNAVAILABLE =
  "This update can no longer be moved. Reload the report.";
const UNDO_UNAVAILABLE = "This move can no longer be undone.";
const UNDO_TIMEOUT_MS = 8000;

const moveMessage = (target: "current" | "next"): string =>
  target === "next" ? "Moved to next week" : "Moved to this week";

// Move to next week on a Current occurrence whose saved next step already plans
// that week only acknowledges the plan: the record, its result and its
// commitment stay put, and the ordinary draft save carries the acknowledgement.
function acknowledgeSavedNextWeekPlan(
  whenIdle: WhenIdle,
  section: ReportSectionReadModel,
  item: StatusOverviewItem,
  target: "current" | "next",
): boolean {
  const recordId = item.recordId;
  if (target !== "next" || recordId === null) return false;
  if (!isSavedNextWeekPlan(section, recordId)) return false;
  whenIdle((ready) => {
    // The draft may have changed while an outcome command held the editor, so
    // the acknowledgement is re-derived from the latest section.
    const patch = buildNextWeekPlanAcknowledgementPatch(
      ready.draft.section,
      recordId,
    );
    if (patch === null) {
      toast.error(ACKNOWLEDGEMENT_UNAVAILABLE);
      return;
    }
    ready.draft.apply(patch);
    toast.success(NEXT_WEEK_PLAN_CONFIRMED_MESSAGE);
  });
  return true;
}

interface MoveWithoutEditorArgs {
  readonly whenIdle: WhenIdle;
  readonly focusMoved: (identity: string | null) => void;
  readonly section: ReportSectionReadModel;
  readonly item: StatusOverviewItem;
  readonly target: "current" | "next";
}

// Undo issues the reverse move through the same draft write. A refusal — the
// occurrence was moved, edited or saved elsewhere in between — reports the
// failure and leaves the server state untouched.
function undoWeekMove({
  whenIdle,
  focusMoved,
  item,
  movedTo,
  backTo,
}: {
  readonly whenIdle: WhenIdle;
  readonly focusMoved: (identity: string | null) => void;
  readonly item: StatusOverviewItem;
  readonly movedTo: "current" | "next";
  readonly backTo: "current" | "next";
}): void {
  const recordId = item.recordId;
  if (recordId === null) {
    toast.error(UNDO_UNAVAILABLE);
    return;
  }
  whenIdle((ready) => {
    const patch = buildMoveItemPatch(ready.draft.section, recordId, backTo);
    if (patch === null) {
      toast.error(UNDO_UNAVAILABLE);
      return;
    }
    ready.draft.apply(patch);
    focusMoved(item.stableId ?? null);
    announceMove({
      whenIdle,
      focusMoved,
      item,
      movedFrom: movedTo,
      movedTo: backTo,
    });
  });
}

// The move confirmation lives in the existing toast channel and offers the
// reverse move for the same ~8 s window other actions get.
function announceMove({
  whenIdle,
  focusMoved,
  item,
  movedFrom,
  movedTo,
}: {
  readonly whenIdle: WhenIdle;
  readonly focusMoved: (identity: string | null) => void;
  readonly item: StatusOverviewItem;
  readonly movedFrom: "current" | "next";
  readonly movedTo: "current" | "next";
}): void {
  toast.success(moveMessage(movedTo), {
    duration: UNDO_TIMEOUT_MS,
    action: {
      label: "Undo",
      onClick: () =>
        undoWeekMove({
          whenIdle,
          focusMoved,
          item,
          movedTo,
          backTo: movedFrom,
        }),
    },
  });
}

// A placement move needs no input: apply the placement patch through the
// ordinary draft save. Null patches (a saved next step, a same-stableId
// occurrence already in the target week, a finished item) keep the canonical
// editor path. The item leaves its lane, so focus follows it once the move
// renders.
function applyDirectMove({
  whenIdle,
  focusMoved,
  section,
  item,
  target,
}: MoveWithoutEditorArgs): boolean {
  const recordId = item.recordId;
  if (recordId === null) return false;
  if (buildMoveItemPatch(section, recordId, target) === null) return false;
  const from = item.source === "next" ? "next" : "current";
  whenIdle((ready) => {
    // The draft may have changed while an outcome command held the editor.
    const patch = buildMoveItemPatch(ready.draft.section, recordId, target);
    if (patch === null) {
      toast.error(MOVE_UNAVAILABLE);
      return;
    }
    ready.draft.apply(patch);
    focusMoved(item.stableId ?? null);
    announceMove({
      whenIdle,
      focusMoved,
      item,
      movedFrom: from,
      movedTo: target,
    });
  });
  return true;
}

// Both in-place moves finish without the editor; true means one handled it.
export function moveWithoutEditor(args: MoveWithoutEditorArgs): boolean {
  const { whenIdle, section, item, target } = args;
  return (
    acknowledgeSavedNextWeekPlan(whenIdle, section, item, target) ||
    applyDirectMove(args)
  );
}
