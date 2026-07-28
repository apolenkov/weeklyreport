// Wire-up tests: tRPC stub intercepts publish/reopen/get; no MSW handlers.
// Assert mutation variables, cache invalidation, and toast on success.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { TRPCClientError } from "@trpc/client";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../../lib/trpc-context";

// We mock cache-keys to verify invalidation cascade without actually inspecting
// react-query internals.
vi.mock("../../../lib/cache-keys", () => ({
  invalidateDashboard: vi.fn(),
  invalidateLeadForm: vi.fn(),
  invalidateLeadHistory: vi.fn(),
  invalidateReview: vi.fn(),
}));

// Mock toast so we can assert success/error feedback.
const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]): void => {
      toastSuccess(...args);
    },
    error: (...args: unknown[]): void => {
      toastError(...args);
    },
    info: vi.fn(),
  },
}));

// Mock Next.js navigation hooks consumed by the fallback PeriodNavigator. We
// don't drive route changes in these tests — just neutralize the hook calls.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/head/report",
}));

import {
  SessionContext,
  type SessionUser,
} from "../../../lib/session-provider";
import { createMockTRPC } from "../../../test-utils/mock-trpc";
import { makeWeeklyReportData } from "./__tests__/weekly-report-page-harness";
import { WeeklyReportPage } from "./weekly-report-page";

function renderPage(
  data: ReturnType<typeof makeWeeklyReportData>,
  authorId?: string,
  role: SessionUser["role"] = "head",
  scope?: "product" | "lead",
  documentActionsLeading?: ReactNode,
  contextControls?: ReactNode,
  contextControlsLeading?: ReactNode,
) {
  const { proxy, captured } = createMockTRPC([
    { path: ["weeklyReport", "get"], query: data },
    { path: ["period", "publish"], mutation: true },
    { path: ["period", "reopen"], mutation: true },
    // ExportPdfButton calls both pdfExport.request.mutationOptions
    // and pdfExport.status.queryOptions unconditionally on every render. Mock the
    // surface here so the parent page renders without throwing — these tests do
    // not exercise PDF export behavior, they only need the mock to be structurally
    // valid. pdfExport.status has enabled:false in the component; the factory
    // stub without enabled is fine because the component manages enabled itself.
    { path: ["pdfExport", "request"], mutation: true },
    { path: ["pdfExport", "status"], query: null },
    { path: ["review", "dashboard"] },
    { path: ["review", "verdict"], mutation: true },
    { path: ["review", "comment"], mutation: true },
    { path: ["review", "deleteComment"], mutation: true },
    // Group id mounts the per-group Acknowledge control; empty roster = un-acked.
    { path: ["review", "acknowledgements"], queryByInput: () => [] },
    { path: ["review", "acknowledge"], mutation: true },
    { path: ["archive", "list"] },
    { path: ["archive", "archiveReport"], mutation: true },
    { path: ["archive", "unarchiveReport"], mutation: true },
    { path: ["reports", "myHistory"] },
    { path: ["reports", "getActive"] },
    { path: ["leadForm", "byPeriod"] },
    { path: ["leadForm", "versions"] },
    { path: ["admin", "snapshot"] },
    { path: ["admin", "getSettings"] },
  ]);

  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <SessionContext.Provider
          value={{
            user: {
              id: "head-user-id",
              name: "Test User",
              email: "test.user@example.com",
              role,
            },
            organization: null,
            isLoading: false,
            isAuthenticated: true,
          }}
        >
          <TRPCProxyContext.Provider value={proxy}>
            {children}
          </TRPCProxyContext.Provider>
        </SessionContext.Provider>
      </QueryClientProvider>
    );
  }

  const renderResult = render(
    <WeeklyReportPage
      authorId={authorId}
      scope={scope}
      documentActionsLeading={documentActionsLeading}
      contextControls={contextControls}
      contextControlsLeading={contextControlsLeading}
    />,
    { wrapper: Wrapper },
  );

  return { ...renderResult, captured };
}

