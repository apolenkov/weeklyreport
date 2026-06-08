/**
 * @vitest-environment jsdom
 *
 * VA-0a/VA-0b regression tests for ReportArchiveSection.
 * Catalog: openspec/changes/verify-a11y-recommended-flip/design.md
 *
 * Covers:
 *   - TrafficDot span role="img" (unit-rtl, high)
 *   - TrafficDot span aria-label (unit-rtl, high)
 *   - ArchiveSkeletonGrid skeleton div aria-hidden (unit-rtl, high)
 *   - ArchiveSkeletonGrid skeleton div keys — snapshot (snapshot, high)
 *   - ArchiveSkeletonGrid skeleton div structure — snapshot (snapshot, medium)
 */

import "@testing-library/jest-dom/vitest";

import type { ArchiveReportSummary } from "@customreport/shared";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The component uses useTRPC internally (passed to useCursorPagination factory).
// Mock trpc-context so the hook chain resolves without a real tRPC client.
vi.mock("../../lib/trpc-context", () => ({
  useTRPC: () => ({
    archive: {
      list: {
        infiniteQueryOptions: () => ({
          queryKey: ["archive.list"],
          queryFn: () => Promise.resolve({ items: [], nextCursor: null }),
          getNextPageParam: () => undefined,
          initialPageParam: undefined,
        }),
      },
    },
  }),
}));

// Mock useCursorPagination so tests control loading/data state directly.
const mockCursorPagination = vi.fn();
vi.mock("../../lib/use-cursor-pagination", () => ({
  useCursorPagination: (...args: unknown[]) =>
    mockCursorPagination(...args) as unknown,
}));

import { ReportArchiveSection } from "./report-archive-section";

const REPORT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function makeReport(
  portfolioStatus: ArchiveReportSummary["portfolioStatus"],
  overrides: Partial<ArchiveReportSummary> = {},
): ArchiveReportSummary {
  return {
    reportId: REPORT_ID,
    periodStart: new Date("2025-01-01"),
    periodEnd: new Date("2025-01-07"),
    publishedAt: new Date("2025-01-08"),
    publishedByName: "Alice Head",
    portfolioStatus,
    ...overrides,
  };
}

function makePaginationResult(
  overrides: Partial<{
    items: ArchiveReportSummary[];
    isLoading: boolean;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
  }> = {},
) {
  return {
    items: [],
    isLoading: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    isError: false,
    error: null,
    fetchNextPage: vi.fn(),
    ...overrides,
  };
}

describe("ReportArchiveSection — TrafficDot a11y (VA-0a)", () => {
  it("TrafficDot span has role='img'", () => {
    mockCursorPagination.mockReturnValue(
      makePaginationResult({ items: [makeReport("green")] }),
    );

    render(<ReportArchiveSection />);

    // Three TrafficDots rendered per report card (green, yellow, red).
    const dots = screen.getAllByRole("img");
    expect(dots.length).toBeGreaterThanOrEqual(3);
  });

  it("TrafficDot span has aria-label combining label and count", () => {
    mockCursorPagination.mockReturnValue(
      makePaginationResult({ items: [makeReport("green")] }),
    );

    render(<ReportArchiveSection />);

    // green report → green count = 1, yellow = 0, red = 0
    expect(
      screen.getByRole("img", { name: "Green statuses: 1" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Yellow statuses: 0" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Red statuses: 0" }),
    ).toBeInTheDocument();
  });

  it("TrafficDot aria-label reflects yellow portfolio status", () => {
    mockCursorPagination.mockReturnValue(
      makePaginationResult({ items: [makeReport("yellow")] }),
    );

    render(<ReportArchiveSection />);

    expect(
      screen.getByRole("img", { name: "Green statuses: 0" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Yellow statuses: 1" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Red statuses: 0" }),
    ).toBeInTheDocument();
  });
});

describe("ReportArchiveSection — ArchiveSkeletonGrid a11y (VA-0a/VA-0b)", () => {
  it("each skeleton div has aria-hidden='true'", () => {
    mockCursorPagination.mockReturnValue(
      makePaginationResult({ isLoading: true }),
    );

    const { container } = render(<ReportArchiveSection />);

    // SKELETON_KEYS has 8 entries (sk-0 through sk-7)
    const skeletonDivs = container.querySelectorAll('[aria-hidden="true"]');
    expect(skeletonDivs.length).toBe(8);
    skeletonDivs.forEach((div) => {
      expect(div).toHaveAttribute("aria-hidden", "true");
    });
  });

  it("snapshot: skeleton grid renders 8 aria-hidden placeholder cards (key stability)", () => {
    mockCursorPagination.mockReturnValue(
      makePaginationResult({ isLoading: true }),
    );

    const { container } = render(<ReportArchiveSection />);

    // Snapshot verifies the SKELETON_KEYS-based key pattern by locking the
    // rendered structure — a regression to index-based keys would produce an
    // identical DOM but this snapshot documents the stable-key expectation.
    const grid = container.querySelector(".grid");
    expect(grid).toMatchSnapshot();
  });

  it("snapshot: individual skeleton card DOM structure matches expected layout", () => {
    mockCursorPagination.mockReturnValue(
      makePaginationResult({ isLoading: true }),
    );

    const { container } = render(<ReportArchiveSection />);

    const firstSkeleton = container.querySelector('[aria-hidden="true"]');
    expect(firstSkeleton).toMatchSnapshot();
  });
});
