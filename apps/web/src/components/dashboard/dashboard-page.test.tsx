import "@testing-library/jest-dom/vitest";

import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useQuery } from "@tanstack/react-query";

import { DashboardPage, DASHBOARD_LOAD_STALL_MS } from "./dashboard-page";
import { logClientError } from "../../lib/client-error-reporting";

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock("../../lib/client-error-reporting", () => ({
  formatClientErrorMessage: vi.fn((prefix: string, error: unknown) =>
    error instanceof Error ? `${prefix}: ${error.message}` : prefix,
  ),
  logClientError: vi.fn(),
}));

vi.mock("../../lib/trpc-context", () => ({
  useTRPC: () => ({
    review: {
      dashboard: {
        queryOptions: () => ({ queryKey: ["review.dashboard"] }),
      },
    },
    weeklyReport: {
      get: {
        queryOptions: () => ({ queryKey: ["weeklyReport.get"] }),
      },
    },
  }),
}));

vi.mock("./dashboard-skeleton", () => ({
  DashboardSkeleton: () => <div>Dashboard skeleton</div>,
}));

vi.mock("./activity-live-panel", () => ({
  ActivityLivePanel: () => <div>Activity</div>,
}));

vi.mock("./kpi-cards", () => ({
  KpiCards: () => <div>KPI</div>,
}));

vi.mock("./alert-bar", () => ({
  AlertBar: () => <div>Alerts</div>,
}));

vi.mock("./blocked-at-risk-table", () => ({
  BlockedAtRiskTable: () => <div>Blocked</div>,
}));

type QueryState = {
  data?: unknown;
  error?: Error | null;
  isError?: boolean;
  isLoading?: boolean;
  status?: "pending" | "error" | "success";
  fetchStatus?: "fetching" | "paused" | "idle";
  refetch?: ReturnType<typeof vi.fn>;
};

const queryStates = new Map<string, Required<QueryState>>();

function makeQueryState(overrides: QueryState = {}): Required<QueryState> {
  return {
    data: undefined,
    error: null,
    isError: false,
    isLoading: false,
    status: "success",
    fetchStatus: "idle",
    refetch: vi.fn().mockResolvedValue({ data: overrides.data }),
    ...overrides,
  };
}

function setQueryState(key: string, state: QueryState) {
  queryStates.set(key, makeQueryState(state));
}

describe("DashboardPage loading guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryStates.clear();
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });

    vi.mocked(useQuery).mockImplementation((options: unknown) => {
      const key = (options as { queryKey: [string] }).queryKey[0];
      const state = queryStates.get(key);
      if (!state) throw new Error(`Missing query mock for ${key}`);
      return state as unknown as ReturnType<typeof useQuery>;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("does not keep the dashboard on the skeleton after a query error", () => {
    setQueryState("review.dashboard", {
      error: new Error("review failed"),
      isError: true,
      status: "error",
    });
    setQueryState("weeklyReport.get", {
      data: { reportId: "report-1" },
    });

    render(<DashboardPage />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not load dashboard",
    );
    expect(screen.queryByText("Dashboard skeleton")).not.toBeInTheDocument();
  });

  it("logs, retries, and leaves the skeleton when dashboard queries stall", () => {
    vi.useFakeTimers();
    setQueryState("review.dashboard", {
      status: "pending",
      fetchStatus: "fetching",
      refetch: vi.fn().mockResolvedValue({}),
    });
    setQueryState("weeklyReport.get", {
      status: "pending",
      fetchStatus: "fetching",
      refetch: vi.fn().mockResolvedValue({}),
    });

    render(<DashboardPage />);
    expect(screen.getByText("Dashboard skeleton")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(DASHBOARD_LOAD_STALL_MS);
    });

    expect(logClientError).toHaveBeenCalledWith(
      "dashboard.load_stalled",
      expect.any(Error),
      expect.objectContaining({
        component: "DashboardPage",
        reviewStatus: "pending",
        reviewFetchStatus: "fetching",
      }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Dashboard is still loading",
    );
    expect(screen.queryByText("Dashboard skeleton")).not.toBeInTheDocument();
    expect(queryStates.get("review.dashboard")?.refetch).toHaveBeenCalled();
    expect(queryStates.get("weeklyReport.get")?.refetch).toHaveBeenCalled();
  });

  it("recovers when the browser restores a pending dashboard from history", () => {
    setQueryState("review.dashboard", {
      status: "pending",
      fetchStatus: "fetching",
      refetch: vi.fn().mockResolvedValue({}),
    });
    setQueryState("weeklyReport.get", {
      status: "pending",
      fetchStatus: "fetching",
      refetch: vi.fn().mockResolvedValue({}),
    });

    render(<DashboardPage />);
    const event = new Event("pageshow") as PageTransitionEvent;
    Object.defineProperty(event, "persisted", { value: true });

    act(() => {
      window.dispatchEvent(event);
    });

    expect(logClientError).toHaveBeenCalledWith(
      "dashboard.pageshow_missing_data",
      expect.any(Error),
      expect.objectContaining({
        component: "DashboardPage",
        reviewStatus: "pending",
        reviewFetchStatus: "fetching",
      }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Dashboard is still loading",
    );
    expect(queryStates.get("review.dashboard")?.refetch).toHaveBeenCalled();
    expect(queryStates.get("weeklyReport.get")?.refetch).toHaveBeenCalled();
  });
});
