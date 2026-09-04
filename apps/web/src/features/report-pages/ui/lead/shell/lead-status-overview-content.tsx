"use client";

import { useSearchParams } from "next/navigation";
import { type ComponentProps, useState } from "react";

import { SdlcTooltipProvider } from "../../../../../shared/ui/feedback/sdlc-tooltip";
import {
  type KanbanItem,
  projectStatusOverview,
  StatusOverview,
  type StatusOverviewCreateTarget,
  type StatusOverviewEditTarget,
} from "../../../../report-sections";
import { autosaveStatusCopy } from "../chrome/autosave-state-copy";
import { LeadFormDialogs } from "../chrome/lead-form-dialogs";
import { LeadFormHeaderActions } from "../chrome/lead-form-header-actions";
import { LeadOverviewToolbarControls } from "../chrome/lead-form-toolbar-controls";
import {
  buildStatusOverviewCreatePatch,
  buildStatusOverviewItemPatch,
  findEditableItem,
  OverviewItemDialog,
  type OverviewItemDialogState,
} from "./lead-status-overview-item-editor";
import { useCompletionPresentation } from "./presentation/use-completion-presentation";
import type { LeadFormEditorHandle } from "./use-lead-form-editor";

type AvailableEditor = Exclude<LeadFormEditorHandle, { status: "loading" }>;
type ReadyEditor = Extract<AvailableEditor, { status: "ready" }>;

const FALLBACK_AUTOSAVE = {
  state: "idle" as const,
  lastSavedAt: null,
  dirty: false,
  isInFlight: false,
  forceSave: () => Promise.resolve(),
};
const FALLBACK_READINESS = {
  canOpenConfirmation: false,
  submitPending: false,
  blockingIssues: [],
  willAutoPromote: [],
  unsetStatuses: [],
  autosaveState: "idle" as const,
};

export function buildStatusOverviewDetailsHref(
  reportId: string,
  searchParams: Pick<URLSearchParams, "get">,
): string {
  const next = new URLSearchParams({ mode: "edit" });
  for (const key of [
    "feedback",
    "feedbackUrl",
    "agentationSession",
    "agentationAnnotation",
  ] as const) {
    const value = searchParams.get(key);
    if (value) next.set(key, value);
  }
  return `/lead/report/${encodeURIComponent(reportId)}?${next.toString()}#report-details`;
}

function EditorAvailabilityNotice({
  editor,
}: {
  readonly editor: AvailableEditor;
}) {
  if (editor.status === "ready") return null;
  const failed = editor.status === "error";
  return (
    <p
      role={failed ? "alert" : "status"}
      className="border-l-2 border-[var(--color-status-at-risk-border)] pl-3 text-sm text-[var(--color-muted-foreground)]"
    >
      {failed
        ? "Editing is temporarily unavailable. Overview remains read-only."
        : "This report section is not editable. Overview is read-only."}
    </p>
  );
}

function ReadyOverviewHeader({
  editor,
  completionActions,
  completionSentinelRef,
}: {
  readonly editor: ReadyEditor;
  readonly completionActions: ComponentProps<
    typeof LeadFormHeaderActions
  >["completionActions"];
  readonly completionSentinelRef: ComponentProps<
    typeof LeadFormHeaderActions
  >["completionSentinelRef"];
}) {
  return (
    <>
      <LeadFormHeaderActions
        viewModel={editor.view.viewModel}
        writeActions={editor.view.writeActions}
        completionActions={completionActions}
        completionSentinelRef={completionSentinelRef}
        showCompletionActions
        isSlidesMode={false}
        isSubmitted={editor.view.isSubmitted}
      />
      <LeadOverviewToolbarControls
        viewModel={editor.view.viewModel}
        leadSubmittedAt={
          editor.view.data.byPeriodData?.section.submittedAt ?? null
        }
        showArchivePeriods={editor.view.showArchivePeriods}
        onShowArchivePeriodsChange={editor.view.onShowArchivePeriodsChange}
        toolbarVisibility={editor.view.data.toolbarVisibility}
        onVisibilityChange={editor.view.data.onRecordVisibilityChange}
        targetReportId={editor.view.data.targetReportId}
      />
    </>
  );
}

function OverviewEditorDialog({
  editor,
  dialog,
  isReadOnly,
  onSave,
  onCancel,
}: {
  readonly editor: ReadyEditor | null;
  readonly dialog: OverviewItemDialogState | null;
  readonly isReadOnly: boolean;
  readonly onSave: (item: KanbanItem) => void;
  readonly onCancel: () => void;
}) {
  if (!editor || !dialog || isReadOnly) return null;
  if (dialog.generation !== editor.generation) return null;
  return (
    <OverviewItemDialog
      editor={editor}
      dialog={dialog}
      onSave={onSave}
      onCancel={onCancel}
    />
  );
}

