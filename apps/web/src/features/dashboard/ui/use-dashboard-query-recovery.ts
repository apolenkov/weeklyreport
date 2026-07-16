"use client";

import type { Dispatch, SetStateAction } from "react";
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

interface RecoveryEffectInput extends DashboardQueryRecoveryInput {
  readonly settled: boolean;
  readonly stalled: boolean;
  readonly setStalled: Dispatch<SetStateAction<boolean>>;
}

function logRecovery(
  event: string,
  message: string,
  query: Pick<DashboardQueryRecoveryInput, "fetchStatus" | "name" | "status">,
) {
  logClientError(event, new Error(message), {
    component: "DashboardPage",
    path: window.location.pathname,
    query: query.name,
    status: query.status,
    fetchStatus: query.fetchStatus,
  });
}

function useHistoryRecovery(input: RecoveryEffectInput) {
  const { fetchStatus, name, refetch, setStalled, settled, status } = input;
  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      const navigation = performance.getEntriesByType("navigation")[0] as
        | PerformanceNavigationTiming
        | undefined;
      if (!event.persisted && navigation?.type !== "back_forward") return;
      if (settled) return;
      logRecovery(
        "dashboard.pageshow_unsettled_query",
        `Dashboard ${name} query was unsettled after history restore`,
        { fetchStatus, name, status },
      );
      setStalled(true);
      void refetch();
    }

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [fetchStatus, name, refetch, setStalled, settled, status]);
}

function useStallRecovery(input: RecoveryEffectInput) {
  const { fetchStatus, name, refetch, setStalled, settled, stalled, status } =
    input;
  useEffect(() => {
    if (settled || stalled) return;
    const timer = window.setTimeout(() => {
      logRecovery(
        "dashboard.query_stalled",
        `Dashboard ${name} query did not settle within ${DASHBOARD_LOAD_STALL_MS}ms`,
        { fetchStatus, name, status },
      );
      setStalled(true);
      void refetch();
    }, DASHBOARD_LOAD_STALL_MS);
    return () => window.clearTimeout(timer);
  }, [fetchStatus, name, refetch, setStalled, settled, stalled, status]);
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
  const recovery = {
    fetchStatus,
    hasData,
    isError,
    name,
    refetch,
    status,
    settled,
    stalled,
    setStalled,
  };
  useHistoryRecovery(recovery);
  useStallRecovery(recovery);

  return { retry, stalled } as const;
}
