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
  type KanbanItem,
  projectStatusOverview,
  StatusOverview,
  type StatusOverviewCreateTarget,
  type StatusOverviewEditTarget,
} from "../../../../report-sections";
import { autosaveStatusCopy } from "../chrome/autosave-state-copy";
import {
  buildStatusOverviewCreatePatch,
  buildStatusOverviewItemPatch,
  findEditableItem,
  OverviewItemDialog,
  type OverviewItemDialogState,
} from "./lead-status-overview-item-editor";
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
    if (item) {
      setDialog({
        mode: "edit",
        generation: readyEditor.generation,
        target,
        item,
      });
    }
  };
  const handleAddItem = (target: StatusOverviewCreateTarget): void => {
    if (!readyEditor || isReadOnly) return;
    const unit = model.units.find(
      (candidate) =>
        candidate.kind === target.unitKind && candidate.id === target.unitId,
    );
    if (!unit || unit.historical) return;
    setDialog({
      mode: "create",
      generation: readyEditor.generation,
      target,
    });
  };
  const handleDialogSave = (updatedItem: KanbanItem): void => {
    if (!readyEditor || !dialog || isReadOnly) return;
    if (dialog.generation !== readyEditor.generation) {
      setDialog(null);
      return;
    }
    const patch =
      dialog.mode === "edit"
        ? buildStatusOverviewItemPatch(
            dialog.target,
            readyEditor.view.viewModel.ownCurrentWeekItems,
            readyEditor.view.viewModel.ownNextWeekItems,
            updatedItem,
          )
        : buildStatusOverviewCreatePatch(
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
        onAddItem={readyEditor && !isReadOnly ? handleAddItem : undefined}
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
      {readyEditor &&
      dialog &&
      !isReadOnly &&
      dialog.generation === readyEditor.generation ? (
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
