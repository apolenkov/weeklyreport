"use client";

import {
  type QueryKey,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";

import { useQueryErrorHandler } from "../../../shared/hooks/query/use-query-error-handler";
import { logClientError } from "../../../shared/lib/errors/client-error-reporting";
import { invalidateSubmissionDashboard } from "../../../shared/lib/query/cache-keys";
import { useTRPC } from "../../../shared/lib/trpc/trpc-context";
import { useDashboardQueryRecovery } from "./use-dashboard-query-recovery";

const ACTIVITY_POLL_INTERVAL_MS = 15_000;

interface DashboardRecoveryQuery {
  readonly data: unknown;
  readonly fetchStatus: string;
  readonly isError: boolean;
  readonly refetch: () => Promise<unknown>;
  readonly status: string;
}

function useQueryRecovery(
  name: "activity" | "review" | "weeklyReport",
  query: DashboardRecoveryQuery,
  queryKey: QueryKey,
) {
  const client = useQueryClient();
  const { refetch } = query;
  const restart = useCallback(async () => {
    const state = client.getQueryState(queryKey);
    // An initial refetch reuses its pending request unless it is cancelled first.
    if (state?.data === undefined && state?.fetchStatus === "fetching") {
      await client.cancelQueries({ queryKey, exact: true });
    }
    return refetch();
  }, [client, queryKey, refetch]);
  return useDashboardQueryRecovery({
    name,
    hasData: query.data !== undefined,
    isError: query.isError,
    status: query.status,
    fetchStatus: query.fetchStatus,
    refetch: restart,
  });
}

function useReviewDashboardQuery() {
  const trpc = useTRPC();
  const options = useMemo(() => trpc.review.dashboard.queryOptions(), [trpc]);
  const query = useQuery({
    ...options,
    staleTime: 60_000,
  });
  useQueryErrorHandler(query, {
    event: "dashboard.review.load_failed",
    component: "DashboardPage",
    procedure: "review.dashboard",
    toastPrefix: "Failed to load dashboard",
  });
  const recovery = useQueryRecovery("review", query, options.queryKey);
  return { query, recovery };
}

function useWeeklyDashboardQuery() {
  const trpc = useTRPC();
  const options = useMemo(() => trpc.weeklyReport.get.queryOptions({}), [trpc]);
  const query = useQuery({
    ...options,
    staleTime: 60_000,
  });
  useQueryErrorHandler(query, {
    event: "dashboard.weeklyReport.load_failed",
    component: "DashboardPage",
    procedure: "weeklyReport.get",
    context: { reportId: null },
    toastPrefix: "Failed to load status report",
  });
  const recovery = useQueryRecovery("weeklyReport", query, options.queryKey);
  return { query, recovery };
}

function useActivityDashboardQuery() {
  const trpc = useTRPC();
  const options = useMemo(() => trpc.activity.live.queryOptions(), [trpc]);
  const query = useQuery({
    ...options,
    refetchInterval: ACTIVITY_POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
  });
  useQueryErrorHandler(query, {
    event: "dashboard.activity.load_failed",
    component: "DashboardPage",
    procedure: "activity.live",
    toastPrefix: "Failed to load dashboard freshness",
  });
  const recovery = useQueryRecovery("activity", query, options.queryKey);
  return { query, recovery };
}

function useDashboardQueries() {
  const review = useReviewDashboardQuery();
  const weekly = useWeeklyDashboardQuery();
  const activity = useActivityDashboardQuery();
  const refreshDashboardData = useCallback(async () => {
    // Surface every refetch rejection through the same logClientError seam the
    // query load failures use — a rejected refetch must not be silently dropped.
    const results = await Promise.allSettled([
      review.query.refetch(),
      weekly.query.refetch(),
      activity.query.refetch(),
    ]);
    for (const result of results) {
      if (result.status === "rejected") {
        logClientError("dashboard.refresh_refetch_failed", result.reason, {
          component: "DashboardPage",
        });
      }
    }
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
        invalidateSubmissionDashboard(queryClient, trpc);
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
