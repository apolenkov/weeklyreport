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
import { reportHasContent } from "../../lib/mappers/report-content";
import { SessionContext } from "../../lib/session-provider";
import { useTRPC } from "../../lib/trpc-context";
import { PublishLockButton } from "./publish-lock-button";

interface HeadPublishLockActionProps {
  /** The report period the slides deck is showing. */
  readonly reportId: string;
}

/**
 * head-surface-uat-polish (F1): the slides-mode header hosts the same
 * Publish & Lock / Reopen action the edit-mode page offers, so the head can
 * lock a period straight from the review deck (this replaced the removed
 * "Open focused report" drill-in link). Self-contained: it fetches the
 * displayed period, derives the publish gating, and owns the publish/reopen
 * mutations — mirroring `WeeklyReportPage` (the publish gating + cache
 * invalidation are the same). Renders nothing for non-head/admin roles or when
 * no active period resolves, so it is safe to mount unconditionally.
 */
export function HeadPublishLockAction({
  reportId,
}: HeadPublishLockActionProps) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const sessionState = useContext(SessionContext);
  const currentRole = sessionState?.user?.role ?? null;
  const canMutatePeriod = currentRole === "head" || currentRole === "admin";

  const weeklyQ = useQuery(trpc.weeklyReport.get.queryOptions({ reportId }));

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

  if (!canMutatePeriod) return null;
  if (!weeklyQ.data || weeklyQ.data.status === "no-period") return null;

  const view = mapWeeklyReport(weeklyQ.data);
  const submitted = view.submissionCount;
  const total = view.totalLeads;
  // pendingCount mirrors WeeklyReportPage: total - submitted, clamped >= 0.
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
