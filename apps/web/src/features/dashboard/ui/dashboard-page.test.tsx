import "@testing-library/jest-dom/vitest";

import { useQuery } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { logClientError } from "../../../lib/client-error-reporting";
import { DASHBOARD_LOAD_STALL_MS, DashboardPage } from "./dashboard-page";

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => ({ isPending: false, mutate: vi.fn() })),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock("../../../lib/client-error-reporting", () => ({
  formatClientErrorMessage: vi.fn((prefix: string, error: unknown) =>
    error instanceof Error ? `${prefix}: ${error.message}` : prefix,
  ),
  logClientError: vi.fn(),
}));

vi.mock("../../../lib/trpc-context", () => ({
  useTRPC: () => ({
    review: {
      dashboard: {
        queryOptions: () => ({ queryKey: ["review.dashboard"] }),
      },
      verdict: {
        mutationOptions: () => ({}),
      },
    },
    weeklyReport: {
      get: {
        queryOptions: () => ({ queryKey: ["weeklyReport.get"] }),
      },
    },
    leadForm: {
      revokeAllSubmitted: {
        mutationOptions: () => ({}),
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

vi.mock("./reopen-requests-card", () => ({
  ReopenRequestsCard: () => <div>Reopen requests</div>,
}));

vi.mock("./blocked-at-risk-table", () => ({
  BlockedAtRiskTable: () => <div>Blocked</div>,
}));

vi.mock("./lead-summary-table", () => ({
  LeadSummaryTable: () => <div>Lead summary</div>,
}));

vi.mock("../../../shared/ui/confirmation-dialog", () => ({
  ConfirmationDialog: () => null,
}));

// Mapper is unit-tested separately; stub it so the success-path render does not
// need a full WeeklyReportReadModel fixture (head-dashboard-declutter test 5.1).
vi.mock("../model/dashboard", () => ({
  mapDashboardData: () => ({
    kpi: {
      submitted: 0,
      total: 0,
      lastWeekSubmitted: 0,
      lastWeekTotal: 0,
      pendingCount: 0,
      deadlineLabel: "2d 0h",
      deadlineTime: "2026-05-15",
      blockedCount: 0,
      atRiskCount: 0,
      decisionCount: 0,
    },
    leads: [],
    blockedAtRisk: [],
    pendingLeads: [],
  }),
}));

interface QueryState {
  data?: unknown;
  error?: Error | null;
  isError?: boolean;
  isLoading?: boolean;
  status?: "pending" | "error" | "success";
  fetchStatus?: "fetching" | "paused" | "idle";
  refetch?: ReturnType<typeof vi.fn>;
}

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

  it("renders the live activity feed exactly once and no removed 24h card (head-dashboard-declutter)", () => {
    setQueryState("review.dashboard", { data: [] });
    setQueryState("weeklyReport.get", {
      data: {
        status: "ok",
        reportId: "report-1",
        weekLabel: "Week 20",
        periodStatus: "open",
        hasActiveReminderRule: true,
        leadSections: [],
      },
    });

    render(<DashboardPage />);

    // ActivityLivePanel owns the activity.live feed; it must render exactly once
    // (the duplicate Activity24hCard was removed).
    expect(screen.getAllByText("Activity")).toHaveLength(1);
    expect(screen.queryByTestId("activity-24h-card")).not.toBeInTheDocument();
    expect(screen.getByText("Lead summary")).toBeInTheDocument();
  });

  it("renders the alert bar and the Reopen Requests card as independent surfaces (lead-report-surface-polish HF6: single reopen surface)", () => {
    setQueryState("review.dashboard", { data: [] });
    setQueryState("weeklyReport.get", {
      data: {
        status: "ok",
        reportId: "report-1",
        weekLabel: "Week 20",
        periodStatus: "open",
        hasActiveReminderRule: true,
        leadSections: [],
      },
    });

    render(<DashboardPage />);

    // The alert bar covers lead-submission signals only; the Reopen
    // Requests card is the sole surface for pending reopen requests. Each
    // self-suppresses independently — this asserts the page still composes
    // both as siblings, with neither standing in for the other.
    expect(screen.getByText("Alerts")).toBeInTheDocument();
    expect(screen.getByText("Reopen requests")).toBeInTheDocument();
  });

  it("mounts the section-reviews roll-up strip in the dashboard review area (report-review-mode HF3)", () => {
    setQueryState("review.dashboard", { data: [] });
    setQueryState("weeklyReport.get", {
      data: {
        status: "ok",
        reportId: "report-1",
        weekLabel: "Week 20",
        periodStatus: "open",
        hasActiveReminderRule: true,
        leadSections: [
          {
            reportSectionId: "sec-1",
            version: 1,
            authorName: "Alice",
            status: "submitted",
            reviews: [],
            canReview: true,
            groupId: "group-1",
          },
        ],
      },
    });

    render(<DashboardPage />);

    // This strip lives on the dashboard, not the report body; it exposes the
    // per-section verdict control for the head's at-a-glance roll-up.
    expect(
      screen.getByRole("region", { name: "Section reviews" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
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
