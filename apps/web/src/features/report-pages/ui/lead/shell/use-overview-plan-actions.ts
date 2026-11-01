"use client";

import type { LeadStatusOverviewOutput } from "@weeklyreport/shared";
import { useEffect, useRef, useState } from "react";

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
  overviewPlanRecoveryReason,
  type OverviewPlanState,
  type PlanOutcome,
  STAGE_REQUIRED_ERROR,
} from "./overview-plan-command";
import {
  executePlan,
  planOpenBlocked,
  type PlanRunContext,
  promotePlanItem,
} from "./overview-plan-execution";
import type { LeadFormEditorHandle } from "./use-lead-form-editor";
import { useOverviewFocusReturn } from "./use-overview-focus-return";

type ReadyEditor = Extract<LeadFormEditorHandle, { status: "ready" }>;

function capturePlan(
  editor: ReadyEditor,
  output: LeadStatusOverviewOutput,
  model: StatusOverviewModel,
  { item, mode }: { item: StatusOverviewItem; mode: "resolve" | "restore" },
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
  return createOverviewPlanState(editor, model, item, { raw, source, mode });
}

function useMountedFlag() {
  const active = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  return active;
}

function usePlanDialogControls({
  dialog,
  error,
  setDialog,
  setError,
  running,
  execute,
}: {
  readonly dialog: OverviewPlanState | null;
  readonly error: string | null;
  readonly setDialog: PlanRunContext["setDialog"];
  readonly setError: PlanRunContext["setError"];
  readonly running: PlanRunContext["running"];
  readonly execute: (state: OverviewPlanState) => Promise<void>;
}) {
  return {
    change: (patch: Partial<OverviewPlanFields>) => {
      if (running.current) return;
      setDialog((current) =>
        current
          ? { ...current, fields: { ...current.fields, ...patch } }
          : current,
      );
      // A new parent brings its own stage set, so the old stage error is stale.
      if (patch.parent && error === STAGE_REQUIRED_ERROR) setError(null);
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
  const active = useMountedFlag();
  const [owner] = useState(() => Symbol("overview-plan-actions"));
  const rememberFocus = useOverviewFocusReturn(dialog !== null);
  const recoveryReason = overviewPlanRecoveryReason(editor, dialog, owner);

  const ctx: PlanRunContext = {
    editor,
    owner,
    running,
    active,
    setError,
    setPending,
    setDialog,
  };
  const execute = (state: OverviewPlanState): Promise<void> =>
    executePlan(ctx, state);

  const open = (
    item: StatusOverviewItem,
    mode: "resolve" | "restore",
    focusKey?: string,
  ) => {
    if (!editor || planOpenBlocked(editor, otherInputOpen, dialog, running))
      return;
    const next = capturePlan(editor, output, model, { item, mode });
    if (!next) return;
    rememberFocus(focusKey);
    setError(null);
    setDialog(next);
    if (mode === "restore") void execute(next);
  };

  const openWork = (item: OpenWorkRegisterItem) => {
    if (!editor || planOpenBlocked(editor, otherInputOpen, dialog, running))
      return;
    rememberFocus();
    setError(null);
    setDialog(createOpenWorkPlanState(editor, item));
  };

  const controls = usePlanDialogControls({
    dialog,
    error,
    setDialog,
    setError,
    running,
    execute,
  });

  return {
    dialog,
    pending,
    error,
    recoveryReason,
    blockedReason: editor
      ? editor.outcomes.blockedReason
      : "Editing is unavailable.",
    resolve: (item: StatusOverviewItem, focusKey?: string) =>
      open(item, "resolve", focusKey),
    restore: (item: StatusOverviewItem, focusKey?: string) =>
      open(item, "restore", focusKey),
    promote: (item: StatusOverviewItem): void => {
      void promotePlanItem(ctx, item, otherInputOpen);
    },
    openWork,
    ...controls,
  };
}
