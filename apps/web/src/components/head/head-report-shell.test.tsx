/**
 * @vitest-environment jsdom
 *
 * mount-agent-review-placeholder review fix: the head report shell mounts the
 * AgentReviewComingSoon control in the same unframed header action cluster as
 * the other report controls.
 */

import "@testing-library/jest-dom/vitest";

import { useQuery } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

/* ---- Module mocks (hoisted above all imports of the SUT) ---- */

vi.mock("../slides/head-slides-client", () => ({
  HeadSlidesClient: () => <div data-testid="head-slides-client-stub" />,
}));

vi.mock("../weekly-report/weekly-report-page", () => ({
  // head-toolbar-parity: render the `headerActions` and `toolbar` slots so
  // tests can pin that the shell hands both to the page. The real page places
  // actions in the header row and the toolbar below it.
  WeeklyReportPage: ({
    headerActions,
    toolbar,
  }: {
    headerActions?: React.ReactNode;
    toolbar?: React.ReactNode;
  }) => (
    <div data-testid="weekly-report-page-stub">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1>Status Report</h1>
        <div data-testid="weekly-report-header-actions">{headerActions}</div>
      </header>
      {toolbar}
    </div>
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
        // Encode the reportId in the key so tests can tell the DISPLAYED query
        // (`{ reportId }`) apart from the ACTIVE query (`{}` → null) — item 3.
        queryOptions: (input?: { reportId?: string }) => ({
          queryKey: ["weeklyReport.get", input?.reportId ?? null],
        }),
      },
    },
  }),
}));

/* ---- Import under test (after all vi.mock registrations) ---- */

import { HeadReportShell } from "./head-report-shell";

const TEST_REPORT_ID = "test-report-001";

