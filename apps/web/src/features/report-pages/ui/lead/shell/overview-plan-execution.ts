import type { SetStateAction } from "react";
import { toast } from "sonner";

import type { StatusOverviewItem } from "../../../../report-sections";
import {
  overviewPlanInput,
  overviewPlanRecoveryReason,
  type OverviewPlanState,
} from "./overview-plan-command";
import type { LeadFormEditorHandle } from "./use-lead-form-editor";

type ReadyEditor = Extract<LeadFormEditorHandle, { status: "ready" }>;

interface PlanAttempt {
  readonly key: string;
  readonly commandId: string;
  readonly owner: symbol;
}

export function planAttemptInput(state: OverviewPlanState) {
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

// Mutable refs and setters of one plan-actions hook instance. The runners below
// are plain functions so the in-flight and mounted flags can be written outside
// a hook body.
export interface PlanRunContext {
  readonly editor: ReadyEditor | null;
  readonly owner: symbol;
  readonly running: { current: boolean };
  readonly active: { current: boolean };
  readonly setError: (message: string | null) => void;
  readonly setPending: (pending: boolean) => void;
  readonly setDialog: (
    action: SetStateAction<OverviewPlanState | null>,
  ) => void;
}

export async function executePlan(
  {
    editor,
    owner,
    running,
    active,
    setError,
    setPending,
    setDialog,
  }: PlanRunContext,
  state: OverviewPlanState,
): Promise<void> {
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
}

// MOVE-NEXT-CURRENT: promotion needs no dialog — it consumes the commitment
// that is already recorded and archives the superseded result server-side.
export async function promotePlanItem(
  { editor, owner, running, active, setError, setPending }: PlanRunContext,
  item: StatusOverviewItem,
  otherInputOpen: boolean,
): Promise<void> {
  if (
    !editor ||
    editor.view.viewModel.isReadOnly ||
    otherInputOpen ||
    item.recordId === null ||
    item.stableId === null
  )
    return;
  if (running.current) return;
  const recovery = overviewPlanRecoveryReason(editor, null, owner);
  if (recovery || !editor.outcomes.canExecute) {
    setError(
      recovery ??
        editor.outcomes.blockedReason ??
        "The report context changed. Try again.",
    );
    return;
  }
  running.current = true;
  setPending(true);
  setError(null);
  try {
    await editor.outcomes.promote(
      { recordId: item.recordId, commandId: crypto.randomUUID() },
      item.stableId,
    );
    if (active.current) toast.success("Item moved to this week");
  } catch (error_) {
    setError(
      error_ instanceof Error
        ? error_.message
        : "The item could not be moved to this week. Try again.",
    );
  } finally {
    running.current = false;
    setPending(false);
  }
}

export function planOpenBlocked(
  editor: ReadyEditor,
  otherInputOpen: boolean,
  dialog: OverviewPlanState | null,
  running: { readonly current: boolean },
): boolean {
  return (
    editor.view.viewModel.isReadOnly ||
    otherInputOpen ||
    dialog !== null ||
    running.current
  );
}
