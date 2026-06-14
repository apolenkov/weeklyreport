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

import { useQuery } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/* ---- Module mocks (hoisted above all imports of the SUT) ---- */

vi.mock("../slides/head-slides-client", () => ({
  HeadSlidesClient: () => <div data-testid="head-slides-client-stub" />,
}));

// lead-live-walk-2026-06-14 task 5.3: the shell now mounts the period-mutation
// cluster (Export-PDF + Archive + Publish) inside the action pill. The real
// component self-queries weeklyReport.get and runs mapWeeklyReport, which would
// throw on the thin useQuery mocks below — stub it (like HeadSlidesClient) and
// expose a sentinel so tests can pin WHERE the cluster mounts. A separate,
// fully-wired test asserts its real contents live inside the single pill.
vi.mock("../weekly-report/report-mutation-actions", () => ({
  ReportMutationActions: () => (
    <div data-testid="report-mutation-actions-stub" />
  ),
}));

vi.mock("../weekly-report/weekly-report-page", () => ({
  // head-toolbar-parity: render the `toolbar` slot so tests can pin that the
  // shell hands its single ReportToolbar to the page (design D2). The real
  // page places the slot below its page header row; that position is pinned
  // in weekly-report-page.test.tsx.
  WeeklyReportPage: ({ toolbar }: { toolbar?: React.ReactNode }) => (
    <div data-testid="weekly-report-page-stub">{toolbar}</div>
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

// The PeriodNavigator (rendered in the toolbar) reads these. Pathname is
// overridden per-test below to point at the addressed head report week.
const mockPathname = vi.fn(() => "/head/report");
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => mockPathname(),
}));

// driver-findings-2026-06-11 finding 4: the shell now runs two queries —
// reports.compiledHistory (period list) and weeklyReport.get (the displayed
// period, prepended when absent from history). Branch the mock on queryKey so
// each query returns its own shape instead of one blanket value.
vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );
  return {
    ...actual,
    useQuery: vi.fn((opts: { queryKey?: unknown[] }) => {
      const key = opts.queryKey?.[0];
      if (key === "weeklyReport.get") {
        return {
          data: { status: "no-period" },
          isLoading: false,
          isError: false,
          error: null,
        };
      }
      return {
        data: { entries: [] },
        isLoading: false,
        isError: false,
        error: null,
      };
    }),
  };
});

