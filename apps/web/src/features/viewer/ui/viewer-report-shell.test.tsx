// @vitest-environment jsdom
// Read-only shell pins toolbar authority and one-shot NOT_FOUND recovery;
// other failures remain terminal.

import "@testing-library/jest-dom/vitest";

import { useQuery } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { makeQueryState } from "../../../test-utils/query-state";

vi.mock("../../slides", () => ({
  HeadSlidesClient: (props: { enableActivity?: boolean }) => (
    <div
      data-testid="slides-client-stub"
      data-enable-activity={String(props.enableActivity)}
    />
  ),
}));

vi.mock("../../report-pages", () => ({
  WeeklyReportPage: ({
    documentActionsLeading,
    contextControls,
  }: {
    documentActionsLeading?: React.ReactNode;
    contextControls?: React.ReactNode;
  }) => (
    <div data-testid="weekly-report-page-stub">
      <header>
        <h1>Status Report</h1>
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

const mockPathname = vi.fn(() => "/reports/test-report-001");
const mockSearchParams = vi.fn(() => new URLSearchParams());
const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: mockReplace, refresh: vi.fn() }),
  useSearchParams: () => mockSearchParams(),
  usePathname: () => mockPathname(),
}));

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
          data: {
            status: "active",
            reportId: "test-report-001",
            periodStart: "2026-06-08T00:00:00.000Z",
            periodEnd: "2026-06-14T00:00:00.000Z",
            periodStatus: "published",
          },
          isLoading: false,
          isError: false,
          error: null,
        };
      }
      return { data: { entries: [] }, isLoading: false, isError: false };
    }),
    useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  };
});

// The shell is the only consumer of getClientErrorDetails in this render tree
// (WeeklyReportPage is stubbed). Mock it so the recovery tests can flag an
// invalid-link NOT_FOUND without constructing a real TRPCClientError.
vi.mock("../../../shared/lib/errors/client-error-reporting", () => ({
  getClientErrorDetails: (error: unknown) => ({
    isInvalidLink:
      (error as { data?: { code?: string } } | null)?.data?.code ===
      "NOT_FOUND",
  }),
}));

vi.mock("../../../shared/lib/trpc/trpc-context", () => ({
  useTRPC: () => ({
    reports: {
      compiledHistory: {
        queryOptions: () => ({ queryKey: ["reports.compiledHistory"] }),
      },
    },
    weeklyReport: {
      get: {
        queryOptions: (input?: { reportId?: string }) => ({
          queryKey: ["weeklyReport.get", input?.reportId ?? null],
        }),
      },
    },
    pdfExport: {
      request: { mutationOptions: () => ({}) },
      status: { queryOptions: () => ({ queryKey: ["pdfExport.status"] }) },
    },
  }),
}));

import { ViewerReportShell } from "./viewer-report-shell";

const REPORT_ID = "test-report-001";

afterEach(() => {
  mockPathname.mockReturnValue("/reports/test-report-001");
  mockSearchParams.mockReturnValue(new URLSearchParams());
  mockReplace.mockReset();
  // mockReset (not mockClear) so a test-installed persistent implementation
  // cannot leak into the next test — reset restores the vi.fn factory impl.
  vi.mocked(useQuery).mockReset();
});

