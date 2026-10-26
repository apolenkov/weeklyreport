"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useContext } from "react";

import { useQueryErrorHandler } from "../../../../../shared/hooks/query/use-query-error-handler";
import { isHeadLike } from "../../../../../shared/lib/auth/role-predicates";
import { SessionContext } from "../../../../../shared/lib/auth/session-provider";
import { formatClientErrorMessage } from "../../../../../shared/lib/errors/client-error-reporting";
import { useTRPC } from "../../../../../shared/lib/trpc/trpc-context";
import { LEAD_REPORT_ROUTE } from "../../../../../shared/ui/navigation/nav-links";
import { DraftStageMemoryProvider } from "../../../../report-sections";
import { LeadFormEmptyState } from "./lead-form-empty-state";
import { LeadFormLoadError } from "./lead-form-load-error";
import { LeadStatusOverviewContent } from "./lead-status-overview-content";
import {
  deriveActiveIds,
  deriveTargetReportId,
} from "./use-lead-form-data-helpers";
import {
  type LeadFormEditorHandle,
  useLeadFormEditor,
} from "./use-lead-form-editor";

export { buildStatusOverviewDetailsHref } from "./lead-status-overview-content";

const OVERVIEW_LOAD_FAILURE = "Failed to load status overview";

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
      data-layout-key="report-page"
      data-layout-stability="position-width"
    >
      <div className="h-12 animate-pulse motion-reduce:animate-none rounded-[var(--radius)] bg-[var(--color-muted)]" />
      {Array.from({ length: 3 }, (_, index) => (
        <div
          key={index}
          className="h-28 animate-pulse motion-reduce:animate-none rounded-[var(--radius)] bg-[var(--color-muted)]"
        />
      ))}
    </div>
  );
}

function OverviewUnavailable({
  message,
  onRetry,
}: {
  readonly message: string | null;
  readonly onRetry: () => void;
}) {
  const action =
    "btn-press rounded-[var(--radius-pill)] border border-[var(--color-border-strong)] px-4 py-2 text-sm font-semibold";
  return (
    <section className="card-surface space-y-3 p-6" role="alert">
      <h1 className="text-xl font-semibold text-[var(--color-primary)]">
        Status overview unavailable
      </h1>
      {message ? <p className="text-sm">{message}</p> : null}
      <div className="flex flex-wrap gap-3">
        <button type="button" className={action} onClick={onRetry}>
          Try again
        </button>
        <Link href={LEAD_REPORT_ROUTE} className={action}>
          Go to the current report
        </Link>
      </div>
    </section>
  );
}

function OverviewWithoutTarget({
  editor,
  activeAbsent,
}: {
  readonly editor: LeadFormEditorHandle;
  readonly activeAbsent: boolean;
}) {
  if (editor.status === "error") {
    return (
      <LeadFormLoadError
        isRetrying={editor.isRetrying}
        onRetry={editor.retry}
      />
    );
  }
  if (activeAbsent) {
    return (
      <LeadFormEmptyState
        titleId="lead-overview-no-active-title"
        title="No active reporting period"
      >
        <p role="status" className="text-sm text-[var(--color-foreground)]">
          No active reporting period is available.
        </p>
      </LeadFormEmptyState>
    );
  }
  return <OverviewSkeleton />;
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
  const shouldRouteAway = isHeadLike(session?.user?.role ?? null);
  const overviewQ = useQuery({
    ...trpc.leadForm.statusOverview.queryOptions({
      reportId: targetReportId ?? "",
    }),
    enabled: targetReportId !== null && !session?.isLoading && !shouldRouteAway,
    staleTime: 30_000,
  });

  // The editor already reports a getActive failure (useLeadFormLoadErrors);
  // a second handler on the same query would toast and log it twice.
  useQueryErrorHandler(overviewQ, {
    event: "leadStatusOverview.load_failed",
    component: "LeadStatusOverview",
    procedure: "leadForm.statusOverview",
    context: { reportId: targetReportId },
    toastPrefix: OVERVIEW_LOAD_FAILURE,
  });

  if (session?.isLoading || shouldRouteAway) return <OverviewSkeleton />;
  if (!targetReportId)
    return (
      <OverviewWithoutTarget
        editor={editor}
        activeAbsent={activeQ.data === null}
      />
    );
  if (overviewQ.isLoading) {
    return <OverviewSkeleton />;
  }
  if (!overviewQ.data) {
    return (
      <OverviewUnavailable
        message={
          overviewQ.isError
            ? formatClientErrorMessage(OVERVIEW_LOAD_FAILURE, overviewQ.error)
            : null
        }
        onRetry={() => void overviewQ.refetch()}
      />
    );
  }

  return (
    <DraftStageMemoryProvider
      memory={editor.status === "ready" ? editor.draft.stageMemory : null}
    >
      <LeadStatusOverviewContent
        key={targetReportId}
        targetReportId={targetReportId}
        output={overviewQ.data}
        editor={editor}
        refreshError={overviewQ.isError}
        onRefresh={() => void overviewQ.refetch()}
      />
    </DraftStageMemoryProvider>
  );
}
