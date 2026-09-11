"use client";

import type { LeadStatusOverviewOutput } from "@customreport/shared";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type {
  StatusOverviewItem,
  StatusOverviewModel,
} from "../../../../report-sections";
import type { OpenWorkRegisterItem } from "./open-work-register-model";
import { useRetainedOverviewState } from "./overview-input-provider";
import {
  createOpenWorkPlanState,
  createOverviewPlanState,
  type OverviewPlanFields,
  overviewPlanInput,
  overviewPlanRecoveryReason,
  type OverviewPlanState,
  type PlanOutcome,
} from "./overview-plan-command";
import type { LeadFormEditorHandle } from "./use-lead-form-editor";
import { useOverviewFocusReturn } from "./use-overview-focus-return";

type ReadyEditor = Extract<LeadFormEditorHandle, { status: "ready" }>;

interface PlanAttempt {
  readonly key: string;
  readonly commandId: string;
  readonly owner: symbol;
}

function planAttemptInput(state: OverviewPlanState) {
  return state.mode === "resolve"
    ? overviewPlanInput(state)
    : { recordId: state.item.recordId ?? "" };
}

function planAttemptKey(state: OverviewPlanState): string {
  return `${state.mode}:${JSON.stringify(planAttemptInput(state))}`;
}

function completionMatches(
  current: OverviewPlanState | null,
  saved: OverviewPlanState,
  attempt: PlanAttempt,
): boolean {
  if (
    current?.item.key !== saved.item.key ||
    current.generation !== saved.generation ||
    current.attempt?.key !== attempt.key ||
    current.attempt.commandId !== attempt.commandId ||
    current.attempt.owner !== attempt.owner
  )
    return false;
  try {
    return planAttemptKey(current) === attempt.key;
  } catch {
    return false;
  }
}

function attachAttempt(
  current: OverviewPlanState | null,
  saved: OverviewPlanState,
  attempt: PlanAttempt,
): OverviewPlanState | null {
  if (
    current?.item.key !== saved.item.key ||
    current.generation !== saved.generation
  )
    return current;
  try {
    return planAttemptKey(current) === attempt.key
      ? { ...current, attempt }
      : current;
  } catch {
    return current;
  }
}

async function runPlanAttempt(
  editor: ReadyEditor,
  state: OverviewPlanState,
  input: ReturnType<typeof planAttemptInput>,
  commandId: string,
): Promise<void> {
  if ("outcome" in input) {
    await editor.outcomes.resolve({ ...input, commandId }, state.item.stableId);
    return;
  }
  await editor.outcomes.restore(
    { recordId: state.item.recordId ?? "", commandId },
    state.item.stableId ?? "",
  );
}

function capturePlan(
  editor: ReadyEditor,
  output: LeadStatusOverviewOutput,
  model: StatusOverviewModel,
  item: StatusOverviewItem,
  mode: "resolve" | "restore",
) {
  if (!item.recordId || !item.stableId) return null;
  const recordId = item.recordId;
  const previous =
    item.source === "previous" &&
    output.predecessor.availability === "available"
      ? output.predecessor
      : null;
  if (item.source === "previous" && !previous) return null;
  const records = previous?.section.items ?? editor.draft.section.items;
  const raw = records.find((record) => record.id === recordId);
  if (!raw) return null;
  const source = previous
    ? {
        kind: "prior" as const,
        reportId: previous.reportId,
        recordId: item.recordId,
      }
    : { kind: "current" as const, recordId: item.recordId };
  return createOverviewPlanState(editor, model, item, raw, source, mode);
}

export function useOverviewPlanActions(
  editor: ReadyEditor | null,
  output: LeadStatusOverviewOutput,
  model: StatusOverviewModel,
  otherInputOpen: boolean,
) {
  const [dialog, setDialog] = useRetainedOverviewState(
    "plan",
    output.current.reportId,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const running = useRef(false);
  const active = useRef(false);
  const [owner] = useState(() => Symbol("overview-plan-actions"));
  const rememberFocus = useOverviewFocusReturn(dialog !== null);
  const recoveryReason = overviewPlanRecoveryReason(editor, dialog, owner);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  const execute = async (state: OverviewPlanState): Promise<void> => {
    if (running.current || !editor) return;
    const recovery = overviewPlanRecoveryReason(editor, state, owner);
    if (recovery || !editor.outcomes.canExecute) {
      setError(
        recovery ??
          editor.outcomes.blockedReason ??
          "The report context changed. Your input has been retained.",
      );
      return;
    }
    running.current = true;
    setPending(true);
    setError(null);
    try {
      const input = planAttemptInput(state);
      const key = planAttemptKey(state);
      const commandId =
        state.attempt?.key === key
          ? state.attempt.commandId
          : crypto.randomUUID();
      const attempt = { key, commandId, owner };
      setDialog((current) => attachAttempt(current, state, attempt));
      await runPlanAttempt(editor, state, input, commandId);
      setDialog((current) =>
        completionMatches(current, state, attempt) ? null : current,
      );
      if (active.current)
        toast.success(
          state.mode === "restore" ? "Plan restored" : "Plan outcome saved",
        );
    } catch (error_) {
      setError(
        error_ instanceof Error
          ? error_.message
          : "The outcome could not be saved. Your input is retained; try again.",
      );
    } finally {
      running.current = false;
      setPending(false);
    }
  };

  const open = (item: StatusOverviewItem, mode: "resolve" | "restore") => {
    if (
      !editor ||
      editor.view.viewModel.isReadOnly ||
      otherInputOpen ||
      dialog ||
      running.current
    )
      return;
    const next = capturePlan(editor, output, model, item, mode);
    if (!next) return;
    rememberFocus();
    setError(null);
    setDialog(next);
    if (mode === "restore") void execute(next);
  };

  const openWork = (item: OpenWorkRegisterItem) => {
    if (
      !editor ||
      editor.view.viewModel.isReadOnly ||
      otherInputOpen ||
      dialog ||
      running.current
    )
      return;
    rememberFocus();
    setError(null);
    setDialog(createOpenWorkPlanState(editor, item));
  };

  return {
    dialog,
    pending,
    error,
    recoveryReason,
    blockedReason: editor
      ? editor.outcomes.blockedReason
      : "Editing is unavailable.",
    resolve: (item: StatusOverviewItem) => open(item, "resolve"),
    restore: (item: StatusOverviewItem) => open(item, "restore"),
    openWork,
    change: (patch: Partial<OverviewPlanFields>) => {
      if (!running.current)
        setDialog((current) =>
          current
            ? { ...current, fields: { ...current.fields, ...patch } }
            : current,
        );
    },
    choose: (outcome: PlanOutcome) => {
      if (!dialog || running.current) return;
      const next = { ...dialog, fields: { ...dialog.fields, outcome } };
      setDialog(next);
      setError(null);
      if (outcome === "done") void execute(next);
    },
    submit: () => {
      if (dialog) void execute(dialog);
    },
    close: () => {
      if (!running.current) {
        setDialog(null);
        setError(null);
      }
    },
  };
}