function useOverviewDialog(
  editor: ReadyEditor | null,
  isReadOnly: boolean,
  model: ReturnType<typeof projectStatusOverview>,
) {
  const [dialog, setDialog] = useState<OverviewItemDialogState | null>(null);
  const editItem = (target: StatusOverviewEditTarget): void => {
    if (!editor || isReadOnly) return;
    const item = findEditableItem(editor, target);
    if (!item) return;
    setDialog({
      mode: "edit",
      generation: editor.generation,
      target,
      item,
    });
  };
  const addItem = (target: StatusOverviewCreateTarget): void => {
    if (!editor || isReadOnly) return;
    const unit = model.units.find(
      (candidate) =>
        candidate.kind === target.unitKind && candidate.id === target.unitId,
    );
    if (!unit || unit.historical) return;
    setDialog({ mode: "create", generation: editor.generation, target });
  };
  const save = (updatedItem: KanbanItem): void => {
    if (!editor || !dialog || isReadOnly) return;
    if (dialog.generation !== editor.generation) {
      setDialog(null);
      return;
    }
    const patch =
      dialog.mode === "edit"
        ? buildStatusOverviewItemPatch(
            dialog.target,
            editor.view.viewModel.ownCurrentWeekItems,
            editor.view.viewModel.ownNextWeekItems,
            updatedItem,
          )
        : buildStatusOverviewCreatePatch(
            dialog.target,
            editor.view.viewModel.ownCurrentWeekItems,
            editor.view.viewModel.ownNextWeekItems,
            updatedItem,
          );
    if (patch) editor.draft.apply(patch);
    setDialog(null);
  };
  return { dialog, editItem, addItem, save, close: () => setDialog(null) };
}

function useOverviewCompletion(
  editor: ReadyEditor | null,
  isReadOnly: boolean,
) {
  return useCompletionPresentation({
    autosave: editor?.view.autosave ?? FALLBACK_AUTOSAVE,
    products: editor?.view.viewModel.products ?? [],
    onQuickAdd: editor?.view.draftActions.onQuickAdd ?? (() => undefined),
    handleSubmit: editor?.view.writeActions.handleSubmit ?? (() => undefined),
    readiness: editor?.view.submitReadiness ?? FALLBACK_READINESS,
    isSlidesMode: false,
    isReadOnly,
  });
}

export function LeadStatusOverviewContent({
  targetReportId,
  output,
  editor,
}: {
  readonly targetReportId: string;
  readonly output: Parameters<typeof projectStatusOverview>[0];
  readonly editor: AvailableEditor;
}) {
  const searchParams = useSearchParams();
  const readyEditor = editor.status === "ready" ? editor : null;
  const isReadOnly = readyEditor?.view.viewModel.isReadOnly ?? true;
  const completion = useOverviewCompletion(readyEditor, isReadOnly);
  const model = projectStatusOverview(output, {
    currentSection: readyEditor?.draft.section,
    currentItemsEditable: readyEditor !== null && !isReadOnly,
  });
  const dialog = useOverviewDialog(readyEditor, isReadOnly, model);
  const overview = (
    <div
      className="min-w-0 space-y-6"
      data-testid="lead-status-overview-page"
      data-layout-key="report-page"
      data-layout-stability="position-width"
    >
      {readyEditor ? (
        <ReadyOverviewHeader
          editor={readyEditor}
          completionActions={completion.completionActions}
          completionSentinelRef={completion.sentinelRef}
        />
      ) : null}
      <EditorAvailabilityNotice editor={editor} />
      <StatusOverview
        model={model}
        onEditItem={readyEditor && !isReadOnly ? dialog.editItem : undefined}
        onAddItem={readyEditor && !isReadOnly ? dialog.addItem : undefined}
        detailsHref={buildStatusOverviewDetailsHref(
          targetReportId,
          searchParams,
        )}
        autosaveStatus={
          readyEditor && !isReadOnly
            ? autosaveStatusCopy(readyEditor.draft.autosave.state)
            : undefined
        }
      />
      <OverviewEditorDialog
        editor={readyEditor}
        dialog={dialog.dialog}
        isReadOnly={isReadOnly}
        onSave={dialog.save}
        onCancel={dialog.close}
      />
    </div>
  );

  if (!readyEditor) return overview;
  return (
    <SdlcTooltipProvider>
      {overview}
      <LeadFormDialogs
        viewModel={readyEditor.view.viewModel}
        quickAdd={readyEditor.view.draftActions}
        writeActions={readyEditor.view.writeActions}
        unsetOwnStageCount={readyEditor.view.unsetOwnStageCount}
        draftSection={readyEditor.view.draftSection}
      />
    </SdlcTooltipProvider>
  );
}