vi.mock("../../lib/trpc-context", () => ({
  useTRPC: () => ({
    reports: {
      compiledHistory: {
        queryOptions: () => ({ queryKey: ["reports.compiledHistory"] }),
      },
    },
    weeklyReport: {
      get: {
        queryOptions: () => ({ queryKey: ["weeklyReport.get"] }),
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
// (the shared ReportToolbar). The shell composes it and passes it into
// WeeklyReportPage's `toolbar` slot (design D2), which renders it below the
// real page header row — the companion pin in weekly-report-page.test.tsx
// verifies the slot replaces the inner context bar AND follows the header.
describe("HeadReportShell — single shared toolbar (head-toolbar-parity)", () => {
  it("form mode renders exactly one ReportToolbar, passed through the page's toolbar slot", () => {
    render(<HeadReportShell reportId={TEST_REPORT_ID} mode="form" />);
    expect(screen.getAllByTestId("report-toolbar")).toHaveLength(1);
    // The toolbar mounts INSIDE WeeklyReportPage (not shell-level above it),
    // so the page can place it below its h1 page header row.
    const pageStub = screen.getByTestId("weekly-report-page-stub");
    expect(within(pageStub).getByTestId("report-toolbar")).toBeInTheDocument();
  });

  it("the toolbar sits below the shell's utility action row (lead arrangement)", () => {
    render(<HeadReportShell reportId={TEST_REPORT_ID} mode="form" />);
    const headerAction = screen.getByRole("link", { name: /present/i });
    const toolbar = screen.getByTestId("report-toolbar");
    const position = headerAction.compareDocumentPosition(toolbar);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

// unify-top-action-toolbars D1/D3: the head action controls now sit in the
// shared ReportActionsPill (one frame, two intent groups) instead of floating
// in a bare flex row. Pin that the controls are present, grouped left vs right,
// and that the Present/Print hrefs + aria are preserved.
describe("HeadReportShell — unified action pill (unify-top-action-toolbars)", () => {
  it("renders the action controls inside one ReportActionsPill", () => {
    render(<HeadReportShell reportId={TEST_REPORT_ID} mode="form" />);
    const pills = screen.getAllByTestId("report-actions-pill");
    expect(pills).toHaveLength(1);
    const pill = pills[0];
    // Left group: scope toggle (radiogroup) + view-mode toggle (Edit/Slides).
    // The next/link mock drops aria-label, so match the segment text instead.
    expect(within(pill).getByRole("radiogroup")).toBeInTheDocument();
    expect(
      within(pill).getByRole("link", { name: /slides/i }),
    ).toBeInTheDocument();
    // Right group: Present + Print + the agent-review placeholder.
    expect(
      within(pill).getByRole("link", { name: /present/i }),
    ).toBeInTheDocument();
    expect(
      within(pill).getByRole("link", { name: /print/i }),
    ).toBeInTheDocument();
    expect(
      within(pill).getByTestId("agent-review-coming-soon"),
    ).toBeInTheDocument();
  });

  it("preserves the Present and Print hrefs", () => {
    render(<HeadReportShell reportId={TEST_REPORT_ID} mode="form" />);
    expect(screen.getByRole("link", { name: /present/i })).toHaveAttribute(
      "href",
      `/head/report/${TEST_REPORT_ID}/present`,
    );
    expect(screen.getByRole("link", { name: /print/i })).toHaveAttribute(
      "href",
      `/print/${TEST_REPORT_ID}`,
    );
  });

  it("slides mode keeps the action pill but drops the form-only placeholder", () => {
    render(<HeadReportShell reportId={TEST_REPORT_ID} mode="slides" />);
    const pill = screen.getByTestId("report-actions-pill");
    expect(
      within(pill).getByRole("link", { name: /present/i }),
    ).toBeInTheDocument();
    expect(
      within(pill).queryByTestId("agent-review-coming-soon"),
    ).not.toBeInTheDocument();
  });

  // lead-live-walk-2026-06-14 task 5.3: the period-mutation cluster (Export-PDF
  // + Archive + Publish) now lives INSIDE the single action pill, not in the
  // WeeklyReportPage header. Pin it for BOTH modes — the pill is shared across
  // the mode branch, so slides gains the same consolidated bar.
  it.each(["form", "slides"] as const)(
    "mounts the period-mutation cluster inside the single pill (%s mode)",
    (mode) => {
      render(<HeadReportShell reportId={TEST_REPORT_ID} mode={mode} />);
      const pill = screen.getByTestId("report-actions-pill");
      expect(
        within(pill).getByTestId("report-mutation-actions-stub"),
      ).toBeInTheDocument();
    },
  );

  it("suppresses the WeeklyReportPage header cluster (one consolidated bar)", () => {
    render(<HeadReportShell reportId={TEST_REPORT_ID} mode="form" />);
    // The mutation cluster appears exactly once — in the pill, not duplicated in
    // the page header. The WeeklyReportPage stub renders no cluster of its own.
    expect(screen.getAllByTestId("report-mutation-actions-stub")).toHaveLength(
      1,
    );
  });
});

// driver-findings-2026-06-11 finding 4: on /head/report/<activeId> the period
// navigator showed the latest PUBLISHED week (periods[0]) while the body showed
// the active week. Two root causes — the active week missing from `periods`
// (built from compiledHistory) AND currentIndex resolving via a regex that
// never matched the head path. Both must be fixed.
describe("HeadReportShell — period navigator addressed-week (finding 4)", () => {
  const ACTIVE_ID = "a0000000-0000-4000-8000-000000000001";
  // Two published weeks in history (newest first): NEWER is periods[0], OLDER
  // is periods[1]. Navigating to OLDER proves the regex fix — without it
  // currentIndex defaults to 0 and the trigger would wrongly show NEWER.
  const NEWER_ID = "a0000000-0000-4000-8000-000000000006";
  const NEWER_START = "2026-05-25T00:00:00.000Z";
  const NEWER_END = "2026-05-31T00:00:00.000Z";
  const OLDER_ID = "a0000000-0000-4000-8000-000000000005";
  const OLDER_START = "2026-05-18T00:00:00.000Z";
  const OLDER_END = "2026-05-24T00:00:00.000Z";
  const ACTIVE_START = "2026-06-08T00:00:00.000Z";
  const ACTIVE_END = "2026-06-14T00:00:00.000Z";

  // Wire useQuery so compiledHistory carries two published weeks and
  // weeklyReport.get returns the active (open) period for the displayed id.
  function wireQueries() {
    const impl = (opts: { queryKey?: unknown[] }) => {
      const key = opts.queryKey?.[0];
      if (key === "weeklyReport.get") {
        return {
          data: {
            status: "active",
            reportId: ACTIVE_ID,
            periodStart: ACTIVE_START,
            periodEnd: ACTIVE_END,
            periodStatus: "open",
          },
          isLoading: false,
          isError: false,
          error: null,
        };
      }
      return {
        data: {
          entries: [
            {
              reportId: NEWER_ID,
              periodStart: NEWER_START,
              periodEnd: NEWER_END,
              archived: false,
            },
            {
              reportId: OLDER_ID,
              periodStart: OLDER_START,
              periodEnd: OLDER_END,
              archived: false,
            },
          ],
        },
        isLoading: false,
        isError: false,
        error: null,
      };
    };
    vi.mocked(useQuery).mockImplementation(impl as unknown as typeof useQuery);
  }

  it("trigger shows the active week (not the latest published) on /head/report/<activeId>", () => {
    wireQueries();
    mockPathname.mockReturnValue(`/head/report/${ACTIVE_ID}`);

    render(<HeadReportShell reportId={ACTIVE_ID} mode="form" />);

    const trigger = screen.getByRole("combobox", {
      name: /select reporting period/i,
    });
    // Active week is Jun 8-14 (ISO week 24); the published week is May 25-31.
    expect(trigger).toHaveTextContent(/jun 8.*14/i);
    expect(trigger).not.toHaveTextContent(/may 25/i);
  });

  it("trigger follows to an OLDER published week (regex fix proof)", () => {
    // OLDER is periods[1]; reaching it requires resolving currentIndex from the
    // head pathname. Without the regex fix, currentIndex defaults to 0 and the
    // trigger would wrongly show the NEWER (May 25-31) week instead.
    wireQueries();
    mockPathname.mockReturnValue(`/head/report/${OLDER_ID}`);

    render(<HeadReportShell reportId={OLDER_ID} mode="form" />);

    const trigger = screen.getByRole("combobox", {
      name: /select reporting period/i,
    });
    expect(trigger).toHaveTextContent(/may 18.*24/i);
    expect(trigger).not.toHaveTextContent(/may 25/i);
  });
});
