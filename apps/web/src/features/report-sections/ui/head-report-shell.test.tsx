/**
 * @vitest-environment jsdom
 *
 * report-toolbar-layout: the head report shell routes its controls into the
 * page's two-row ReportToolbar — document actions (Export-PDF) on top, context
 * controls (Agent review, period nav, scope / view-mode toggles) on the bottom
 * row — plus a header context label beside the title.
 */

import "@testing-library/jest-dom/vitest";

import { useQuery } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

/* ---- Module mocks (hoisted above all imports of the SUT) ---- */

// head-surface-uat-polish (F1): the per-slide "Open focused report" drill-in
// link was removed, so the deck no longer surfaces a focus href to the shell.
// The stub is a plain marker.
vi.mock("../../../components/slides/head-slides-client", () => ({
  HeadSlidesClient: () => <div data-testid="head-slides-client-stub" />,
}));

// head-surface-uat-polish (F1): the slides header hosts the Publish & Lock
// action (a self-contained component with its own query/mutations). Stub it
// here — the shell test only verifies it is mounted on the header line, not its
// publish internals (those live in publish-lock-button.test).
vi.mock("../../period/ui/head-publish-lock-action", () => ({
  HeadPublishLockAction: () => (
    <div data-testid="head-publish-lock-action-stub" />
  ),
}));

vi.mock("./weekly-report-page", () => ({
  // report-toolbar-layout: render the header context label + the two toolbar
  // slots so tests can pin where the shell routes each. The real page renders
  // the single two-row ReportToolbar below the header; this stub synthesizes
  // that arrangement — header row first, then a report-toolbar with a
  // Document-action group and a Context-control group.
  WeeklyReportPage: ({
    documentActionsLeading,
    contextControls,
    headerContextLabel,
  }: {
    documentActionsLeading?: React.ReactNode;
    contextControls?: React.ReactNode;
    headerContextLabel?: React.ReactNode;
  }) => (
    <div data-testid="weekly-report-page-stub">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1>Status Report</h1>
        <div data-testid="weekly-report-header-label">{headerContextLabel}</div>
      </header>
      <div data-testid="report-toolbar">
        <div role="group" aria-label="Document actions">
          {documentActionsLeading}
        </div>
        <div role="group" aria-label="Context controls">
          {contextControls}
        </div>
      </div>
    </div>
  ),
}));

vi.mock("next/link", () => ({
  // Forward className + title so the active-segment styling on ViewModeToggle is
  // observable; drop Next-only props (scroll) that <a> would reject.
  default: ({
    href,
    children,
    className,
    title,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
    title?: string;
  }) => (
    <a href={href} className={className} title={title}>
      {children}
    </a>
  ),
}));

// The PeriodNavigator (rendered in the toolbar) reads these. Pathname is
// overridden per-test below to point at the addressed head report week.
const mockPathname = vi.fn(() => "/head/report");
const mockSearchParams = vi.fn(() => new URLSearchParams());
const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: mockReplace, refresh: vi.fn() }),
  useSearchParams: () => mockSearchParams(),
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
    // ExportPdfButton (rendered in the shell toolbar trailing group) calls
    // useMutation for pdfExport.request. Stub it so the shell mounts without a
    // QueryClientProvider; these tests do not exercise export behavior.
    useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  };
});

vi.mock("../../../lib/trpc-context", () => ({
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
    // report-toolbar-parity: the shell toolbar now renders ExportPdfButton in
    // its trailing group, which calls these on every render. Stub the surface
    // so the shell mounts without throwing.
    pdfExport: {
      request: { mutationOptions: () => ({}) },
      status: {
        queryOptions: () => ({ queryKey: ["pdfExport.status"] }),
      },
    },
  }),
}));

/* ---- Import under test (after all vi.mock registrations) ---- */

import { HeadReportShell } from "./head-report-shell";

const TEST_REPORT_ID = "test-report-001";

