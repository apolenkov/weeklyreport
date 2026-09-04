"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useContext, useState } from "react";

import { useQueryErrorHandler } from "../../../../../shared/hooks/query/use-query-error-handler";
import { SessionContext } from "../../../../../shared/lib/auth/session-provider";
import { useTRPC } from "../../../../../shared/lib/trpc/trpc-context";
import { ReportToolbar } from "../../../../../shared/ui/report-shell/report-toolbar";
import { ViewModeToggle } from "../../../../../shared/ui/report-shell/view-mode-toggle";
import {
  type DraftPatch,
  ItemEditDialog,
  type KanbanItem,
  ownedStagesForProject,
  projectStatusOverview,
  StatusOverview,
  type StatusOverviewEditTarget,
} from "../../../../report-sections";
import { autosaveStatusCopy } from "../chrome/autosave-state-copy";
import {
  deriveActiveIds,
  deriveTargetReportId,
} from "./use-lead-form-data-helpers";
import type { LeadFormEditorHandle } from "./use-lead-form-editor";
import { useLeadFormEditor } from "./use-lead-form-editor";

interface LeadStatusOverviewProps {
  readonly reportId?: string | undefined;
  readonly redirectToCanonical?: boolean | undefined;
}

interface OverviewItemDialogState {
  readonly target: StatusOverviewEditTarget;
  readonly item: KanbanItem;
}

export function buildStatusOverviewDetailsHref(
  reportId: string,
  searchParams: Pick<URLSearchParams, "get">,
): string {
  const next = new URLSearchParams({ mode: "edit" });
  for (const key of ["siteping", "sitepingUrl"] as const) {
    const value = searchParams.get(key);
    if (value) next.set(key, value);
  }
  return `/lead/report/${encodeURIComponent(reportId)}?${next.toString()}#report-details`;
}

export function buildStatusOverviewItemPatch(
  target: StatusOverviewEditTarget,
  currentItems: readonly KanbanItem[],
  nextItems: readonly KanbanItem[],
  updatedItem: KanbanItem,
): DraftPatch | null {
  const sourceItems = target.source === "current" ? currentItems : nextItems;
  if (!sourceItems.some((item) => item.id === target.recordId)) return null;
  return {
    kind: "week-items",
    week: target.source,
    items: sourceItems.map((item) =>
      item.id === target.recordId ? updatedItem : item,
    ),
  };
}

function findEditableItem(
  editor: Extract<LeadFormEditorHandle, { status: "ready" }>,
  target: StatusOverviewEditTarget,
): KanbanItem | null {
  const items =
    target.source === "current"
      ? editor.view.viewModel.ownCurrentWeekItems
      : editor.view.viewModel.ownNextWeekItems;
  return items.find((item) => item.id === target.recordId) ?? null;
}

function OverviewSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading status overview"
      className="space-y-3"
    >
      <div className="h-12 animate-pulse rounded-[var(--radius)] bg-[var(--color-muted)]" />
      {Array.from({ length: 3 }, (_, index) => (
        <div
          key={index}
          className="h-28 animate-pulse rounded-[var(--radius)] bg-[var(--color-muted)]"
        />
      ))}
    </div>
  );
}

type ReadyEditor = Extract<LeadFormEditorHandle, { status: "ready" }>;

