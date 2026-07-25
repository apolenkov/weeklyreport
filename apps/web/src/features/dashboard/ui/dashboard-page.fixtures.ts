import { vi } from "vitest";

export interface QueryState {
  readonly data?: unknown;
  readonly error?: Error | null;
  readonly isError?: boolean;
  readonly status?: "pending" | "error" | "success";
  readonly fetchStatus?: "fetching" | "paused" | "idle";
  readonly refetch?: ReturnType<typeof vi.fn>;
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

export const queryStates = new Map<string, Required<QueryState>>();

/**
 * Set Query State.
 * @param key - The key argument.
 * @param overrides - The overrides argument.
 */
export function setQueryState(key: string, overrides: QueryState) {
  queryStates.set(key, {
    data: undefined,
    error: null,
    isError: false,
    status: "success",
    fetchStatus: "idle",
    refetch: vi.fn().mockResolvedValue({ data: overrides.data }),
    ...overrides,
  });
}
