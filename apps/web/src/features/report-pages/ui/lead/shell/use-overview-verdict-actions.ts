import {workSignature} from "./overview-undo";
import {usePlacementConfirmation} from "./overview-placement-confirmation";
import type { UndoOffer,OverviewUndoWrite } from "./use-overview-undo";
("use client");

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
import { SETTLE_MS, useEditorSettle } from "./use-editor-settle";
import type { LeadFormEditorHandle } from "./use-lead-form-editor";

type ReadyEditor = Extract<LeadFormEditorHandle, { status: "ready" }>;
type SectionItem = ReportSectionReadModel["items"][number];
type ResolveWrite = Extract<
  ReturnType<typeof planVerdictWrite>,
  { kind: "resolve-plan" }
>;

const verdictMessage: Record<PlanVerdict, string> = {
  done: "Marked Done in This week.",
  continue: "Kept in This week as In progress.",
  next: "Moved to Next week.",
  paused: "Paused in This week.",
  wont_do: "Closed as Won’t do. You can restore it until you submit.",
};
const FAILED = "The verdict could not be saved. Try again.";
const WAIT_FOR_UPDATE = "Wait for the current update to finish.";
const PAUSE_NOT_APPLIED =
  "The plan was continued, but the pause was not applied. Try Paused again.";
const NOT_APPLIED = "The verdict was not applied. Try again.";
// The created occurrence reaches the draft with the command's own render.
const ADOPT_MS = 3000;

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : FAILED;
}

// Every selected-week record for a stableId.
function focusCurrent(stableId:string){
  const controls=document.querySelectorAll<HTMLElement>("[data-overview-focus]");
  [...controls].find(node=>node.dataset.overviewFocus===`title:current:${stableId}`)?.focus();
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

function reverseOutcome(stableId:string,week:"current"|"next",verdict:PlanVerdict):UndoOffer["reverse"]{
 return ready=>{
   const items=week==="current"?ready.view.viewModel.ownCurrentWeekItems:ready.view.viewModel.ownNextWeekItems;
   const row=items.find(record=>record.stableId===stableId);
   if(!row)return null;
   if(verdict==="wont_do")return {kind:"restore-outcome",recordId:row.id,stableId};
   return {kind:"week-items",week,items:items.filter(record=>record!==row)};
 };
}

// The writes a verdict can need, each waiting for the editor instead of being
// dropped while a command or an autosave is in flight.
function useVerdictWrites(editor: ReadyEditor | null,guardedWrite?: (change:OverviewUndoWrite)=>Promise<boolean>,announce?:(offer:UndoOffer)=>void) {
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
    write: ResolveWrite,verdict:PlanVerdict,
  ): Promise<string | null> => {
    const settled = await settledForCommand(ready);
    if (typeof settled === "string") return settled;
    const result = await settled.outcomes.resolve(
      { ...write.input, commandId: crypto.randomUUID() },
      stableId,
    );
    if(announce && guardedWrite){
      const target={kind:"item" as const,stableId};
      const expected=workSignature(result.section,target);
      const confirmed=await until(next=>next.draft.receiptScope===ready.draft.receiptScope && workSignature(next.draft.section,target)===expected);
      if(!confirmed)return NOT_APPLIED;
      const row=result.section.items.find(record=>record.stableId===stableId && (write.input.source.kind==="prior" || record.id===write.input.source.recordId));
      if(!row?.id)return NOT_APPLIED;
      const reverse=reverseOutcome(stableId,row.type,verdict);
      if(write.thenPatch){
        const saved=await guardedWrite({section:confirmed.draft.section,target,patch:{kind:"item-patch",itemId:row.id,patch:write.thenPatch},reverse,message:verdictMessage[verdict]});
        return saved?null:PAUSE_NOT_APPLIED;
      }
      announce({target,signature:expected,reverse,message:verdictMessage[verdict],scope:ready.draft.receiptScope});
      return null;
    }
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
  announce?:(offer:UndoOffer)=>void,
) {
  const placement=usePlacementConfirmation(editor?.draft.receiptScope??null);
  const {latest}=useEditorSettle(editor);
  const running = useRef(false);
  const { patchItem, resolveVerdict, whenIdle } = useVerdictWrites(editor,guardedWrite,announce);

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
      let ready=latest.current;
      if(!ready || ready.view.viewModel.isReadOnly || ready.draft.receiptScope!==editor.draft.receiptScope)return FAILED;
      let siblings=recordsFor(ready,item.stableId);
      if(guardedWrite && verdict!=="next" && siblings.some(row=>row.type==="next")){
        const existing=siblings.find(row=>row.type==="current");
        if(existing){await placement.ask("current");focusCurrent(item.stableId);return "Nothing was moved: This week already has this item.";}
        const before=JSON.stringify(siblings);
        if(!await placement.ask("next"))return "Nothing was moved.";
        ready=latest.current;
        if(!ready || ready.view.viewModel.isReadOnly || ready.draft.receiptScope!==editor.draft.receiptScope)return FAILED;
        siblings=recordsFor(ready,item.stableId);
        if(JSON.stringify(siblings)!==before){
          if(siblings.some(row=>row.type==="current")){await placement.ask("current");focusCurrent(item.stableId);}
          return "The target week changed. Choose an outcome again.";
        }
      }

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
        case "item-patch":
          if (guardedWrite) {
            const before = siblings.find((row) => row.id === write.itemId);
            if (!before) return NOT_APPLIED;
            const saved = await guardedWrite({
              section:ready.draft.section,
              target: { kind: "item", stableId: item.stableId },
              patch: {
                kind: "item-patch",
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
                  kind: "item-patch",
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
          return await patchItem(write.itemId, write.patch, NOT_APPLIED);
        case "resolve-plan":
          return await resolveVerdict(ready, item.stableId, write,verdict);
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
    placement,onVerdict: recordVerdict,
    onConfirmAll: confirmAll,
    pendingReviewCount: editor?.view.submitReadiness.pendingReviewCount ?? 0,
  };
}
