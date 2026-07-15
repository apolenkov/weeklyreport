"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "sonner";

import { useTRPC } from "../../../lib/trpc-context";
import { useQueryErrorHandler } from "../../../lib/use-query-error-handler";
import { useDashboardQueryRecovery } from "./use-dashboard-query-recovery";

function useDashboardQueries() {
  const trpc = useTRPC();
  const reviewQ = useQuery({
    ...trpc.review.dashboard.queryOptions(),
    staleTime: 60_000,
  });
  const weeklyQ = useQuery({
    ...trpc.weeklyReport.get.queryOptions({}),
    staleTime: 60_000,
  });
  useQueryErrorHandler(reviewQ, {
    event: "dashboard.review.load_failed",
    component: "DashboardPage",
    procedure: "review.dashboard",
    toastPrefix: "Failed to load dashboard",
  });
  useQueryErrorHandler(weeklyQ, {
    event: "dashboard.weeklyReport.load_failed",
    component: "DashboardPage",
    procedure: "weeklyReport.get",
    context: { reportId: null },
    toastPrefix: "Failed to load status report",
  });
  const reviewRecovery = useDashboardQueryRecovery({
    name: "review",
    hasData: reviewQ.data !== undefined,
    isError: reviewQ.isError,
    status: reviewQ.status,
    fetchStatus: reviewQ.fetchStatus,
    refetch: reviewQ.refetch,
  });
  const weeklyRecovery = useDashboardQueryRecovery({
    name: "weeklyReport",
    hasData: weeklyQ.data !== undefined,
    isError: weeklyQ.isError,
    status: weeklyQ.status,
    fetchStatus: weeklyQ.fetchStatus,
    refetch: weeklyQ.refetch,
  });
  const refetchReview = reviewQ.refetch;
  const refetchWeekly = weeklyQ.refetch;
  const refreshDashboardData = useCallback(() => {
    void Promise.allSettled([refetchReview(), refetchWeekly()]);
  }, [refetchReview, refetchWeekly]);
  return {
    reviewQ,
    reviewRecovery,
    weeklyQ,
    weeklyRecovery,
    refreshDashboardData,
  };
}

function useRevokeAllSubmitted() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.leadForm.revokeAllSubmitted.mutationOptions({
      onSuccess: (result) => {
        toast.success(
          `${result.revokedCount} submission${result.revokedCount === 1 ? "" : "s"} revoked.`,
        );
        void queryClient.invalidateQueries(
          trpc.weeklyReport.get.queryOptions({}),
        );
      },
      onError: (error) => toast.error(`Revoke All failed: ${error.message}`),
    }),
  );
}

export function useDashboardData() {
  return {
    ...useDashboardQueries(),
    revokeAllMutation: useRevokeAllSubmitted(),
  };
}
