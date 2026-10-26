import type {
  ItemWorkflowStatus,
  ReportSectionReadModel,
} from "@weeklyreport/shared";
import { useLayoutEffect, useRef, useState } from "react";

import type {
  ItemStatusInput,
  StatusOverviewItem,
} from "../../../../report-sections";
import {
  saveOverviewStatus,
  type StatusSaveRequest,
} from "./overview-status-save";
import { useEditorSettle } from "./use-editor-settle";
import type { LeadFormEditorHandle } from "./use-lead-form-editor";
import { useOverviewFocusReturn } from "./use-overview-focus-return";

type ReadyEditor = Extract<LeadFormEditorHandle, { status: "ready" }>;
type SourceItem = ReportSectionReadModel["items"][number];
interface Attempt {
  readonly commandId: string;
  readonly fingerprint: string;
  readonly promotedFingerprint: string;
  readonly recordId: string;
}
function fingerprint(source: SourceItem) {
  return JSON.stringify({
    text: source.text,
    nextStepText: source.nextStepText ?? null,
    workflowStatus: source.workflowStatus,
    pausedReason: source.pausedReason ?? null,
    type: source.type,
  });
}
function newAttempt(source: SourceItem): Attempt {
  return {
    commandId: crypto.randomUUID(),
    recordId: source.id ?? "",
    fingerprint: fingerprint(source),
    promotedFingerprint: fingerprint({
      ...source,
      type: "next",
      text: source.nextStepText?.trim() ?? "",
      nextStepText: null,
    }),
  };
}
async function replayPromotion(
  editor: ReadyEditor,
  attempt: Attempt,
  stableId: string,
): Promise<string | null> {
  if (!editor.outcomes.canExecute)
    return (
      editor.outcomes.blockedReason ?? "Wait for the current update to finish."
    );
  try {
    await editor.outcomes.promote(
      {
        recordId: attempt.recordId,
        commandId: attempt.commandId,
        target: "next",
      },
      stableId,
    );
    return null;
  } catch (error_) {
    return error_ instanceof Error
      ? error_.message
      : "The next step could not be planned. Try again.";
  }
}
function statusScope(editor: ReadyEditor | null): string {
  return editor
    ? `${editor.generation ?? "unavailable"}:${editor.draft.section.authorId}`
    : "unavailable";
}
function useStatusAttempts(editor: ReadyEditor | null) {
  const cache = useRef({
    scope: statusScope(editor),
    entries: new Map<string, Attempt>(),
  });
  useLayoutEffect(() => {
    const scope = statusScope(editor);
    if (cache.current.scope !== scope)
      cache.current = { scope, entries: new Map() };
  }, [editor]);
  return cache;
}
function sourceFor(editor: ReadyEditor, item: StatusOverviewItem) {
  return editor.draft.section.items.find((row) =>
    item.stableId !== null
      ? row.stableId === item.stableId
      : item.recordId !== null && row.id === item.recordId,
  );
}
function attemptFor(
  source: SourceItem,
  request: StatusSaveRequest,
  previous: Attempt | undefined,
) {
  return request.status === "done" && request.input?.nextStepAction === "plan"
    ? (previous ?? newAttempt(source))
    : undefined;
}

function canReplay(
  attempt: Attempt,
  source: SourceItem,
  request: StatusSaveRequest,
): boolean {
  if (request.status !== "done" || request.input?.nextStepAction !== "plan")
    return false;
  const current = fingerprint(source);
  return (
    current === attempt.fingerprint || current === attempt.promotedFingerprint
  );
}
async function saveAttempt(
  editor: ReadyEditor,
  request: StatusSaveRequest,
  entries: Map<string, Attempt>,
): Promise<string | null> {
  const stableId = request.item.stableId;
  const source = sourceFor(editor, request.item);
  if (!source) return "This update is no longer available. Reload the report.";
  const previous = stableId ? entries.get(stableId) : undefined;
  if (previous && !canReplay(previous, source, request))
    return "A previous plan attempt is unconfirmed. Reload the report before choosing another status.";
  const attempt = attemptFor(source, request, previous);
  const failure =
    previous && stableId
      ? await replayPromotion(editor, previous, stableId)
      : await saveOverviewStatus(editor, {
          ...request,
          item: { ...request.item, recordId: source.id ?? null },
          ...(attempt
            ? {
                commandId: attempt.commandId,
                onPromotionStart: () => {
                  if (stableId) entries.set(stableId, attempt);
                },
              }
            : {}),
        });
  if (failure === null && stableId) entries.delete(stableId);
  return failure;
}
export function useOverviewStatusSave(editor: ReadyEditor | null) {
  const { until, latest } = useEditorSettle(editor);
  const [pending, setPending] = useState(false);
  const rememberFocus = useOverviewFocusReturn(pending);
  const attempts = useStatusAttempts(editor);
  return async (
    item: StatusOverviewItem,
    status: ItemWorkflowStatus,
    input: ItemStatusInput = {},
  ): Promise<string | null> => {
    const requested = latest.current;
    if (!requested)
      return "This update is no longer available. Reload the report.";
    const ready = requested.outcomes.pending
      ? await until((candidate) => !candidate.outcomes.pending)
      : requested;
    if (!ready) return "Wait for the current update to finish, then try again.";
    if (
      ready.generation !== requested.generation ||
      ready.draft.section.authorId !== requested.draft.section.authorId
    )
      return "The report context changed. Reload the report before trying again.";
    if (ready.view.viewModel.isReadOnly)
      return "This report is read-only. Reload the report.";
    if (attempts.current.scope !== statusScope(ready))
      return "The report context changed. Reload the report.";
    const promotion = status === "done" && input.nextStepAction === "plan";
    if (promotion) {
      rememberFocus(`edit:${item.source}:${item.stableId ?? item.key}`);
      setPending(true);
    }
    try {
      return await saveAttempt(
        ready,
        { item, status, input },
        attempts.current.entries,
      );
    } finally {
      if (promotion) setPending(false);
    }
  };
}
