"use client";

import type {
  LeadStatusOverviewOutput,
  ReportSectionReadModel,
} from "@weeklyreport/shared";
import { useRef } from "react";

import {
  buildConfirmAllCarriedPatch,
  type PlanVerdict,
  planVerdictWrite,
  type StatusOverviewItem,
} from "../../../../report-sections";
import { usePlacementConfirmation } from "./overview-placement-confirmation";
import { useEditorSettle } from "./use-editor-settle";
import type { LeadFormEditorHandle } from "./use-lead-form-editor";
import type { OverviewUndoWrite, UndoOffer } from "./use-overview-undo";
import {
  NOT_APPLIED,
  useVerdictWrites,
  verdictMessage,
} from "./use-overview-verdict-writes";

type ReadyEditor = Extract<LeadFormEditorHandle, { status: "ready" }>;
type SectionItem = ReportSectionReadModel["items"][number];
const FAILED = "The verdict could not be saved. Try again.";
const WAIT_FOR_UPDATE = "Wait for the current update to finish.";

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : FAILED;
}

// Every selected-week record for a stableId.
function focusCurrent(stableId: string) {
  const controls = document.querySelectorAll<HTMLElement>(
    "[data-overview-focus]",
  );
  [...controls]
    .find((node) => node.dataset.overviewFocus === `title:current:${stableId}`)
    ?.focus();
}

function recordsFor(editor: ReadyEditor, stableId: string): SectionItem[] {
  return editor.draft.section.items.filter(
    (item) => item.stableId === stableId,
  );
}

// The record a verdict updates; Current wins over Next.
function linkedItem(records: readonly SectionItem[]): SectionItem | null {
  return records.find((item) => item.type === "current") ?? records[0] ?? null;
}

function priorRecord(
  output: LeadStatusOverviewOutput,
  item: StatusOverviewItem,
): { reportId: string; item: SectionItem } | null {
  const predecessor = output.predecessor;
  if (predecessor.availability !== "available") return null;
  const record = predecessor.section.items.find(
    (candidate) => item.recordId !== null && candidate.id === item.recordId,
  );
  return record ? { reportId: predecessor.reportId, item: record } : null;
}

const ITEM_PATCH = "item-patch";
type PlanPatch = Extract<
  ReturnType<typeof planVerdictWrite>,
  { kind: typeof ITEM_PATCH }
>;
async function saveLinkedVerdict(
  {
    ready,
    write,
    verdict,
  }: { ready: ReadyEditor; write: PlanPatch; verdict: PlanVerdict },
  guardedWrite: (change: OverviewUndoWrite) => Promise<boolean>,
) {
  const before = ready.draft.section.items.find(
    (row) => row.id === write.itemId,
  );
  if (!before?.stableId) return NOT_APPLIED;
  const saved = await guardedWrite({
    section: ready.draft.section,
    target: { kind: "item", stableId: before.stableId },
    patch: {
      kind: ITEM_PATCH,
      itemId: write.itemId,
      patch: write.patch,
    },
    message: verdictMessage[verdict],
    reverse: (ready) => {
      const updated = ready.draft.section.items.find(
        (row) =>
          row.stableId === before.stableId &&
          row.type === (write.patch.type ?? before.type),
      );
      if (!updated?.id) return null;
      return {
        kind: ITEM_PATCH,
        itemId: updated.id,
        patch: {
          type: before.type,
          carriedOver: before.carriedOver,
          workflowStatus: before.workflowStatus,
          nextStepText: before.nextStepText,
          pausedReason: before.pausedReason,
        },
      };
    },
  });
  return saved ? null : NOT_APPLIED;
}

async function selectedWeekTarget(
  {
    editor,
    latest,
    itemId,
  }: {
    editor: ReadyEditor;
    latest: React.RefObject<ReadyEditor | null>;
    itemId: string;
  },
  ask?: (week: "current" | "next") => Promise<boolean>,
) {
  const current = () => {
    const ready = latest.current;
    return ready &&
      !ready.view.viewModel.isReadOnly &&
      ready.draft.receiptScope === editor.draft.receiptScope
      ? { ready, siblings: recordsFor(ready, itemId) }
      : null;
  };
  const origin = current();
  if (!origin) return FAILED;
  if (!ask || !origin.siblings.some((row) => row.type === "next"))
    return origin;
  const focusExisting = async () => {
    const accepted = await ask("current");
    if (accepted && current()) focusCurrent(itemId);
    return "Nothing was moved: This week already has this item.";
  };
  if (origin.siblings.some((row) => row.type === "current"))
    return focusExisting();
  if (!(await ask("next"))) return "Nothing was moved.";
  const fresh = current();
  if (!fresh) return FAILED;
  if (fresh.siblings.some((row) => row.type === "current"))
    return focusExisting();
  return JSON.stringify(fresh.siblings) === JSON.stringify(origin.siblings)
    ? fresh
    : "The target week changed. Choose an outcome again.";
}

/**
 * Records a Previously planned verdict on the selected week's occurrence and
 * confirms all suggested continuations at once. The prior week is never
 * written: a linked occurrence is patched in the draft, otherwise the existing
 * plan-outcome command creates it. Nothing is dropped silently: a write waits
 * for an in-flight command or autosave, and one the draft did not take is
 * reported to the caller.
 */
export function useOverviewVerdictActions(
  editor: ReadyEditor | null,
  output: LeadStatusOverviewOutput,
  guardedWrite?: (change: OverviewUndoWrite) => Promise<boolean>,
  announce?: (offer: UndoOffer) => void,
) {
  const placement = usePlacementConfirmation(
    editor?.draft.receiptScope ?? null,
  );
  const { latest } = useEditorSettle(editor);
  const running = useRef(false);
  const { patchItem, resolveVerdict, whenIdle } = useVerdictWrites(
    editor,
    guardedWrite,
    announce,
  );

  const recordVerdict = async (
    item: StatusOverviewItem,
    verdict: PlanVerdict,
    reason?: string,
  ): Promise<string | null> => {
    const prior = priorRecord(output, item);
    if (!editor || !prior || item.stableId === null) return FAILED;
    if (running.current) return WAIT_FOR_UPDATE;
    running.current = true;
    try {
      const placed = await selectedWeekTarget(
        { editor, latest, itemId: item.stableId },
        guardedWrite && verdict !== "next" ? placement.ask : undefined,
      );
      if (typeof placed === "string") return placed;
      const { ready, siblings } = placed;
      const write = planVerdictWrite({
        verdict,
        reason,
        prior,
        linked: linkedItem(siblings),
        siblings,
      });
      switch (write.kind) {
        case "blocked":
          return write.reason;
        case "already-recorded":
          return null;
        case ITEM_PATCH:
          if (guardedWrite)
            return await saveLinkedVerdict(
              { ready, write, verdict },
              guardedWrite,
            );
          return await patchItem(write.itemId, write.patch, NOT_APPLIED);
        case "resolve-plan":
          return await resolveVerdict(ready, item.stableId, write, verdict);
      }
    } catch (error) {
      return messageOf(error);
    } finally {
      running.current = false;
    }
  };

  const confirmAll = (): void =>
    whenIdle((ready) => {
      const patch = buildConfirmAllCarriedPatch(ready.draft.section);
      if (patch) ready.draft.apply(patch);
    });

  return {
    placement,
    onVerdict: recordVerdict,
    onConfirmAll: confirmAll,
    pendingReviewCount: editor?.view.submitReadiness.pendingReviewCount ?? 0,
  };
}
