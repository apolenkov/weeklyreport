"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useContext } from "react";
import { toast } from "sonner";

import {
  invalidateDashboard,
  invalidateLeadForm,
  invalidateLeadHistory,
} from "../../lib/cache-keys";
import { mapWeeklyReport } from "../../lib/mappers";
import { SessionContext } from "../../lib/session-provider";
import { useTRPC } from "../../lib/trpc-context";
import type { ProductReport } from "../dashboard/mock-data";
import { ExportPdfButton } from "./export-pdf-button";
import { PublishLockButton } from "./publish-lock-button";

interface ReportMutationActionsProps {
  /**
   * Concrete report identifier (UUID). When provided, scopes the
   * `weeklyReport.get` query to that report; otherwise the server falls back
   * to the session's active period. Same query key as WeeklyReportPage and the
   * HeadReportShell, so React Query dedupes — no extra network request.
   */
  readonly reportId?: string;
}

/**
 * Head period-mutation cluster — Export PDF + Archive + Publish/Reopen.
 *
 * lead-live-walk-2026-06-14 task 5.3: extracted from WeeklyReportPage's header
 * row so the same control set can live INSIDE the shared ReportActionsPill
 * (alongside Present/Print) for the head report shell — one consolidated bar in
 * both form and slides mode. The component self-queries `weeklyReport.get`
 * (deduped), role-gates via SessionContext, and owns the publish/reopen/archive
 * mutations + their cache invalidation and toasts — a pure move, behavior and
 * aria unchanged from the former inline cluster.
 */
export function ReportMutationActions({
  reportId,
}: ReportMutationActionsProps) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const sessionState = useContext(SessionContext);
  const currentRole = sessionState?.user?.role ?? null;
  const canMutatePeriod = currentRole === "head" || currentRole === "admin";
  // driver-findings-2026-06-11 finding 3 (decision 2026-06-13): leads SHOULD
  // have Export-PDF, so the button is shown to lead + head + admin. Viewer is
  // excluded (read-only role keeps the plain /print link).
  const canExportPdf = canMutatePeriod || currentRole === "lead";

  const queryInput = reportId ? { reportId } : {};
  const weeklyQ = useQuery(trpc.weeklyReport.get.queryOptions(queryInput));

  const publishMut = useMutation(
    trpc.period.publish.mutationOptions({
      onSuccess: () => {
        invalidateDashboard(qc, trpc);
        invalidateLeadHistory(qc, trpc);
        toast.success("Period published & locked");
      },
      onError: (err: unknown) => {
        toast.error(
          err instanceof Error ? err.message : "Failed to publish period",
        );
      },
    }),
  );

  const reopenMut = useMutation(
    trpc.period.reopen.mutationOptions({
      onSuccess: () => {
        invalidateDashboard(qc, trpc);
        invalidateLeadForm(qc, trpc);
        invalidateLeadHistory(qc, trpc);
        toast.success("Period reopened");
      },
      onError: (err: unknown) => {
        toast.error(
          err instanceof Error ? err.message : "Failed to reopen period",
        );
      },
    }),
  );

  // A22: archive mutation — head moves a published report into the archive so
  // it appears in archive.list. Only visible when periodStatus==='published'.
  const archiveMut = useMutation(
    trpc.archive.archiveReport.mutationOptions({
      onSuccess: () => {
        invalidateDashboard(qc, trpc);
        toast.success("Report archived");
      },
      onError: (err: unknown) => {
        toast.error(
          err instanceof Error ? err.message : "Failed to archive report",
        );
      },
    }),
  );

  const reportData = weeklyQ.data;
  if (!reportData || reportData.status === "no-period") {
    return null;
  }

  const view = mapWeeklyReport(reportData);
  const submitted = view.submissionCount;
  const total = view.totalLeads;
  // pendingCount mirrors mock semantics: total - submitted, clamped >= 0.
  const pendingCount = Math.max(0, total - submitted);

  const products: ProductReport[] = view.products;
  const hasReportContent = (report: ProductReport) =>
    Boolean(report.needsAttention) ||
    report.currentWeek.length > 0 ||
    report.nextWeek.length > 0 ||
    report.risks.length > 0 ||
    report.decisions.length > 0 ||
    report.priorities.length > 0;
  const hasExpandableProducts = products.some(hasReportContent);
  const canPublishReport = submitted > 0 && hasExpandableProducts;

  return (
    <>
      {/* The async export starts a `pdfExport.request` job. Visibility
          matches the widened authz (leadHeadAdminProcedure): lead + head +
          admin see the button, viewer does not (the read-only
          /reports/[reportId] route still offers a plain /print link for
          every role). driver sweep 2026-06-09 + finding 3 (2026-06-13). */}
      {canExportPdf && (
        <ExportPdfButton
          reportId={view.period.reportId}
          periodStatus={view.period.periodStatus}
        />
      )}
      {/* A22: "Archive" button — shown to head once the period is published.
          Moves the report into the archive (sets archived=true) so it
          appears in the Archive tab. The button is hidden after archiving
          because this page only navigates to current/active periods. */}
      {canMutatePeriod && view.period.periodStatus === "published" && (
        <button
          type="button"
          className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-transparent px-4 py-1.5 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-muted-foreground)] transition-colors hover:border-[var(--color-starbucks-accent)] hover:text-[var(--color-starbucks-accent)] disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => archiveMut.mutate({ reportId: view.period.reportId })}
          disabled={archiveMut.isPending}
          aria-label="Move this report to the archive"
        >
          {archiveMut.isPending ? "Archiving…" : "Archive"}
        </button>
      )}
      {canMutatePeriod && (
        <PublishLockButton
          pendingCount={pendingCount}
          totalLeads={total}
          periodStatus={view.period.periodStatus}
          onPublish={() =>
            publishMut.mutate({ reportId: view.period.reportId })
          }
          onReopen={() => reopenMut.mutate({ reportId: view.period.reportId })}
          isPending={publishMut.isPending || reopenMut.isPending}
          canPublish={canPublishReport}
          publishDisabledReason="No submitted report content yet."
        />
      )}
    </>
  );
}
