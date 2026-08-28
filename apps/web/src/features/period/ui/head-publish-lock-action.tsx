"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useContext } from "react";
import { toast } from "sonner";

import { useQueryErrorHandler } from "../../../shared/hooks/query/use-query-error-handler";
import { isHeadLike } from "../../../shared/lib/auth/role-predicates";
import { SessionContext } from "../../../shared/lib/auth/session-provider";
import { mutationErrorMessage } from "../../../shared/lib/errors/mutation-error-message";
import { invalidatePeriodLifecycle } from "../../../shared/lib/query/cache-keys";
import { useTRPC } from "../../../shared/lib/trpc/trpc-context";
import { mapWeeklyReport, reportHasContent } from "../../report-sections";
import { PublishLockButton } from "./publish-lock-button";

interface HeadPublishLockActionProps {
  readonly reportId: string;
}

function PublishStatusLoadError({
  isRetrying,
  onRetry,
}: {
  readonly isRetrying: boolean;
  readonly onRetry: () => void;
}) {
  return (
    <button
      type="button"
      aria-label="Retry loading publish controls"
      className="btn-press inline-flex h-[var(--toolbar-control-h)] items-center gap-2 rounded-[var(--radius-pill)] border border-[var(--color-destructive)] bg-transparent px-4 py-1.5 text-sm font-semibold text-[var(--color-destructive)] hover:bg-[var(--color-surface-hover)] disabled:cursor-wait disabled:opacity-60"
      disabled={isRetrying}
      onClick={onRetry}
      title="Publish controls could not be loaded"
    >
      <RefreshCw aria-hidden="true" className="h-4 w-4" />
      {isRetrying ? "Retrying…" : "Retry publish"}
    </button>
  );
}

// Publish and reopen flip the same period state, so both have to refresh the
// dashboard, the lead form and lead history together — only the copy differs.
function periodMutationCallbacks(
  qc: ReturnType<typeof useQueryClient>,
  trpc: ReturnType<typeof useTRPC>,
  messages: { readonly success: string; readonly failure: string },
) {
  return {
    onSuccess: () => {
      invalidatePeriodLifecycle(qc, trpc);
      toast.success(messages.success);
    },
    onError: (err: unknown) => {
      toast.error(mutationErrorMessage(err, messages.failure));
    },
  };
}

function useWeeklyReportForPublish(reportId: string) {
  const trpc = useTRPC();
  const query = useQuery(trpc.weeklyReport.get.queryOptions({ reportId }));
  useQueryErrorHandler(query, {
    component: "HeadPublishLockAction",
    context: { reportId },
    event: "period.publish_controls.load_failed",
    procedure: "weeklyReport.get",
  });
  return query;
}

export function HeadPublishLockAction({
  reportId,
}: HeadPublishLockActionProps) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const sessionState = useContext(SessionContext);
  const currentRole = sessionState?.user?.role ?? null;
  const canMutatePeriod = isHeadLike(currentRole);

  const weeklyQ = useWeeklyReportForPublish(reportId);

  const publishMut = useMutation(
    trpc.period.publish.mutationOptions(
      periodMutationCallbacks(qc, trpc, {
        success: "Period published & locked",
        failure: "Failed to publish period",
      }),
    ),
  );

  const reopenMut = useMutation(
    trpc.period.reopen.mutationOptions(
      periodMutationCallbacks(qc, trpc, {
        success: "Period reopened",
        failure: "Failed to reopen period",
      }),
    ),
  );

  if (!canMutatePeriod) return null;
  if (weeklyQ.isError) {
    return (
      <PublishStatusLoadError
        isRetrying={weeklyQ.isFetching}
        onRetry={() => {
          void weeklyQ.refetch().catch(() => undefined);
        }}
      />
    );
  }
  if (!weeklyQ.data || weeklyQ.data.status === "no-period") return null;

  const view = mapWeeklyReport(weeklyQ.data);
  const submitted = view.submissionCount;
  const total = view.totalLeads;
  const pendingCount = Math.max(0, total - submitted);
  const hasExpandableProducts = view.products.some(reportHasContent);
  const canPublishReport = submitted > 0 && hasExpandableProducts;

  return (
    <PublishLockButton
      pendingCount={pendingCount}
      totalLeads={total}
      periodStatus={view.period.periodStatus}
      onPublish={() => publishMut.mutate({ reportId: view.period.reportId })}
      onReopen={() => reopenMut.mutate({ reportId: view.period.reportId })}
      isPending={publishMut.isPending || reopenMut.isPending}
      canPublish={canPublishReport}
    />
  );
}
