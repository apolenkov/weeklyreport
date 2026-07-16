"use client";

import { useCallback, useEffect, useState } from "react";

import { logClientError } from "../../../lib/client-error-reporting";

export const DASHBOARD_LOAD_STALL_MS = 8000;

interface DashboardQueryRecoveryInput {
  readonly fetchStatus: string;
  readonly hasData: boolean;
  readonly isError: boolean;
  readonly name: "activity" | "review" | "weeklyReport";
  readonly refetch: () => Promise<unknown>;
  readonly status: string;
}

export function useDashboardQueryRecovery({
  fetchStatus,
  hasData,
  isError,
  name,
  refetch,
  status,
}: DashboardQueryRecoveryInput) {
  const [stalled, setStalled] = useState(false);
  const settled = hasData || isError;
  const retry = useCallback(() => {
    setStalled(false);
    void refetch();
  }, [refetch]);

  useEffect(() => {
    if (settled) setStalled(false);
  }, [settled]);

  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      const navigation = performance.getEntriesByType("navigation")[0] as
        | PerformanceNavigationTiming
        | undefined;
      if (!event.persisted && navigation?.type !== "back_forward") return;
      if (settled) return;

      logClientError(
        "dashboard.pageshow_unsettled_query",
        new Error(
          `Dashboard ${name} query was unsettled after history restore`,
        ),
        {
          component: "DashboardPage",
          path: window.location.pathname,
          query: name,
          status,
          fetchStatus,
        },
      );
      setStalled(true);
      void refetch();
    }

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [fetchStatus, name, refetch, settled, status]);

  useEffect(() => {
    if (settled || stalled) return;
    const timer = window.setTimeout(() => {
      logClientError(
        "dashboard.query_stalled",
        new Error(
          `Dashboard ${name} query did not settle within ${DASHBOARD_LOAD_STALL_MS}ms`,
        ),
        {
          component: "DashboardPage",
          path: window.location.pathname,
          query: name,
          status,
          fetchStatus,
        },
      );
      setStalled(true);
      void refetch();
    }, DASHBOARD_LOAD_STALL_MS);
    return () => window.clearTimeout(timer);
  }, [fetchStatus, name, refetch, settled, stalled, status]);

  return { retry, stalled } as const;
}
