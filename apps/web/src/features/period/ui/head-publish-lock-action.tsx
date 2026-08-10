"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useContext } from "react";
import { toast } from "sonner";

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

export function HeadPublishLockAction({
  reportId,
}: HeadPublishLockActionProps) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const sessionState = useContext(SessionContext);
  const currentRole = sessionState?.user?.role ?? null;
  const canMutatePeriod = isHeadLike(currentRole);

  const weeklyQ = useQuery(trpc.weeklyReport.get.queryOptions({ reportId }));

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
