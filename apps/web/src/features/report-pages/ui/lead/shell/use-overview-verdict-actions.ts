"use client";

import type {
  LeadStatusOverviewOutput,
  ReportSectionReadModel,
} from "@customreport/shared";
import { useRef } from "react";

import {
  buildConfirmAllCarriedPatch,
  type PlanVerdict,
  planVerdictWrite,
  type StatusOverviewItem,
} from "../../../../report-sections";
import type { LeadFormEditorHandle } from "./use-lead-form-editor";

type ReadyEditor = Extract<LeadFormEditorHandle, { status: "ready" }>;
type SectionItem = ReportSectionReadModel["items"][number];

const FAILED = "The verdict could not be saved. Try again.";

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : FAILED;
}

// The selected week's record for a stableId; Current wins over Next.
function linkedItem(editor: ReadyEditor, stableId: string): SectionItem | null {
  const matches = editor.draft.section.items.filter(
    (item) => item.stableId === stableId,
  );
  return matches.find((item) => item.type === "current") ?? matches[0] ?? null;
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

/**
 * Records a Previously planned verdict on the selected week's occurrence and
 * confirms all suggested continuations at once. The prior week is never
 * written: a linked occurrence is patched in the draft, otherwise the existing
 * plan-outcome command creates it.
 */
export function useOverviewVerdictActions(
  editor: ReadyEditor | null,
  output: LeadStatusOverviewOutput,
) {
  const running = useRef(false);

  const patchItem = (itemId: string, patch: Partial<SectionItem>): void =>
    editor?.draft.apply({ kind: "item-patch", itemId, patch });

  const recordVerdict = async (
    item: StatusOverviewItem,
    verdict: PlanVerdict,
    reason?: string,
  ): Promise<string | null> => {
    const prior = priorRecord(output, item);
    if (!editor || !prior || item.stableId === null) return FAILED;
    if (running.current) return "Wait for the current update to finish.";
    running.current = true;
    try {
      const write = planVerdictWrite({
        verdict,
        reason,
        prior,
        linked: linkedItem(editor, item.stableId),
      });
      switch (write.kind) {
        case "blocked":
          return write.reason;
        case "already-recorded":
          return null;
        case "item-patch":
          patchItem(write.itemId, write.patch);
          return null;
        case "resolve-plan": {
          if (!editor.outcomes.canExecute)
            return editor.outcomes.blockedReason ?? FAILED;
          const result = await editor.outcomes.resolve(
            { ...write.input, commandId: crypto.randomUUID() },
            item.stableId,
          );
          const created = result.section.items.find(
            (candidate) =>
              candidate.stableId === result.stableId &&
              candidate.type === "current",
          );
          if (write.thenPatch && created?.id !== undefined)
            patchItem(created.id, write.thenPatch);
          return null;
        }
      }
    } catch (error) {
      return messageOf(error);
    } finally {
      running.current = false;
    }
  };

  const confirmAll = (): void => {
    if (!editor) return;
    const patch = buildConfirmAllCarriedPatch(editor.draft.section);
    if (patch) editor.draft.apply(patch);
  };

  return {
    onVerdict: recordVerdict,
    onConfirmAll: confirmAll,
    pendingReviewCount: editor?.view.submitReadiness.pendingReviewCount ?? 0,
  };
}
