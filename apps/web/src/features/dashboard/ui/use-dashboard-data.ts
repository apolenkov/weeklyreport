"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "sonner";

import { useTRPC } from "../../../lib/trpc-context";
import { useQueryErrorHandler } from "../../../lib/use-query-error-handler";
import { useDashboardQueryRecovery } from "./use-dashboard-query-recovery";

const ACTIVITY_POLL_INTERVAL_MS = 15_000;

interface DashboardRecoveryQuery {
  readonly data: unknown;
  readonly fetchStatus: string;
  readonly isError: boolean;
  readonly refetch: () => Promise<unknown>;
  readonly status: string;
}

function recoveryInput(
  name: "activity" | "review" | "weeklyReport",
  query: DashboardRecoveryQuery,
) {
  return {
    name,
    hasData: query.data !== undefined,
    isError: query.isError,
    status: query.status,
    fetchStatus: query.fetchStatus,
    refetch: query.refetch,
  };
}

function useReviewDashboardQuery() {
  const trpc = useTRPC();
  const query = useQuery({
    ...trpc.review.dashboard.queryOptions(),
    staleTime: 60_000,
  });
  useQueryErrorHandler(query, {
    event: "dashboard.review.load_failed",
    component: "DashboardPage",
    procedure: "review.dashboard",
    toastPrefix: "Failed to load dashboard",
  });
  const recovery = useDashboardQueryRecovery(recoveryInput("review", query));
  return { query, recovery };
}

function useWeeklyDashboardQuery() {
  const trpc = useTRPC();
  const query = useQuery({
    ...trpc.weeklyReport.get.queryOptions({}),
    staleTime: 60_000,
  });
  useQueryErrorHandler(query, {
    event: "dashboard.weeklyReport.load_failed",
    component: "DashboardPage",
    procedure: "weeklyReport.get",
    context: { reportId: null },
    toastPrefix: "Failed to load status report",
  });
  const recovery = useDashboardQueryRecovery(
    recoveryInput("weeklyReport", query),
  );
  return { query, recovery };
}

function useActivityDashboardQuery() {
  const trpc = useTRPC();
  const query = useQuery({
    ...trpc.activity.live.queryOptions(),
    refetchInterval: ACTIVITY_POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
  });
  useQueryErrorHandler(query, {
    event: "dashboard.activity.load_failed",
    component: "DashboardPage",
    procedure: "activity.live",
    toastPrefix: "Failed to load dashboard freshness",
  });
  const recovery = useDashboardQueryRecovery(recoveryInput("activity", query));
  return { query, recovery };
}

function useDashboardQueries() {
  const review = useReviewDashboardQuery();
  const weekly = useWeeklyDashboardQuery();
  const activity = useActivityDashboardQuery();
  const refreshDashboardData = useCallback(() => {
    void Promise.allSettled([
      review.query.refetch(),
      weekly.query.refetch(),
      activity.query.refetch(),
    ]);
  }, [review.query, weekly.query, activity.query]);
  return {
    reviewQ: review.query,
    reviewRecovery: review.recovery,
    weeklyQ: weekly.query,
    weeklyRecovery: weekly.recovery,
    activityQ: activity.query,
    activityRecovery: activity.recovery,
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
        void Promise.allSettled([
          queryClient.invalidateQueries(trpc.weeklyReport.get.queryOptions({})),
          queryClient.invalidateQueries(trpc.review.dashboard.queryOptions()),
          queryClient.invalidateQueries(trpc.activity.live.queryOptions()),
        ]);
      },
      onError: (error) => toast.error(`Revoke All failed: ${error.message}`),
    }),
  );
}

/**
 * Use Dashboard Data.
 */
export function useDashboardData() {
  return {
    ...useDashboardQueries(),
    revokeAllMutation: useRevokeAllSubmitted(),
  };
}