describe("HeadReportShell — agent-review placeholder per mode", () => {
  it("form mode renders exactly one placeholder in the header actions", () => {
    render(<HeadReportShell reportId={TEST_REPORT_ID} mode="form" />);
    expect(screen.getAllByTestId("agent-review-coming-soon")).toHaveLength(1);
    expect(
      within(screen.getByTestId("weekly-report-header-actions")).getByTestId(
        "agent-review-coming-soon",
      ),
    ).toBeInTheDocument();
  });

  it("slides mode keeps the placeholder out of the shell header (the deck owns it)", () => {
    // deferred-feature-pattern: exactly one AgentReviewComingSoon per surface.
    // On head slides the head slide deck (status-slide-deck) already mounts the
    // single placeholder, so the shell header must NOT render a second one. The
    // deck is stubbed here, so the shell itself renders zero.
    render(<HeadReportShell reportId={TEST_REPORT_ID} mode="slides" />);
    expect(
      screen.queryByTestId("agent-review-coming-soon"),
    ).not.toBeInTheDocument();
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

  it("the toolbar sits below the page header action row (lead arrangement)", () => {
    render(<HeadReportShell reportId={TEST_REPORT_ID} mode="form" />);
    const headerAction = screen.getByRole("link", { name: /present/i });
    const toolbar = screen.getByTestId("report-toolbar");
    const position = headerAction.compareDocumentPosition(toolbar);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

// unify-top-action-toolbars D1/D3: the head action controls sit in the same
// unframed page-header cluster as lead. Pin that the controls are present in
// the headerActions slot and that the Present/Print hrefs are preserved.
describe("HeadReportShell — header action cluster (unify-top-action-toolbars)", () => {
  it("renders the action controls inside WeeklyReportPage headerActions", () => {
    render(<HeadReportShell reportId={TEST_REPORT_ID} mode="form" />);
    const headerActions = screen.getByTestId("weekly-report-header-actions");
    expect(screen.queryByTestId("report-actions-pill")).not.toBeInTheDocument();
    // Header cluster: scope toggle (radiogroup) + view-mode toggle (Edit/Slides).
    // The next/link mock drops aria-label, so match the segment text instead.
    expect(within(headerActions).getByRole("radiogroup")).toBeInTheDocument();
    expect(
      within(headerActions).getByRole("link", { name: /slides/i }),
    ).toBeInTheDocument();
    expect(
      within(headerActions).getByRole("link", { name: /present/i }),
    ).toBeInTheDocument();
    expect(
      within(headerActions).getByRole("link", { name: /print/i }),
    ).toBeInTheDocument();
    expect(
      within(headerActions).getByTestId("agent-review-coming-soon"),
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

  it("slides mode renders the lead-style header action cluster", () => {
    render(<HeadReportShell reportId={TEST_REPORT_ID} mode="slides" />);
    expect(screen.queryByTestId("report-actions-pill")).not.toBeInTheDocument();
    const header = screen.getByRole("heading", { name: "Status Report" })
      .parentElement!.parentElement!.parentElement!;
    expect(
      within(header).getByRole("link", { name: /present/i }),
    ).toBeInTheDocument();
    expect(
      within(header).getByRole("link", { name: /print/i }),
    ).toBeInTheDocument();
    // Agent-review is intentionally NOT in the slides shell header — the head
    // slide deck owns the single placeholder (deferred-feature-pattern).
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

  it("head navigator shows NO submitted marker (W3: lead-only)", async () => {
    // The head shell fabricates isSubmitted:true on every history entry, but
    // the submitted marker is opt-in via showLeadSubmissionMarkers +
    // leadSubmittedAt — props the head shell never passes. So neither the
    // trigger nor the opened listbox may render a "Submitted" pill.
    const user = userEvent.setup();
    wireQueries();
    mockPathname.mockReturnValue(`/head/report/${ACTIVE_ID}`);

    render(<HeadReportShell reportId={ACTIVE_ID} mode="form" />);

    const trigger = screen.getByRole("combobox", {
      name: /select reporting period/i,
    });
    expect(screen.queryByText("Submitted")).not.toBeInTheDocument();
    await user.click(trigger);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.queryByText("Submitted")).not.toBeInTheDocument();
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

// driver-findings-followups item 3: from a PUBLISHED week the navigator must
// still reach the CURRENT week. The displayed published week IS in history, so
// the old code prepended nothing and the active week was absent from the
// dropdown. The shell now fetches the active period separately (`{}` query) and
// prepends it, so it is always an option.
describe("HeadReportShell — active week reachable from a published week (item 3)", () => {
  const ACTIVE_ID = "a0000000-0000-4000-8000-000000000001";
  const PUBLISHED_ID = "a0000000-0000-4000-8000-000000000005";

  // Wire the two weeklyReport.get queries apart by reportId (queryKey[1]):
  // the DISPLAYED query (reportId=PUBLISHED_ID) returns the published week, the
  // ACTIVE query (reportId=null, i.e. `{}`) returns the current open week.
  function wirePublishedView() {
    const impl = (opts: { queryKey?: unknown[] }) => {
      const key = opts.queryKey?.[0];
      if (key === "weeklyReport.get") {
        const requestedReportId = opts.queryKey?.[1];
        if (requestedReportId === null) {
          return {
            data: {
              status: "active",
              reportId: ACTIVE_ID,
              periodStart: "2026-06-08T00:00:00.000Z",
              periodEnd: "2026-06-14T00:00:00.000Z",
              periodStatus: "open",
            },
            isLoading: false,
            isError: false,
            error: null,
          };
        }
        return {
          data: {
            status: "active",
            reportId: PUBLISHED_ID,
            periodStart: "2026-05-18T00:00:00.000Z",
            periodEnd: "2026-05-24T00:00:00.000Z",
            periodStatus: "published",
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
              reportId: PUBLISHED_ID,
              periodStart: "2026-05-18T00:00:00.000Z",
              periodEnd: "2026-05-24T00:00:00.000Z",
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

  it("offers the current week as an option while viewing a published week", async () => {
    const user = userEvent.setup();
    wirePublishedView();
    mockPathname.mockReturnValue(`/head/report/${PUBLISHED_ID}`);

    render(<HeadReportShell reportId={PUBLISHED_ID} mode="form" />);

    // Trigger resolves to the displayed published week (May 18-24).
    const trigger = screen.getByRole("combobox", {
      name: /select reporting period/i,
    });
    expect(trigger).toHaveTextContent(/may 18.*24/i);

    // Opening the listbox exposes the CURRENT week (Jun 8-14) as a reachable
    // option — the regression item 3 fixes. Without the active-prepend it would
    // be absent (history holds only the published week).
    await user.click(trigger);
    const options = screen.getAllByRole("option");
    expect(options.some((o) => /jun 8.*14/i.test(o.textContent))).toBe(true);
  });
});