describe("ViewerReportShell — read-only toolbar parity", () => {
  it("surfaces a history-query failure instead of silently truncating period navigation", () => {
    const resultsByQuery = new Map<unknown, ReturnType<typeof useQuery>>([
      [
        "reports.compiledHistory",
        makeQueryState({ data: undefined, error: new Error("boom") }),
      ],
      ["weeklyReport.get", makeQueryState({ data: undefined })],
      ["pdfExport.status", makeQueryState({ data: undefined })],
    ]);
    vi.mocked(useQuery).mockImplementation((options) => {
      const result = resultsByQuery.get(options.queryKey[0]);
      if (result) return result;
      return makeQueryState({ data: undefined });
    });

    render(<ViewerReportShell reportId={REPORT_ID} mode="form" />);

    expect(screen.getByTestId("viewer-history-error")).toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Select reporting period" }),
    ).not.toBeInTheDocument();
  });

  it("form mode renders the scope toggle and view-mode toggle, keeps Agent-review, and drops Back-to-Archive", () => {
    render(<ViewerReportShell reportId={REPORT_ID} mode="form" />);

    const contextControls = screen.getByRole("group", {
      name: "Context controls",
    });
    expect(within(contextControls).getByRole("radiogroup")).toBeInTheDocument();
    expect(
      within(contextControls).getByRole("link", { name: /slides/i }),
    ).toBeInTheDocument();
    // Keep deferred functionality visible without making it interactive.
    expect(
      within(contextControls).getByTestId("agent-review-coming-soon"),
    ).toBeInTheDocument();
    // The viewer navigates periods in place and must not expose an archive exit.
    expect(
      within(contextControls).queryByRole("link", { name: /back to archive/i }),
    ).not.toBeInTheDocument();
  });

  it("renders exactly one Export-PDF, in the document-action row (viewer gets the real export)", () => {
    render(<ViewerReportShell reportId={REPORT_ID} mode="form" />);
    const exportButtons = screen.getAllByRole("button", {
      name: /export pdf/i,
    });
    expect(exportButtons).toHaveLength(1);
    const documentActions = screen.getByRole("group", {
      name: "Document actions",
    });
    expect(
      within(documentActions).getByRole("button", { name: /export pdf/i }),
    ).toBeInTheDocument();
  });

  it("renders NO mutation affordance (no Publish / Lock / Reopen)", () => {
    render(<ViewerReportShell reportId={REPORT_ID} mode="form" />);
    expect(
      screen.queryByRole("button", { name: /publish|lock|reopen/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("head-publish-lock-action-stub"),
    ).not.toBeInTheDocument();
  });

  // A read-only surface must not label its non-slides view as an edit action.
  it("labels the non-slides view-mode segment 'Report', not 'Edit'", () => {
    render(<ViewerReportShell reportId={REPORT_ID} mode="form" />);
    expect(screen.getByRole("link", { name: "Report" })).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /edit/i }),
    ).not.toBeInTheDocument();
  });

  it("view-mode toggle links target /reports/, never /head/report", () => {
    render(<ViewerReportShell reportId={REPORT_ID} mode="form" />);
    const slidesHref = screen
      .getByRole("link", { name: /slides/i })
      .getAttribute("href");
    expect(slidesHref).toContain(`/reports/${REPORT_ID}`);
    expect(slidesHref).toContain("mode=slides");
    expect(slidesHref).not.toContain("/head/report");
  });

  it("threads the URL scope into the toggle links", () => {
    mockSearchParams.mockReturnValue(new URLSearchParams("scope=lead"));
    render(<ViewerReportShell reportId={REPORT_ID} mode="form" />);
    const slidesHref = screen
      .getByRole("link", { name: /slides/i })
      .getAttribute("href");
    expect(slidesHref).toContain("scope=lead");
  });

  // One-shot recovery markers must not leak into in-shell navigation links,
  // or a later History selection would be misread as a Status navigation.
  it("strips the source/recovery markers from navigation links", () => {
    mockSearchParams.mockReturnValue(
      new URLSearchParams("source=status&recovery=0&scope=lead"),
    );
    render(<ViewerReportShell reportId={REPORT_ID} mode="form" />);
    const slidesHref = screen
      .getByRole("link", { name: /slides/i })
      .getAttribute("href");
    expect(slidesHref).not.toContain("source=");
    expect(slidesHref).not.toContain("recovery=");
    // a legitimate param is still threaded through
    expect(slidesHref).toContain("scope=lead");
  });

  it("selects the addressed older period instead of the newest history entry", () => {
    const addressedReportId = "2026-W16";
    mockPathname.mockReturnValue(`/reports/${addressedReportId}`);
    const resultsByQuery = new Map<unknown, ReturnType<typeof useQuery>>([
      [
        "reports.compiledHistory",
        makeQueryState({
          data: {
            entries: [
              {
                reportId: "2026-W17",
                periodStart: "2026-04-21T00:00:00.000Z",
                periodEnd: "2026-04-27T00:00:00.000Z",
                archived: false,
              },
              {
                reportId: addressedReportId,
                periodStart: "2026-04-14T00:00:00.000Z",
                periodEnd: "2026-04-20T00:00:00.000Z",
                archived: false,
              },
            ],
          },
        }),
      ],
      [
        "weeklyReport.get",
        makeQueryState({
          data: {
            status: "active",
            reportId: addressedReportId,
            periodStart: "2026-04-14T00:00:00.000Z",
            periodEnd: "2026-04-20T00:00:00.000Z",
            periodStatus: "published",
          },
        }),
      ],
      ["pdfExport.status", makeQueryState({ data: undefined })],
    ]);
    vi.mocked(useQuery).mockImplementation((options) => {
      const queryId = options.queryKey[0];
      const result = resultsByQuery.get(queryId);
      if (!result) throw new Error(`Unexpected query: ${String(queryId)}`);
      return result;
    });

    render(<ViewerReportShell reportId={addressedReportId} mode="form" />);

    const periodTrigger = screen.getByRole("combobox", {
      name: "Select reporting period",
    });
    expect(periodTrigger).toHaveTextContent("Apr 14–20, 2026");
    expect(periodTrigger).not.toHaveTextContent("Apr 21–27, 2026");
  });

  it("slides mode renders the deck with activity disabled (head-only procedure)", () => {
    render(<ViewerReportShell reportId={REPORT_ID} mode="slides" />);
    const deck = screen.getByTestId("slides-client-stub");
    expect(deck).toBeInTheDocument();
    expect(deck).toHaveAttribute("data-enable-activity", "false");
    // Still no mutation affordance on the slides surface.
    expect(
      screen.queryByRole("button", { name: /publish|lock|reopen/i }),
    ).not.toBeInTheDocument();
  });
});

