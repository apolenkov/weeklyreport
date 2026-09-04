"use client";

import { useQuery } from "@tanstack/react-query";
import { useContext } from "react";

import { useQueryErrorHandler } from "../../../../../shared/hooks/query/use-query-error-handler";
import { SessionContext } from "../../../../../shared/lib/auth/session-provider";
import { useTRPC } from "../../../../../shared/lib/trpc/trpc-context";
import { LeadStatusOverviewContent } from "./lead-status-overview-content";
import {
  deriveActiveIds,
  deriveTargetReportId,
} from "./use-lead-form-data-helpers";
import { useLeadFormEditor } from "./use-lead-form-editor";

export { buildStatusOverviewDetailsHref } from "./lead-status-overview-content";

interface LeadStatusOverviewProps {
  readonly reportId?: string | undefined;
  readonly redirectToCanonical?: boolean | undefined;
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