describe("HeadReportShell — agent-review placeholder per mode", () => {
  it("form mode renders exactly one placeholder in the context controls", () => {
    render(<HeadReportShell reportId={TEST_REPORT_ID} mode="form" />);
    expect(screen.getAllByTestId("agent-review-coming-soon")).toHaveLength(1);
    expect(
      within(
        screen.getByRole("group", { name: "Context controls" }),
      ).getByTestId("agent-review-coming-soon"),
    ).toBeInTheDocument();
  });

  it("slides mode renders exactly one placeholder in the toolbar context controls", () => {
    // head-slides-lead-parity (S6): the deck's slide-header slot was removed, so
    // the toolbar context row now hosts the single placeholder in slides mode
    // too — exactly one per surface, like form mode.
    render(<HeadReportShell reportId={TEST_REPORT_ID} mode="slides" />);
    expect(screen.getAllByTestId("agent-review-coming-soon")).toHaveLength(1);
    expect(
      within(
        screen.getByRole("group", { name: "Context controls" }),
      ).getByTestId("agent-review-coming-soon"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("head-slides-client-stub")).toBeInTheDocument();
  });

  it("slides mode drops the Open focused report link and hosts Publish & Lock (F1)", () => {
    // head-surface-uat-polish (F1): the per-slide drill-in link was removed —
    // it duplicated the deck's own slide navigation — and replaced by the same
    // Publish & Lock action the edit mode offers, on the header line.
    render(<HeadReportShell reportId={TEST_REPORT_ID} mode="slides" />);
    expect(
      screen.queryByRole("link", { name: /open focused report/i }),
    ).not.toBeInTheDocument();
    expect(
      within(
        screen.getByRole("group", { name: "Document actions" }),
      ).getByTestId("head-publish-lock-action-stub"),
    ).toBeInTheDocument();
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

  it("the toolbar sits below the page header row (lead arrangement)", () => {
    render(<HeadReportShell reportId={TEST_REPORT_ID} mode="form" />);
    // Anchor on the page heading: the shared toolbar must follow it in document
    // order (header row first, then the two action rows).
    const heading = screen.getByRole("heading", { name: /status report/i });
    const toolbar = screen.getByTestId("report-toolbar");
    const position = heading.compareDocumentPosition(toolbar);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

// head-toolbar-semantics + report-toolbar-parity: the header action cluster
// keeps the segmented toggles and the agent-review placeholder, but the
// standalone Present and browser-Print links are GONE. Presentation is reached
// via the ViewModeToggle Slides mode; the only export is the single labeled
// Export-PDF in the ReportToolbar trailing group.
describe("HeadReportShell — context control cluster (head-toolbar-semantics)", () => {
  // Wire an ACTIVE displayed period so the shell's Export-PDF renders (it is
  // gated on an active, resolvable period). compiledHistory stays empty.
  function wireActivePeriod() {
    const impl = (opts: { queryKey?: unknown[] }) => {
      const key = opts.queryKey?.[0];
      if (key === "weeklyReport.get") {
        return {
          data: {
            status: "active",
            reportId: TEST_REPORT_ID,
            periodStart: "2026-06-08T00:00:00.000Z",
            periodEnd: "2026-06-14T00:00:00.000Z",
            periodStatus: "published",
          },
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
    };
    vi.mocked(useQuery).mockImplementation(impl as unknown as typeof useQuery);
  }

  it("renders the toggles and agent-review in the context controls, with NO Present/Print links", () => {
    wireActivePeriod();
    render(<HeadReportShell reportId={TEST_REPORT_ID} mode="form" />);
    const contextControls = screen.getByRole("group", {
      name: "Context controls",
    });
    expect(screen.queryByTestId("report-actions-pill")).not.toBeInTheDocument();
    // Context row: scope toggle (radiogroup) + view-mode toggle (Edit/Slides).
    expect(within(contextControls).getByRole("radiogroup")).toBeInTheDocument();
    expect(
      within(contextControls).getByRole("link", { name: /slides/i }),
    ).toBeInTheDocument();
    expect(
      within(contextControls).getByTestId("agent-review-coming-soon"),
    ).toBeInTheDocument();
    // Present + browser-Print header links are removed entirely.
    expect(
      screen.queryByRole("link", { name: /present/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /print/i }),
    ).not.toBeInTheDocument();
  });

  it("places the agent-review placeholder before the toggles (leading edge)", () => {
    wireActivePeriod();
    render(<HeadReportShell reportId={TEST_REPORT_ID} mode="form" />);
    const contextControls = screen.getByRole("group", {
      name: "Context controls",
    });
    const agentReview = within(contextControls).getByTestId(
      "agent-review-coming-soon",
    );
    const scopeToggle = within(contextControls).getByRole("radiogroup");
    // head-toolbar-semantics Req3: the placeholder is the FIRST element of the
    // group, so the scope toggle FOLLOWS it in document order.
    const position = agentReview.compareDocumentPosition(scopeToggle);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("renders exactly one labeled Export-PDF in the document-action row", () => {
    wireActivePeriod();
    render(<HeadReportShell reportId={TEST_REPORT_ID} mode="form" />);
    const exportButtons = screen.getAllByRole("button", {
      name: /export pdf/i,
    });
    expect(exportButtons).toHaveLength(1);
    // The single Export-PDF is a document action, not a context control.
    const documentActions = screen.getByRole("group", {
      name: "Document actions",
    });
    expect(
      within(documentActions).getByRole("button", { name: /export pdf/i }),
    ).toBeInTheDocument();
    const contextControls = screen.getByRole("group", {
      name: "Context controls",
    });
    expect(
      within(contextControls).queryByRole("button", { name: /export pdf/i }),
    ).not.toBeInTheDocument();
  });

  it("slides mode keeps the toggles but renders no Present/Print links", () => {
    wireActivePeriod();
    render(<HeadReportShell reportId={TEST_REPORT_ID} mode="slides" />);
    expect(screen.queryByTestId("report-actions-pill")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /slides/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /present/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /print/i }),
    ).not.toBeInTheDocument();
    // head-slides-lead-parity (S6): the single Agent-review placeholder now
    // lives in the slides toolbar context row (asserted in the per-mode suite).
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

// head-toolbar-semantics: the view-mode toggle MUST reflect the active mode, and
// the head view state (mode/scope/show-archived) MUST live in the URL so refresh
// and shared links restore it.
describe("HeadReportShell — view-mode toggle reflects mode + URL view state", () => {
  const ACTIVE_VAR = "bg-[var(--color-toggle-active)]";

  afterEach(() => {
    // Reset the per-test URL override so later suites see an empty query.
    mockSearchParams.mockReturnValue(new URLSearchParams());
    mockReplace.mockReset();
  });

  it("highlights the Slides segment as active when mode is slides", () => {
    mockPathname.mockReturnValue("/head/report");
    render(<HeadReportShell reportId={TEST_REPORT_ID} mode="slides" />);

    const slides = screen.getByRole("link", { name: /slides/i });
    const edit = screen.getByRole("link", { name: /edit/i });
    expect(slides.className).toContain(ACTIVE_VAR);
    expect(edit.className).not.toContain(ACTIVE_VAR);
  });

  it("highlights the Edit segment as active in form mode", () => {
    mockPathname.mockReturnValue("/head/report");
    render(<HeadReportShell reportId={TEST_REPORT_ID} mode="form" />);

    const slides = screen.getByRole("link", { name: /slides/i });
    const edit = screen.getByRole("link", { name: /edit/i });
    expect(edit.className).toContain(ACTIVE_VAR);
    expect(slides.className).not.toContain(ACTIVE_VAR);
  });

  it("restores scope from the URL and threads it into the toggle links", () => {
    mockPathname.mockReturnValue("/head/report");
    mockSearchParams.mockReturnValue(new URLSearchParams("scope=lead"));
    render(<HeadReportShell reportId={TEST_REPORT_ID} mode="form" />);

    // The Slides link preserves scope and flips mode; the Edit link preserves
    // scope and drops mode — so a shared link keeps the active scope.
    const slidesHref = screen
      .getByRole("link", { name: /slides/i })
      .getAttribute("href");
    expect(slidesHref).toContain("scope=lead");
    expect(slidesHref).toContain("mode=slides");
    const editHref = screen
      .getByRole("link", { name: /edit/i })
      .getAttribute("href");
    expect(editHref).toContain("scope=lead");
    expect(editHref).not.toContain("mode=");
  });

  it("writes the show-archived filter to the URL via router.replace", async () => {
    const user = userEvent.setup();
    mockPathname.mockReturnValue("/head/report");
    render(<HeadReportShell reportId={TEST_REPORT_ID} mode="form" />);

    await user.click(screen.getByRole("switch", { name: /archive/i }));
    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining("archive=1"),
      expect.objectContaining({ scroll: false }),
    );
  });

  it("restores the show-archived filter from the URL on load", () => {
    // The spec's "refresh preserves the view state" scenario covers the archive
    // filter too: a shared `?archive=1` URL must restore the toggle as checked,
    // not just write it on click.
    mockPathname.mockReturnValue("/head/report");
    mockSearchParams.mockReturnValue(new URLSearchParams("archive=1"));
    render(<HeadReportShell reportId={TEST_REPORT_ID} mode="form" />);

    expect(screen.getByRole("switch", { name: /archive/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });
});