// Recovery is limited to the report route because a rejected stale link
// surfaces there as an invalid-link NOT_FOUND.
describe("ViewerReportShell — one-shot race recovery", () => {
  function makeGetErrorImpl() {
    return (opts: { queryKey?: readonly unknown[] }) => {
      if (opts.queryKey?.[0] === "weeklyReport.get") {
        // Shape getClientErrorDetails reads as a NOT_FOUND → isInvalidLink.
        return makeQueryState({
          data: undefined,
          error: { data: { code: "NOT_FOUND" } },
        });
      }
      return makeQueryState({ data: { entries: [] } });
    };
  }

  afterEach(() => {
    mockSearchParams.mockReturnValue(new URLSearchParams());
    mockReplace.mockReset();
    vi.mocked(useQuery).mockReset();
  });

  it("redirects once to /reports/latest?recovery=1 from the Status entry (source=status, recovery=0)", () => {
    mockSearchParams.mockReturnValue(
      new URLSearchParams("source=status&recovery=0"),
    );
    vi.mocked(useQuery).mockImplementation(makeGetErrorImpl());

    render(<ViewerReportShell reportId={REPORT_ID} mode="form" />);

    expect(mockReplace).toHaveBeenCalledWith("/reports/latest?recovery=1");
    // The terminal "Report not found" notice must not flash; show resolving.
    expect(screen.getByRole("status")).toHaveTextContent(
      /opening the status report/i,
    );
  });

  it("does NOT redirect when already retried (recovery=1) — loop guard", () => {
    mockSearchParams.mockReturnValue(
      new URLSearchParams("source=status&recovery=1"),
    );
    vi.mocked(useQuery).mockImplementation(makeGetErrorImpl());

    render(<ViewerReportShell reportId={REPORT_ID} mode="form" />);

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("does NOT redirect on a direct/History NOT_FOUND (no source=status)", () => {
    mockSearchParams.mockReturnValue(new URLSearchParams());
    vi.mocked(useQuery).mockImplementation(makeGetErrorImpl());

    render(<ViewerReportShell reportId={REPORT_ID} mode="form" />);

    expect(mockReplace).not.toHaveBeenCalled();
  });
});
