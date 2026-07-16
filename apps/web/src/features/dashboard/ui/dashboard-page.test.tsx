/**
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";

import { useQuery } from "@tanstack/react-query";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { logClientError } from "../../../lib/client-error-reporting";
import { DashboardPage } from "./dashboard-page";
import {
  ACTIVE_ACTIVITY,
  ACTIVE_WEEKLY,
  queryStates,
  setQueryState,
} from "./dashboard-page.fixtures";
import { DASHBOARD_LOAD_STALL_MS } from "./use-dashboard-query-recovery";

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => ({ isPending: false, mutate: vi.fn() })),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("../../../lib/client-error-reporting", () => ({
  formatClientErrorMessage: vi.fn((prefix: string, error: unknown) =>
    error instanceof Error ? `${prefix}: ${error.message}` : prefix,
  ),
  logClientError: vi.fn(),
}));
vi.mock("../../../lib/trpc-context", () => ({
  useTRPC: () => ({
    activity: {
      live: { queryOptions: () => ({ queryKey: ["activity.live"] }) },
    },
    review: {
      dashboard: { queryOptions: () => ({ queryKey: ["review.dashboard"] }) },
    },
    weeklyReport: {
      get: { queryOptions: () => ({ queryKey: ["weeklyReport.get"] }) },
    },
    leadForm: { revokeAllSubmitted: { mutationOptions: () => ({}) } },
  }),
}));
vi.mock("../model/dashboard", () => ({
  mapWeeklyDashboardData: () => ({
    kpi: {},
    blockedAtRisk: [],
  }),
  mapReviewDashboardData: () => ({
    leads: [],
    pendingLeads: [],
  }),
}));
vi.mock("./kpi-cards", () => ({ KpiCards: () => <div>KPI</div> }));
vi.mock("./lead-summary-table", () => ({
  LeadSummaryTable: () => <div>Lead summary</div>,
}));
vi.mock("./alert-bar", () => ({ AlertBar: () => <div>Alerts</div> }));
vi.mock("./reopen-requests-card", () => ({
  ReopenRequestsCard: () => <div>Reopen requests</div>,
}));
vi.mock("./blocked-at-risk-table", () => ({
  BlockedAtRiskTable: () => <div>Blocked</div>,
}));
vi.mock("../../../shared/ui/confirmation-dialog", () => ({
  ConfirmationDialog: () => null,
}));

describe("DashboardPage progressive readiness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryStates.clear();
    setQueryState("activity.live", { data: ACTIVE_ACTIVITY });
    vi.mocked(useQuery).mockImplementation((options: unknown) => {
      const key = (options as { queryKey: [string] }).queryKey[0];
      const state = queryStates.get(key);
      if (!state) throw new Error(`Missing query mock for ${key}`);
      return state as unknown as ReturnType<typeof useQuery>;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the canonical queue without the duplicate activity and review rosters", () => {
    setQueryState("review.dashboard", { data: [] });
    setQueryState("weeklyReport.get", { data: ACTIVE_WEEKLY });
    render(<DashboardPage />);
    expect(screen.getByText("Week 20 · CustomReport")).toBeInTheDocument();
    expect(screen.getByText("KPI")).toBeInTheDocument();
    expect(screen.getByText("Lead summary")).toBeInTheDocument();
    expect(screen.queryByText("Activity")).not.toBeInTheDocument();
    expect(screen.queryByText("Review context")).not.toBeInTheDocument();
    expect(screen.getByText("Reopen requests")).toBeInTheDocument();
    expect(screen.getByText("Blocked")).toBeInTheDocument();
  });

  it("keeps weekly-backed panels visible while review remains pending", () => {
    setQueryState("review.dashboard", {
      status: "pending",
      fetchStatus: "fetching",
    });
    setQueryState("weeklyReport.get", { data: ACTIVE_WEEKLY });
    render(<DashboardPage />);
    expect(screen.getByText("Lead summary")).toBeInTheDocument();
    expect(screen.getByText("Alerts")).toBeInTheDocument();
    const bulkActions = screen.getByText("Bulk actions");
    expect(bulkActions).toBeInTheDocument();
    fireEvent.click(bulkActions);
    expect(
      screen.getByRole("button", { name: "Revoke All (2)" }),
    ).toBeVisible();
    expect(screen.getByTestId("dashboard-kpi-loading")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-blocked-loading")).toBeInTheDocument();
  });

  it("keeps self-contained panels visible while weekly context is pending", () => {
    setQueryState("review.dashboard", { data: [] });
    setQueryState("weeklyReport.get", {
      status: "pending",
      fetchStatus: "fetching",
    });
    render(<DashboardPage />);
    expect(screen.getByText("Reopen requests")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-kpi-loading")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-leads-loading")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-blocked-loading")).toBeInTheDocument();
  });

  it("renders the weekly queue while optional activity freshness is pending", () => {
    setQueryState("activity.live", {
      status: "pending",
      fetchStatus: "fetching",
    });
    setQueryState("review.dashboard", { data: [] });
    setQueryState("weeklyReport.get", { data: ACTIVE_WEEKLY });

    render(<DashboardPage />);

    expect(screen.getByText("KPI")).toBeInTheDocument();
    expect(screen.getByText("Lead summary")).toBeInTheDocument();
    expect(screen.getByText("Alerts")).toBeInTheDocument();
    expect(screen.getByText("Reopen requests")).toBeInTheDocument();
    expect(screen.getByText("Blocked")).toBeInTheDocument();
    expect(
      screen.queryByTestId("dashboard-leads-loading"),
    ).not.toBeInTheDocument();
  });

  it("keeps the weekly queue visible and retries only failed activity freshness", () => {
    const activityRefetch = vi.fn().mockResolvedValue({});
    const reviewRefetch = vi.fn().mockResolvedValue({});
    const weeklyRefetch = vi.fn().mockResolvedValue({});
    setQueryState("activity.live", {
      error: new Error("activity failed"),
      isError: true,
      status: "error",
      refetch: activityRefetch,
    });
    setQueryState("review.dashboard", { data: [], refetch: reviewRefetch });
    setQueryState("weeklyReport.get", {
      data: ACTIVE_WEEKLY,
      refetch: weeklyRefetch,
    });

    render(<DashboardPage />);

    expect(screen.getByText("Lead summary")).toBeInTheDocument();
    const issue = screen.getByTestId("dashboard-activity-error");
    expect(issue).toHaveTextContent("activity failed");
    fireEvent.click(within(issue).getByRole("button", { name: "Retry" }));
    expect(activityRefetch).toHaveBeenCalledOnce();
    expect(reviewRefetch).not.toHaveBeenCalled();
    expect(weeklyRefetch).not.toHaveBeenCalled();
  });

  it("scopes a review failure and retry to review-backed panels", () => {
    const reviewRefetch = vi.fn().mockResolvedValue({});
    const weeklyRefetch = vi.fn().mockResolvedValue({});
    setQueryState("review.dashboard", {
      error: new Error("review failed"),
      isError: true,
      status: "error",
      refetch: reviewRefetch,
    });
    setQueryState("weeklyReport.get", {
      data: ACTIVE_WEEKLY,
      refetch: weeklyRefetch,
    });
    render(<DashboardPage />);
    expect(screen.getByText("Lead summary")).toBeInTheDocument();
    const issue = screen.getByTestId("dashboard-kpi-error");
    expect(issue).toHaveTextContent("review failed");
    fireEvent.click(within(issue).getByRole("button", { name: "Retry" }));
    expect(reviewRefetch).toHaveBeenCalledTimes(1);
    expect(weeklyRefetch).not.toHaveBeenCalled();
  });

  it("shows no-period as a terminal state without waiting for review", () => {
    setQueryState("review.dashboard", {
      status: "pending",
      fetchStatus: "fetching",
    });
    setQueryState("weeklyReport.get", {
      data: { status: "no-period", report: null },
    });
    render(<DashboardPage />);
    expect(screen.getByText("No active reporting period")).toBeInTheDocument();
    expect(
      screen.queryByTestId("dashboard-leads-loading"),
    ).not.toBeInTheDocument();
  });

  it("marks and refetches only the query that stalls", async () => {
    vi.useFakeTimers();
    const reviewRefetch = vi.fn().mockResolvedValue({});
    const weeklyRefetch = vi.fn().mockResolvedValue({});
    setQueryState("review.dashboard", {
      status: "pending",
      fetchStatus: "fetching",
      refetch: reviewRefetch,
    });
    setQueryState("weeklyReport.get", {
      data: ACTIVE_WEEKLY,
      refetch: weeklyRefetch,
    });
    render(<DashboardPage />);
    await act(() => vi.advanceTimersByTime(DASHBOARD_LOAD_STALL_MS));
    expect(logClientError).toHaveBeenCalledWith(
      "dashboard.query_stalled",
      expect.any(Error),
      expect.objectContaining({ query: "review" }),
    );
    expect(reviewRefetch).toHaveBeenCalledTimes(1);
    expect(weeklyRefetch).not.toHaveBeenCalled();
    expect(screen.getByTestId("dashboard-kpi-error")).toBeInTheDocument();
    expect(screen.getByText("Lead summary")).toBeInTheDocument();
  });

  it("refetches only unsettled data after a history restore", async () => {
    const reviewRefetch = vi.fn().mockResolvedValue({});
    const weeklyRefetch = vi.fn().mockResolvedValue({});
    setQueryState("review.dashboard", {
      status: "pending",
      fetchStatus: "fetching",
      refetch: reviewRefetch,
    });
    setQueryState("weeklyReport.get", {
      data: ACTIVE_WEEKLY,
      refetch: weeklyRefetch,
    });
    render(<DashboardPage />);
    const event = new Event("pageshow") as PageTransitionEvent;
    Object.defineProperty(event, "persisted", { value: true });
    await act(() => window.dispatchEvent(event));
    expect(logClientError).toHaveBeenCalledWith(
      "dashboard.pageshow_unsettled_query",
      expect.any(Error),
      expect.objectContaining({ query: "review" }),
    );
    expect(reviewRefetch).toHaveBeenCalledTimes(1);
    expect(weeklyRefetch).not.toHaveBeenCalled();
  });
});
