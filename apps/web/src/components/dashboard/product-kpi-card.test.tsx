import "@testing-library/jest-dom/vitest";

import { useQuery } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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
  observe() {}
  unobserve() {}
  disconnect() {}
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentional any for test/runtime escape hatch (migrated from eslint-disable)
(globalThis as any).ResizeObserver = ResizeObserverStub;

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentional any for test/runtime escape hatch (migrated from eslint-disable)
    } as any);

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentional any for test/runtime escape hatch (migrated from eslint-disable)
    } as any);

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentional any for test/runtime escape hatch (migrated from eslint-disable)
    } as any);

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentional any for test/runtime escape hatch (migrated from eslint-disable)
    } as any);

    render(<ProductKpiCard role="admin" />);

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders a loading state while the query is in flight", () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentional any for test/runtime escape hatch (migrated from eslint-disable)
    } as any);

    render(<ProductKpiCard role="head" />);

    expect(screen.getByText(/Loading telemetry/i)).toBeInTheDocument();
  });

  it("renders an error message when the query errors", () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentional any for test/runtime escape hatch (migrated from eslint-disable)
    } as any);

    render(<ProductKpiCard role="head" />);

    expect(screen.getByText("Failed to load telemetry.")).toBeInTheDocument();
  });
});
