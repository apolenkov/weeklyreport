/**
 * @vitest-environment jsdom
 *
 * mount-agent-review-placeholder review fix: the head report shell toolbar
 * mounts AgentReviewComingSoon in form mode only. In slides mode the single
 * placeholder lives inside the head slide article (status-slide-deck.tsx),
 * so a toolbar mount there would put two placeholders on one surface —
 * exactly the duplication design.md Decision 1 rejects.
 */

import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/* ---- Module mocks (hoisted above all imports of the SUT) ---- */

vi.mock("../slides/head-slides-client", () => ({
  HeadSlidesClient: () => <div data-testid="head-slides-client-stub" />,
}));

vi.mock("../weekly-report/weekly-report-page", () => ({
  // head-toolbar-parity: surface the contextToolbar prop so tests can pin
  // that the shell suppresses the inner period-context bar (design D2).
  WeeklyReportPage: ({ contextToolbar }: { contextToolbar?: boolean }) => (
    <div
      data-testid="weekly-report-page-stub"
      data-context-toolbar={String(contextToolbar)}
    />
  ),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );
  return {
    ...actual,
    useQuery: vi.fn(() => ({
      data: { entries: [] },
      isLoading: false,
      isError: false,
      error: null,
    })),
  };
});

vi.mock("../../lib/trpc-context", () => ({
  useTRPC: () => ({
    reports: {
      compiledHistory: {
        queryOptions: () => ({ queryKey: ["reports.compiledHistory"] }),
      },
    },
  }),
}));

/* ---- Import under test (after all vi.mock registrations) ---- */

import { HeadReportShell } from "./head-report-shell";

const TEST_REPORT_ID = "test-report-001";

describe("HeadReportShell — agent-review placeholder per mode", () => {
  it("form mode renders exactly one placeholder in the toolbar", () => {
    render(<HeadReportShell reportId={TEST_REPORT_ID} mode="form" />);
    expect(screen.getAllByTestId("agent-review-coming-soon")).toHaveLength(1);
  });

  it("slides mode renders no toolbar placeholder (the slide article owns it)", () => {
    render(<HeadReportShell reportId={TEST_REPORT_ID} mode="slides" />);
    expect(screen.queryAllByTestId("agent-review-coming-soon")).toHaveLength(0);
    expect(screen.getByTestId("head-slides-client-stub")).toBeInTheDocument();
  });
});

// head-toolbar-parity pin: the review page owns exactly ONE period toolbar
// (the shared ReportToolbar), placed below the header-like action row, and
// suppresses the WeeklyReportPage context bar (design D2). The companion pin
// in weekly-report-page.test.tsx verifies contextToolbar={false} actually
// removes the inner bar.
describe("HeadReportShell — single shared toolbar (head-toolbar-parity)", () => {
  it("form mode renders exactly one ReportToolbar and suppresses the inner context bar", () => {
    render(<HeadReportShell reportId={TEST_REPORT_ID} mode="form" />);
    expect(screen.getAllByTestId("report-toolbar")).toHaveLength(1);
    expect(screen.getByTestId("weekly-report-page-stub")).toHaveAttribute(
      "data-context-toolbar",
      "false",
    );
  });

  it("the toolbar sits below the header-like action row (lead arrangement)", () => {
    render(<HeadReportShell reportId={TEST_REPORT_ID} mode="form" />);
    const headerAction = screen.getByRole("link", { name: /present/i });
    const toolbar = screen.getByTestId("report-toolbar");
    const position = headerAction.compareDocumentPosition(toolbar);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