describe("WeeklyReportPage — async Export PDF button role gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  // Real export for head/admin/viewer (viewer slice is requester-scoped).
  // pdfExport is leadershipProcedure — lead is FORBIDDEN.
  it.each(["head", "admin", "viewer"] as const)(
    "renders the async Export PDF button for %s",
    async (role) => {
      renderPage(makeWeeklyReportData("published"), undefined, role);
      expect(
        await screen.findByRole("button", { name: /export pdf/i }),
      ).toBeInTheDocument();
    },
  );

  it("shows a lead the inert ComingSoon control, NOT an active Export button", async () => {
    renderPage(makeWeeklyReportData("published"), undefined, "lead");
    // The inert control is present (lead export is a deferred ComingSoon).
    expect(
      await screen.findByTestId("lead-pdf-export-coming-soon"),
    ).toBeInTheDocument();
    // …and the real Export PDF button never renders for a lead.
    expect(
      screen.queryByRole("button", { name: /export pdf/i }),
    ).not.toBeInTheDocument();
  });
});

// report-toolbar-layout: the period-context bar renders through the shared
// The page splits controls by axis: document actions render on the page header
// line (DocumentActionGroup), and the bordered ReportToolbar holds only the
// single Context-control bar below the header. Department context is a header
// label, not a toolbar control, so the default toolbar carries no center label.
describe("WeeklyReportPage — shared period toolbar (report-toolbar-layout)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it("renders document actions on the header line and the context bar below it", async () => {
    renderPage(makeWeeklyReportData("open"));
    const heading = await screen.findByRole("heading", {
      name: /status report/i,
    });
    // The bordered toolbar IS the Context-control bar (one labeled group).
    const toolbar = screen.getByTestId("report-toolbar");
    expect(toolbar).toBeInTheDocument();
    expect(toolbar).toHaveAttribute("aria-label", "Context controls");
    // Document actions live on the header line, NOT inside the toolbar.
    const docGroup = screen.getByRole("group", { name: "Document actions" });
    expect(
      within(toolbar).queryByRole("group", { name: "Document actions" }),
    ).toBeNull();
    // Focus order: the document-action group precedes the context bar in the DOM.
    expect(
      docGroup.compareDocumentPosition(toolbar) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // The toolbar sits BELOW the page header row.
    expect(
      heading.compareDocumentPosition(toolbar) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("renders shell-composed context controls in the bottom row (full override)", async () => {
    renderPage(
      makeWeeklyReportData("open"),
      undefined,
      "head",
      undefined,
      undefined,
      <div data-testid="shell-context" />,
    );
    await screen.findByRole("heading", { name: /status report/i });
    const contextRow = screen.getByRole("group", { name: "Context controls" });
    expect(within(contextRow).getByTestId("shell-context")).toBeInTheDocument();
  });

  it("renders a shell-supplied leading document action before the built-in lifecycle actions", async () => {
    // documentActionsLeading replaces the default export and renders before the
    // page's own Publish & Lock lifecycle action in the Document action row.
    renderPage(
      makeWeeklyReportData("open"),
      undefined,
      "head",
      undefined,
      <a href="/custom-action">Custom action</a>,
    );
    const customAction = await screen.findByRole("link", {
      name: /custom action/i,
    });
    const publish = screen.getByRole("button", { name: /publish . lock/i });
    expect(
      customAction.compareDocumentPosition(publish) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

// report-toolbar-parity + head-toolbar-semantics: exactly one labeled Export-PDF
// renders, on the page header line's document-action group (not inside the
// bordered toolbar); the publish precondition hint sits on the report-status row.
describe("WeeklyReportPage — Export-PDF relocation + publish hint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it("renders exactly one Export-PDF, on the header line (not inside the toolbar)", async () => {
    renderPage(makeWeeklyReportData("published"));
    await screen.findByRole("heading", { name: /status report/i });

    const exportButtons = screen.getAllByRole("button", {
      name: /export pdf/i,
    });
    expect(exportButtons).toHaveLength(1);

    // The single Export-PDF lives on the header line, not the bordered toolbar.
    const header = screen
      .getByRole("heading", { name: /status report/i })
      .closest("header");
    if (header === null) {
      throw new Error("expected the report heading to sit inside a <header>");
    }
    expect(
      within(header).getByRole("button", { name: /export pdf/i }),
    ).toBeInTheDocument();
    const toolbar = screen.getByTestId("report-toolbar");
    expect(
      within(toolbar).queryByRole("button", { name: /export pdf/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the publish precondition hint on the status row, NOT the action row", async () => {
    renderPage({
      ...makeWeeklyReportData("open", {
        portfolioOverview: [],
        leadSections: [],
      }),
      submissionCount: 0,
    });
    await screen.findByRole("heading", { name: /status report/i });

    // The spec pins PLACEMENT: the hint shares the status-pill cluster and must
    // NOT sit in the action cluster. Discriminate the two divs explicitly.
    // 1) Same container as the status pill ("Live · X/Y Submitted").
    const statusPill = screen.getByText(/live . 0\/6 submitted/i);
    const statusRow = statusPill.parentElement;
    if (statusRow === null) {
      throw new Error("expected the status pill to have a parent row");
    }
    expect(
      within(statusRow).getByText(
        /publish requires at least one submitted section/i,
      ),
    ).toBeInTheDocument();
    // 2) NOT inside the publish button's action container.
    const publishButton = screen.getByRole("button", {
      name: /nothing to publish/i,
    });
    const actionRow = publishButton.parentElement;
    if (actionRow === null) {
      throw new Error("expected the publish button to have a parent row");
    }
    expect(
      within(actionRow).queryByText(
        /publish requires at least one submitted section/i,
      ),
    ).not.toBeInTheDocument();
  });

  it("hides the publish hint from the viewer (no publish capability)", async () => {
    renderPage(
      {
        ...makeWeeklyReportData("open", {
          portfolioOverview: [],
          leadSections: [],
        }),
        submissionCount: 0,
      },
      undefined,
      "viewer",
    );
    await screen.findByRole("heading", { name: /status report/i });
    expect(
      screen.queryByText(/publish requires at least one submitted section/i),
    ).not.toBeInTheDocument();
  });
});

// A load failure (e.g. a malformed reportId → 400 BAD_REQUEST) must render a
// distinct invalid-link state, NOT the misleading "No active reporting period"
// empty-state.
describe("WeeklyReportPage — load-failure state (driver finding 1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  function makeBadRequestError(): TRPCClientError<never> {
    // Mirrors the live shape: a malformed reportId fails the UUID check and
    // tRPC serializes the Zod issues array into error.message with a
    // BAD_REQUEST / httpStatus 400 data envelope.
    const error = new TRPCClientError<never>("Invalid UUID");
    Object.defineProperty(error, "data", {
      value: { code: "BAD_REQUEST", httpStatus: 400 },
      configurable: true,
    });
    return error;
  }

  function renderFailingPage() {
    const { proxy } = createMockTRPC([
      {
        path: ["weeklyReport", "get"],
        query: () => {
          throw makeBadRequestError();
        },
      },
      { path: ["period", "publish"], mutation: true },
      { path: ["period", "reopen"], mutation: true },
      { path: ["pdfExport", "request"], mutation: true },
      { path: ["pdfExport", "status"], query: null },
      { path: ["archive", "archiveReport"], mutation: true },
      { path: ["archive", "unarchiveReport"], mutation: true },
    ]);

    const qc = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    function Wrapper({ children }: { readonly children: ReactNode }) {
      return (
        <QueryClientProvider client={qc}>
          <SessionContext.Provider
            value={{
              user: {
                id: "head-user-id",
                name: "Test User",
                email: "test.user@example.com",
                role: "head",
              },
              organization: null,
              isLoading: false,
              isAuthenticated: true,
            }}
          >
            <TRPCProxyContext.Provider value={proxy}>
              {children}
            </TRPCProxyContext.Provider>
          </SessionContext.Provider>
        </QueryClientProvider>
      );
    }

    return render(<WeeklyReportPage reportId="not-a-uuid" />, {
      wrapper: Wrapper,
    });
  }

  it("shows an invalid-link state, not the no-period empty-state", async () => {
    renderFailingPage();

    expect(await screen.findByText(/report not found/i)).toBeInTheDocument();
    expect(
      screen.getByText(/this link is invalid or the report no longer exists/i),
    ).toBeInTheDocument();
    // The misleading no-period copy MUST NOT appear on a load failure.
    expect(
      screen.queryByText(/no active reporting period/i),
    ).not.toBeInTheDocument();
  });
});
