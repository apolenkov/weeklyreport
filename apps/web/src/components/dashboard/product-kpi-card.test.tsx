import "@testing-library/jest-dom/vitest";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProductKpiCard } from "./product-kpi-card";

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
}));

vi.mock("../../lib/trpc-context", () => ({
  useTRPC: () => ({
    telemetry: {
      summary: {
        queryOptions: () => ({ queryKey: ["telemetry.summary"] }),
      },
    },
  }),
}));

// Recharts renders an SVG sized off `ResponsiveContainer` which needs a
// JSDOM resize observer. Stub it so the chart mounts without erroring;
// the tests below only assert the *presence* of the numbers, not the
// pixel output of the line.
class ResizeObserverStub {
  observe() {
    /* no-op stub: JSDOM has no layout engine */
  }
  unobserve() {
    /* no-op stub: JSDOM has no layout engine */
  }
  disconnect() {
    /* no-op stub: JSDOM has no layout engine */
  }
}
(globalThis as unknown as Record<string, unknown>).ResizeObserver =
  ResizeObserverStub;

const mockUseQuery = vi.mocked(useQuery);

const summary = {
  reportsThisPeriod: 6,
  onTimeRatio: 0.83,
  activeLeads: 4,
  lateSections: 2,
  pendingReopens: 1,
  pdfExportsLast7d: 9,
  sparkline: [0.8, 0.82, 0.85, 0.83],
};

describe("ProductKpiCard — Phase 52-C (UFB-054)", () => {
  it("renders the six KPIs for head role", () => {
    mockUseQuery.mockReturnValue({
      data: summary,
      isLoading: false,
      isError: false,
    } as unknown as UseQueryResult<unknown, unknown>);

    render(<ProductKpiCard role="head" />);

    // headline numbers
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByText("83%")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
    // accessible label
    expect(
      screen.getByRole("region", { name: "Product KPIs" }),
    ).toBeInTheDocument();
  });

  it("renders nothing for lead role (data subject, not consumer)", () => {
    // useQuery should NEVER fire for lead — the card returns null before
    // hitting the hook. We still mock it so the import resolves.
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    } as unknown as UseQueryResult<unknown, unknown>);

    const { container } = render(<ProductKpiCard role="lead" />);

    expect(container.firstChild).toBeNull();
    expect(
      screen.queryByRole("region", { name: "Product KPIs" }),
    ).not.toBeInTheDocument();
  });

  it("renders for viewer role (leadership audience includes viewer)", () => {
    mockUseQuery.mockReturnValue({
      data: summary,
      isLoading: false,
      isError: false,
    } as unknown as UseQueryResult<unknown, unknown>);

    render(<ProductKpiCard role="viewer" />);

    expect(
      screen.getByRole("region", { name: "Product KPIs" }),
    ).toBeInTheDocument();
  });

  it("renders an em-dash for the on-time ratio when cold-start (null)", () => {
    mockUseQuery.mockReturnValue({
      data: { ...summary, onTimeRatio: null, sparkline: [] },
      isLoading: false,
      isError: false,
    } as unknown as UseQueryResult<unknown, unknown>);

    render(<ProductKpiCard role="admin" />);

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders a loading state while the query is in flight", () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as unknown as UseQueryResult<unknown, unknown>);

    render(<ProductKpiCard role="head" />);

    expect(screen.getByText(/Loading telemetry/i)).toBeInTheDocument();
  });

  it("renders an error message when the query errors", () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as unknown as UseQueryResult<unknown, unknown>);

    render(<ProductKpiCard role="head" />);

    expect(screen.getByText("Failed to load telemetry.")).toBeInTheDocument();
  });
});

describe("ProductKpiCard — a11y regression (verify-a11y-recommended-flip)", () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue({
      data: summary,
      isLoading: false,
      isError: false,
    } as unknown as UseQueryResult<unknown, unknown>);
  });

  it("sparkline container has role='img'", () => {
    render(<ProductKpiCard role="head" />);

    expect(
      screen.getByRole("img", {
        name: "On-time ratio sparkline over the last 4 periods",
      }),
    ).toBeInTheDocument();
  });

  it("sparkline container has aria-label 'On-time ratio sparkline over the last 4 periods'", () => {
    render(<ProductKpiCard role="head" />);

    const sparkline = screen.getByRole("img", {
      name: "On-time ratio sparkline over the last 4 periods",
    });

    expect(sparkline).toHaveAttribute(
      "aria-label",
      "On-time ratio sparkline over the last 4 periods",
    );
  });

  it("aria-hidden wrapper (direct child of sparkline container) has aria-hidden='true'", () => {
    render(<ProductKpiCard role="head" />);

    const sparkline = screen.getByRole("img", {
      name: "On-time ratio sparkline over the last 4 periods",
    });

    expect(sparkline.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("Stat wrapper div does NOT have an aria-label attribute", () => {
    render(<ProductKpiCard role="head" />);

    // The label <p> is a direct child of the Stat wrapper div —
    // parentElement is the wrapper to assert against.
    const labelEl = screen.getByText("Reports this period");

    expect(labelEl.parentElement).not.toHaveAttribute("aria-label");
  });

  it("Stat label texts are readable in the document", () => {
    render(<ProductKpiCard role="head" />);

    const labels = [
      "Reports this period",
      "On-time ratio",
      "Active leads",
      "Late sections",
      "Pending reopens",
      "PDF exports (7d)",
    ];

    for (const label of labels) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});
