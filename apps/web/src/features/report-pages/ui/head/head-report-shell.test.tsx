// @vitest-environment jsdom
//
// Head shell routes document actions and context controls into the report
// chrome, plus a header context label beside the title.

import "@testing-library/jest-dom/vitest";

import { useQuery } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { makeQueryState } from "../../../../test-utils/query-state";

/* ---- Module mocks (hoisted above all imports of the SUT) ---- */

// Deck no longer surfaces a focus href; stub exposes the shell-owned density
// state without introducing a second control row into this shell test.
vi.mock("../../../slides", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../slides")>();
  return {
    ...actual,
    HeadSlidesClient: ({
      density,
    }: {
      density?: "document" | "presentation";
    }) => (
      <div
        data-testid="head-slides-client-stub"
        data-density={density ?? "uncontrolled"}
      />
    ),
  };
});

// Shell test only verifies Publish & Lock is mounted, not its internals.
vi.mock("../../../period", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../period")>();
  return {
    ...actual,
    HeadPublishLockAction: () => (
      <div data-testid="head-publish-lock-action-stub" />
    ),
  };
});

vi.mock("../weekly/weekly-report-page", () => ({
  // Synthesize header + Document/Context toolbar groups so routing is pinable.
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
      <header className="flex flex-wrap items-center justify-between gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_auto]">
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

// Branch the mock on queryKey: compiledHistory vs weeklyReport.get shapes.
vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );
  return {
    ...actual,
    useQuery: vi.fn((opts: { queryKey?: unknown[] }) => {
      const key = opts.queryKey?.[0];
      if (key === "weeklyReport.get") {
        return makeQueryState({ data: { status: "no-period" } });
      }
      return makeQueryState({ data: { entries: [] } });
    }),
    // ExportPdfButton (rendered in the shell toolbar trailing group) calls
    // useMutation for pdfExport.request. Stub it so the shell mounts without a
    // QueryClientProvider; these tests do not exercise export behavior.
    useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  };
});