function EditorAvailabilityNotice({
  editor,
}: {
  readonly editor: Exclude<LeadFormEditorHandle, { status: "loading" }>;
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

function OverviewItemDialog({
  editor,
  dialog,
  onSave,
  onCancel,
}: {
  readonly editor: ReadyEditor;
  readonly dialog: OverviewItemDialogState;
  readonly onSave: (item: KanbanItem) => void;
  readonly onCancel: () => void;
}) {
  const viewModel = editor.view.viewModel;
  return (
    <ItemEditDialog
      key={`${dialog.target.source}:${dialog.target.recordId}`}
      open
      item={dialog.item}
      products={viewModel.products}
      activities={viewModel.activityOptions}
      week={dialog.target.source}
      currentUserName={viewModel.currentUser.name}
      stagesForProduct={(productId) =>
        ownedStagesForProject(editor.draft.section, productId)
      }
      ownPeriodRanks={viewModel.ownPeriodRanks}
      risks={viewModel.ownRisks}
      onSave={onSave}
      onCancel={onCancel}
    />
  );
}

function LeadStatusOverviewContent({
  targetReportId,
  output,
  editor,
}: {
  readonly targetReportId: string;
  readonly output: Parameters<typeof projectStatusOverview>[0];
  readonly editor: Exclude<LeadFormEditorHandle, { status: "loading" }>;
}) {
  const searchParams = useSearchParams();
  const [dialog, setDialog] = useState<OverviewItemDialogState | null>(null);
  const readyEditor = editor.status === "ready" ? editor : null;
  const isReadOnly = readyEditor?.view.viewModel.isReadOnly ?? true;
  const model = projectStatusOverview(output, {
    currentSection: readyEditor?.draft.section,
    currentItemsEditable: readyEditor != null && !isReadOnly,
  });
  const handleEditItem = (target: StatusOverviewEditTarget): void => {
    if (!readyEditor || isReadOnly) return;
    const item = findEditableItem(readyEditor, target);
    if (item) setDialog({ target, item });
  };
  const handleDialogSave = (updatedItem: KanbanItem): void => {
    if (!readyEditor || !dialog || isReadOnly) return;
    const patch = buildStatusOverviewItemPatch(
      dialog.target,
      readyEditor.view.viewModel.ownCurrentWeekItems,
      readyEditor.view.viewModel.ownNextWeekItems,
      updatedItem,
    );
    if (patch) readyEditor.draft.apply(patch);
    setDialog(null);
  };
  const overviewHref = `/lead/report/${encodeURIComponent(targetReportId)}`;

  return (
    <div
      className="min-w-0 space-y-6"
      data-testid="lead-status-overview-page"
      data-layout-key="report-page"
      data-layout-stability="position-width"
    >
      <ReportToolbar
        sticky
        layoutKey="report-context-toolbar"
        contextControls={
          <div className="ml-auto">
            <ViewModeToggle
              mode="overview"
              overviewHref={overviewHref}
              editHref={`${overviewHref}?mode=edit`}
              slidesHref={`${overviewHref}?mode=slides`}
              desktopLabels
            />
          </div>
        }
      />
      <EditorAvailabilityNotice editor={editor} />
      <StatusOverview
        model={model}
        onEditItem={readyEditor && !isReadOnly ? handleEditItem : undefined}
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
      {readyEditor && dialog && !isReadOnly ? (
        <OverviewItemDialog
          editor={readyEditor}
          dialog={dialog}
          onSave={handleDialogSave}
          onCancel={() => setDialog(null)}
        />
      ) : null}
    </div>
  );
}

export function LeadStatusOverview({
  reportId: pinnedReportId,
  redirectToCanonical,
}: LeadStatusOverviewProps) {
  const trpc = useTRPC();
  const session = useContext(SessionContext);
  const editor = useLeadFormEditor({
    reportId: pinnedReportId,
    redirectToCanonical,
    mode: "overview",
  });
  const activeQ = useQuery(trpc.reports.getActive.queryOptions());
  const { activeReportId } = deriveActiveIds(activeQ.data);
  const targetReportId = deriveTargetReportId(pinnedReportId, activeReportId);
  const shouldRouteAway =
    session?.user?.role === "head" || session?.user?.role === "admin";
  const overviewQ = useQuery({
    ...trpc.leadForm.statusOverview.queryOptions({
      reportId: targetReportId ?? "",
    }),
    enabled: targetReportId !== null && !session?.isLoading && !shouldRouteAway,
    staleTime: 30_000,
  });

  useQueryErrorHandler(activeQ, {
    event: "leadStatusOverview.activeReport.load_failed",
    component: "LeadStatusOverview",
    procedure: "reports.getActive",
    toastPrefix: "Failed to load active report",
  });
  useQueryErrorHandler(overviewQ, {
    event: "leadStatusOverview.load_failed",
    component: "LeadStatusOverview",
    procedure: "leadForm.statusOverview",
    context: { reportId: targetReportId },
    toastPrefix: "Failed to load status overview",
  });

  if (session?.isLoading || shouldRouteAway) return <OverviewSkeleton />;
  if (!targetReportId && activeQ.isLoading) return <OverviewSkeleton />;
  if (!targetReportId) {
    return (
      <section className="card-surface p-6" role="status">
        No active reporting period is available.
      </section>
    );
  }
  if (overviewQ.isLoading || editor.status === "loading") {
    return <OverviewSkeleton />;
  }
  if (overviewQ.isError || !overviewQ.data) {
    return (
      <section className="card-surface space-y-3 p-6" role="alert">
        <h1 className="text-xl font-semibold text-[var(--color-primary)]">
          Status overview unavailable
        </h1>
        <button
          type="button"
          className="btn-press rounded-[var(--radius-pill)] border border-[var(--color-border-strong)] px-4 py-2 text-sm font-semibold"
          onClick={() => void overviewQ.refetch()}
        >
          Try again
        </button>
      </section>
    );
  }

  return (
    <LeadStatusOverviewContent
      targetReportId={targetReportId}
      output={overviewQ.data}
      editor={editor}
    />
  );
}
