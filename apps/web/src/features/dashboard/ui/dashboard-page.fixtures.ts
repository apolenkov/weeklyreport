import type { QueryObserverResult } from "@tanstack/react-query";

import {
  makeQueryState,
  type QueryStateInput,
} from "../../../test-utils/query-state";

export interface QueryState {
  readonly data?: unknown;
  readonly error?: Error | null;
  readonly status?: "pending" | "error" | "success";
  readonly fetchStatus?: "fetching" | "paused" | "idle";
  readonly refetch?: () => Promise<unknown>;
}

export const ACTIVE_WEEKLY = {
  status: "active",
  reportId: "report-1",
  weekLabel: "Week 20",
  periodStatus: "open",
  submissionCount: 2,
  hasActiveReminderRule: true,
  leadSections: [],
};

export const ACTIVE_ACTIVITY = {
  reportId: "report-1",
  periodStatus: "open",
  rows: [],
};

export const queryStates = new Map<string, QueryObserverResult>();

export function setQueryState(key: string, overrides: QueryState) {
  const input = {
    data: overrides.data,
    ...(overrides.error ? { error: overrides.error } : {}),
    ...(overrides.status ? { status: overrides.status } : {}),
    ...(overrides.fetchStatus ? { fetchStatus: overrides.fetchStatus } : {}),
    ...(overrides.refetch ? { refetch: overrides.refetch } : {}),
  } satisfies QueryStateInput<unknown>;
  queryStates.set(key, makeQueryState(input));
}