vi.mock("../../../../shared/lib/trpc/trpc-context", () => ({
  useTRPC: () => ({
    reports: {
      compiledHistory: {
        queryOptions: () => ({ queryKey: ["reports.compiledHistory"] }),
      },
    },
    weeklyReport: {
      get: {
        // Encode reportId so DISPLAYED (`{ reportId }`) and ACTIVE (`{}` → null) differ.
        queryOptions: (input?: { reportId?: string }) => ({
          queryKey: ["weeklyReport.get", input?.reportId ?? null],
        }),
      },
    },
    // ExportPdfButton calls these on render; stub so the shell mounts cleanly.
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
    // Toolbar hosts the single agent-review placeholder in slides mode too.
    render(<HeadReportShell reportId={TEST_REPORT_ID} mode="slides" />);
    expect(screen.getAllByTestId("agent-review-coming-soon")).toHaveLength(1);
    expect(
      within(
        screen.getByRole("group", { name: "Context controls" }),
      ).getByTestId("agent-review-coming-soon"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("head-slides-client-stub")).toBeInTheDocument();
    expect(
      screen
        .getByTestId("head-slides-client-stub")
        .closest("[data-layout-key]"),
    ).toHaveAttribute("data-layout-key", "report-page");
    expect(
      screen.getByRole("heading", { name: "Status Report" }).closest("header"),
    ).toHaveAttribute("data-layout-key", "weekly-report-header");
    expect(
      screen.getByRole("group", { name: "Context controls" }),
    ).toHaveAttribute("data-layout-key", "report-context-toolbar");
  });

  it("slides mode drops the Open focused report link and hosts Publish & Lock", () => {
    // Drill-in link removed (deck has its own nav); header hosts Publish & Lock.
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

  it("renders one inert Slide templates control only in slides context", async () => {
    const user = userEvent.setup();

    const formRender = render(
      <HeadReportShell reportId={TEST_REPORT_ID} mode="form" />,
    );
    expect(
      screen.queryByTestId("slide-templates-coming-soon"),
    ).not.toBeInTheDocument();
    formRender.unmount();

    render(<HeadReportShell reportId={TEST_REPORT_ID} mode="slides" />);
    const slidesToolbar = screen.getByRole("group", {
      name: "Context controls",
    });
    const templates = within(slidesToolbar).getByTestId(
      "slide-templates-coming-soon",
    );
    expect(templates).toHaveAttribute("aria-disabled", "true");
    expect(
      within(slidesToolbar).getAllByTestId("slide-templates-coming-soon"),
    ).toHaveLength(1);

    await user.click(templates);
    expect(templates).toHaveAttribute("aria-disabled", "true");
  });

  it("keeps shell-owned density reversible in the single slides context toolbar", async () => {
    const user = userEvent.setup();
    render(<HeadReportShell reportId={TEST_REPORT_ID} mode="slides" />);

    const contextControls = screen.getByRole("group", {
      name: "Context controls",
    });
    expect(
      within(contextControls).getAllByRole("group", { name: "Slide density" }),
    ).toHaveLength(1);
    expect(screen.getByTestId("head-slides-client-stub")).toHaveAttribute(
      "data-density",
      "document",
    );

    await user.click(
      within(contextControls).getByRole("button", { name: "Presentation" }),
    );
    expect(screen.getByTestId("head-slides-client-stub")).toHaveAttribute(
      "data-density",
      "presentation",
    );

    await user.click(
      within(contextControls).getByRole("button", { name: "Document" }),
    );
    expect(screen.getByTestId("head-slides-client-stub")).toHaveAttribute(
      "data-density",
      "document",
    );
    expect(
      screen.getAllByRole("group", { name: "Slide density" }),
    ).toHaveLength(1);
  });

  it("reserves period navigation and document-action geometry while slides load", () => {
    vi.mocked(useQuery).mockImplementation(() =>
      makeQueryState({ data: undefined, isLoading: true }),
    );

    render(<HeadReportShell reportId={TEST_REPORT_ID} mode="slides" />);

    expect(
      screen.getByRole("heading", { name: "Status Report" }).closest("header"),
    ).toHaveClass("min-h-36", "sm:min-h-0");

    expect(
      screen.getByTestId("head-period-navigation-skeleton"),
    ).toBeInTheDocument();
    expect(
      screen
        .getByRole("group", { name: "Document actions" })
        .querySelectorAll('[data-slot="skeleton"]'),
    ).toHaveLength(2);
    expect(
      screen.queryByTestId("head-publish-lock-action-stub"),
    ).not.toBeInTheDocument();
  });
});

// Segmented toggles + agent-review stay; Present/Print are gone (Slides mode
// and labeled Export-PDF replace them).
describe("HeadReportShell — context control cluster", () => {
  // Wire an ACTIVE displayed period so the shell's Export-PDF renders (it is
  // gated on an active, resolvable period). compiledHistory stays empty.
  function wireActivePeriod() {
    const impl = (opts: Parameters<typeof useQuery>[0]) => {
      const key = opts.queryKey[0];
      if (key === "weeklyReport.get") {
        return makeQueryState({
          data: {
            status: "active",
            reportId: TEST_REPORT_ID,
            periodStart: "2026-06-08T00:00:00.000Z",
            periodEnd: "2026-06-14T00:00:00.000Z",
            periodStatus: "published",
          },
        });
      }
      return makeQueryState({ data: { entries: [] } });
    };
    vi.mocked(useQuery).mockImplementation(impl);
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
  });

  it("surfaces a history-query failure instead of silently truncating period navigation", () => {
    const impl = (opts: Parameters<typeof useQuery>[0]) => {
      const key = opts.queryKey[0];
      if (key === "weeklyReport.get") {
        return makeQueryState({
          data: {
            status: "active",
            reportId: TEST_REPORT_ID,
            periodStart: "2026-06-08T00:00:00.000Z",
            periodEnd: "2026-06-14T00:00:00.000Z",
            periodStatus: "published",
          },
        });
      }
      return makeQueryState({ data: undefined, error: new Error("boom") });
    };
    vi.mocked(useQuery).mockImplementation(impl);

    render(<HeadReportShell reportId={TEST_REPORT_ID} mode="form" />);

    expect(screen.getByTestId("head-history-error")).toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Select reporting period" }),
    ).not.toBeInTheDocument();
  });
});

// Navigator must show the addressed active week, not fall back to periods[0].
describe("HeadReportShell — period navigator shows addressed week", () => {
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
    const impl = (opts: Parameters<typeof useQuery>[0]) => {
      const key = opts.queryKey[0];
      if (key === "weeklyReport.get") {
        return makeQueryState({
          data: {
            status: "active",
            reportId: ACTIVE_ID,
            periodStart: ACTIVE_START,
            periodEnd: ACTIVE_END,
            periodStatus: "open",
          },
        });
      }
      return makeQueryState({
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
      });
    };
    vi.mocked(useQuery).mockImplementation(impl);
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

  it("head navigator shows no submitted marker (lead-only)", async () => {
    // Head fabricates isSubmitted but never passes showLeadSubmissionMarkers /
    // leadSubmittedAt, so neither trigger nor listbox may show "Submitted".
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

// Active period is fetched separately and prepended so it stays reachable
// while viewing a published week already in history.
describe("HeadReportShell — active week reachable from a published week", () => {
  const ACTIVE_ID = "a0000000-0000-4000-8000-000000000001";
  const PUBLISHED_ID = "a0000000-0000-4000-8000-000000000005";

  // Wire the two weeklyReport.get queries apart by reportId (queryKey[1]):
  // the DISPLAYED query (reportId=PUBLISHED_ID) returns the published week, the
  // ACTIVE query (reportId=null, i.e. `{}`) returns the current open week.
  function wirePublishedView() {
    const impl = (opts: Parameters<typeof useQuery>[0]) => {
      const key = opts.queryKey[0];
      if (key === "weeklyReport.get") {
        const requestedReportId = opts.queryKey[1];
        if (requestedReportId === null) {
          return makeQueryState({
            data: {
              status: "active",
              reportId: ACTIVE_ID,
              periodStart: "2026-06-08T00:00:00.000Z",
              periodEnd: "2026-06-14T00:00:00.000Z",
              periodStatus: "open",
            },
          });
        }
        return makeQueryState({
          data: {
            status: "active",
            reportId: PUBLISHED_ID,
            periodStart: "2026-05-18T00:00:00.000Z",
            periodEnd: "2026-05-24T00:00:00.000Z",
            periodStatus: "published",
          },
        });
      }
      return makeQueryState({
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
      });
    };
    vi.mocked(useQuery).mockImplementation(impl);
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

    // Listbox must expose the current week; without active-prepend it is absent.
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
