// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import type { QueryObserverResult } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type { PeriodComparisonInput } from "@weeklyreport/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { expectDefined } from "../../../../test-utils/expect-defined";
import { makeQueryState } from "../../../../test-utils/query-state";

const trpcInputs = vi.hoisted(() => ({
  trafficLightHistory: vi.fn<(input: unknown) => void>(),
  leadVelocity: vi.fn<(input: unknown) => void>(),
  periodComparison: vi.fn<(input: PeriodComparisonInput) => void>(),
}));

vi.mock("../../../../shared/lib/trpc/trpc-context", () => ({
  useTRPC: () => ({
    analytics: {
      trafficLightHistory: {
        queryOptions: (input: unknown) => {
          trpcInputs.trafficLightHistory(input);
          return { queryKey: ["analytics.trafficLightHistory", input] };
        },
      },
      leadVelocity: {
        queryOptions: (input: unknown) => {
          trpcInputs.leadVelocity(input);
          return { queryKey: ["analytics.leadVelocity", input] };
        },
      },
      periodComparison: {
        queryOptions: (input: PeriodComparisonInput) => {
          trpcInputs.periodComparison(input);
          return { queryKey: ["analytics.periodComparison", input] };
        },
      },
    },
  }),
}));

vi.mock("@tanstack/react-query", () => ({ useQuery: vi.fn() }));

vi.mock("../../../../shared/hooks/query/use-query-error-handler", () => ({
  useQueryErrorHandler: vi.fn(),
}));

vi.mock(
  "../../../../features/analytics/ui/traffic-light-history.table",
  () => ({
    TrafficLightHistoryTable: () => (
      <div data-testid="traffic-light-history-table" />
    ),
  }),
);
vi.mock("../../../../features/analytics/ui/lead-submissions.table", () => ({
  LeadSubmissionsTable: () => <div data-testid="lead-submissions-table" />,
}));
vi.mock("../../../../features/analytics/ui/period-comparison.table", () => ({
  PeriodComparisonTable: () => <div data-testid="period-comparison-table" />,
}));

import TrendsPage from "./page";

const PERIOD_OLD = { periodStart: "2026-08-31", periodEnd: "2026-09-06" };
const PERIOD_NEW = { periodStart: "2026-09-07", periodEnd: "2026-09-13" };

const HISTORY = {
  periods: [PERIOD_OLD, PERIOD_NEW],
  rows: [
    {
      projectId: "11111111-1111-4111-8111-111111111111",
      projectName: "Alpha",
      statuses: ["green", "yellow"],
    },
  ],
} as const;

const VELOCITY = [
  {
    ...PERIOD_NEW,
    leads: [
      {
        leadId: "22222222-2222-4222-8222-222222222222",
        leadName: "Ivanova",
        submittedSections: 1,
      },
    ],
  },
] as const;

const COMPARISON = {
  periodA: PERIOD_OLD,
  periodB: PERIOD_NEW,
  rows: [
    {
      projectId: "11111111-1111-4111-8111-111111111111",
      projectName: "Alpha",
      statusA: "green",
      statusB: "yellow",
      riskCountA: 0,
      riskCountB: 1,
      riskDelta: 1,
    },
  ],
} as const;

type QueryKey = readonly [string, unknown];

let historyState: QueryObserverResult;
let velocityState: QueryObserverResult;
let comparisonState: QueryObserverResult;

function mockQueries() {
  vi.mocked(useQuery).mockImplementation((options: unknown) => {
    const [name] = (options as { queryKey: QueryKey }).queryKey;
    if (name === "analytics.trafficLightHistory") return historyState;
    if (name === "analytics.leadVelocity") return velocityState;
    if (name === "analytics.periodComparison") return comparisonState;
    throw new Error(`Unexpected query ${name}`);
  });
}

function comparisonQueryOptions() {
  const call = vi
    .mocked(useQuery)
    .mock.calls.map(([options]) => options)
    .find(
      (options) =>
        (options as { queryKey: QueryKey }).queryKey[0] ===
        "analytics.periodComparison",
    );
  return call as { queryKey: QueryKey; enabled?: boolean } | undefined;
}

describe("TrendsPage — three-section analytics shell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    historyState = makeQueryState({ data: HISTORY });
    velocityState = makeQueryState({ data: VELOCITY });
    comparisonState = makeQueryState({ data: COMPARISON });
    mockQueries();
  });

  it("renders all three tables and compares the latest two periods", () => {
    render(<TrendsPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Trends" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(
      screen.getByTestId("traffic-light-history-table"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("lead-submissions-table")).toBeInTheDocument();
    expect(screen.getByTestId("period-comparison-table")).toBeInTheDocument();
    expect(trpcInputs.periodComparison).toHaveBeenCalledWith({
      periodA: PERIOD_OLD.periodEnd,
      periodB: PERIOD_NEW.periodEnd,
    });
    expect(comparisonQueryOptions()).toMatchObject({ enabled: true });
  });

  it("shows a skeleton per section while the queries load", () => {
    historyState = makeQueryState({ data: undefined, isLoading: true });
    velocityState = makeQueryState({ data: undefined, isLoading: true });
    comparisonState = makeQueryState({ data: undefined, isLoading: true });

    render(<TrendsPage />);

    expect(
      screen.getAllByRole("status", { name: "Loading data" }),
    ).toHaveLength(3);
  });

  it("disables the comparison query and explains it under two periods", () => {
    historyState = makeQueryState({
      data: { periods: [PERIOD_NEW], rows: [] },
    });

    render(<TrendsPage />);

    expect(
      screen.getByText(
        "At least two published periods are required for comparison.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("period-comparison-table"),
    ).not.toBeInTheDocument();
    expect(comparisonQueryOptions()).toMatchObject({ enabled: false });
    const fallback = trpcInputs.periodComparison.mock.lastCall?.[0];
    expect(fallback?.periodA).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
    expect(fallback?.periodB).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
  });

  it("keeps other sections usable when one query fails", () => {
    velocityState = makeQueryState({
      data: undefined,
      error: new Error("velocity down"),
    });

    render(<TrendsPage />);

    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(
      screen.getByTestId("traffic-light-history-table"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("period-comparison-table")).toBeInTheDocument();
  });

  it("retries both failed comparison dependencies with cached history", () => {
    const historyRefetch = vi.fn().mockResolvedValue(undefined);
    const comparisonRefetch = vi.fn().mockResolvedValue(undefined);
    historyState = makeQueryState({
      data: HISTORY,
      error: new Error("history down"),
      refetch: historyRefetch,
    });
    comparisonState = makeQueryState({
      data: COMPARISON,
      error: new Error("comparison down"),
      refetch: comparisonRefetch,
    });
    render(<TrendsPage />);
    fireEvent.click(
      expectDefined(screen.getAllByRole("button", { name: "Retry" })[1]),
    );
    expect(historyRefetch).toHaveBeenCalledOnce();
    expect(comparisonRefetch).toHaveBeenCalledOnce();
  });

  it("retries the history query when the history error breaks the comparison", () => {
    const historyRefetch = vi.fn().mockResolvedValue(undefined);
    historyState = makeQueryState({
      data: undefined,
      error: new Error("history down"),
      refetch: historyRefetch,
    });

    render(<TrendsPage />);

    // History and comparison sections both surface the same failing query.
    const retries = screen.getAllByRole("button", { name: "Retry" });
    expect(retries).toHaveLength(2);
    fireEvent.click(expectDefined(retries[1]));
    expect(historyRefetch).toHaveBeenCalledTimes(1);
  });
});
