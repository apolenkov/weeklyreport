// Wire-up tests: tRPC stub intercepts publish/reopen/get; no MSW handlers.
// Assert mutation variables, cache invalidation, and toast on success.

import type { TrafficLightStatus } from "@customreport/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  invalidateDashboard,
  invalidateLeadForm,
  invalidateLeadHistory,
} from "../../../lib/cache-keys";
import {
  SessionContext,
  type SessionUser,
} from "../../../lib/session-provider";
import { AgentReviewComingSoon } from "../../../shared/ui/report-shell/agent-review-coming-soon";
import { expectDefined } from "../../../test-utils/expect-defined.js";
import { createMockTRPC } from "../../../test-utils/mock-trpc";
import { WeeklyReportPage } from "./weekly-report-page";

const REPORT_ID = "11111111-1111-4111-8111-111111111111";
const AUTHOR_ID_A = "11111111-1111-4111-8111-aaaaaaaaaaaa";
const PRODUCT_ID_A = "11111111-1111-4111-8111-cccccccccccc";
const PRODUCT_ID_B = "11111111-1111-4111-8111-dddddddddddd";

function makeWeeklyReportData(
  periodStatus: "open" | "published" | "reopened",
  overrides?: {
    readonly portfolioOverview?: {
      readonly productId: string;
      readonly productName: string;
      readonly worstStatus: TrafficLightStatus | "empty";
      readonly stageCount: number;
      readonly leadNames: string[];
    }[];
    readonly leadSections?: {
      readonly reportSectionId: string;
      readonly reportId: string;
      readonly authorId: string;
      readonly authorName: string;
      readonly status: "submitted" | "draft" | "locked";
      readonly submittedAt: Date | null;
      readonly projects: { projectId: string; projectName: string }[];
      readonly items: {
        readonly id: string;
        readonly projectId: string;
        readonly type: "current" | "next";
        readonly text: string;
        readonly tag: string;
        readonly workflowStatus:
          "in_progress" | "done" | "blocked" | "canceled" | "not_started";
        readonly carriedOver: boolean;
        readonly completed: boolean;
      }[];
      readonly risks: never[];
      readonly decisions: never[];
      readonly priorities: never[];
      readonly activities?: {
        readonly activityId: string;
        readonly activityName: string;
        readonly status: TrafficLightStatus | null;
        readonly note?: string | null;
      }[];
    }[];
  },
) {
  return {
    reportId: REPORT_ID,
    periodStart: new Date("2026-04-14T00:00:00Z"),
    periodEnd: new Date("2026-04-20T00:00:00Z"),
    periodStatus,
    archived: false,
    weekLabel: "Week 16",
    submissionCount: 4,
    totalLeads: 6,
    portfolioOverview: overrides?.portfolioOverview ?? [
      {
        productId: PRODUCT_ID_A,
        productName: "Product Alpha",
        worstStatus: "green",
        stageCount: 1,
        leadNames: ["Alice"],
      },
    ],
    leadSections: overrides?.leadSections ?? [
      {
        reportSectionId: "22222222-2222-4222-8222-aaaaaaaaaaa1",
        reportId: REPORT_ID,
        authorId: AUTHOR_ID_A,
        authorName: "Alice",
        status: "submitted",
        submittedAt: new Date("2026-04-14T09:00:00Z"),
        projects: [
          {
            projectId: PRODUCT_ID_A,
            projectName: "Product Alpha",
          },
        ],
        items: [
          {
            id: "33333333-3333-4333-8333-aaaaaaaaaa01",
            projectId: PRODUCT_ID_A,
            type: "current",
            text: "Done task A",
            tag: "Dev",
            workflowStatus: "done",
            carriedOver: false,
            completed: true,
          },
        ],
        risks: [],
        decisions: [],
        priorities: [],
      },
    ],
    escalations: [],
  };
}

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

describe("WeeklyReportPage — Publish & Lock / Reopen wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it("clicking Publish & Lock fires period.publish with reportId from view.period", async () => {
    const { captured } = renderPage(makeWeeklyReportData("open"));
    expectDefined(captured["period.publish"]).mutationFn.mockResolvedValue(
      undefined,
    );

    await screen.findByRole("button", { name: /publish & lock/i });

    await userEvent.click(
      screen.getByRole("button", { name: /publish & lock/i }),
    );

    const dialog = await screen.findByRole("alertdialog", {
      name: /publish & lock report/i,
    });
    const buttons = dialog.querySelectorAll("button");
    await userEvent.click(expectDefined(buttons[buttons.length - 1]));

    const publishMutation = expectDefined(captured["period.publish"]);
    await waitFor(() => {
      expect(publishMutation.mutationFn).toHaveBeenCalledTimes(1);
    });
    // TanStack Query invokes mutationFn(variables, context); assert the first arg only.
    expect(publishMutation.mutationFn.mock.calls[0]?.[0]).toEqual({
      reportId: REPORT_ID,
    });
  });

  it("groups products under each lead when scope is 'lead' (head split-view parity)", async () => {
    renderPage(makeWeeklyReportData("open"), undefined, "head", "lead");
    // "By lead" renders the author's name as a group heading (h3) instead of a
    // flat product accordion list.
    expect(
      await screen.findByRole("heading", { name: "Alice", level: 3 }),
    ).toBeInTheDocument();
    // The overview band follows scope: the per-lead "Leads Overview" summary,
    // not the product band.
    expect(screen.getByText("Leads Overview")).toBeInTheDocument();
    expect(screen.queryByText("Portfolio Overview")).not.toBeInTheDocument();
  });

  it("viewer inherits the by-lead overview from the shared page (report-overview-scope-parity 4.2)", async () => {
    // The viewer renders the SAME WeeklyReportPage as the head, so making the
    // overview scope-aware applies to the viewer with no viewer-specific code.
    // In by-lead scope the viewer's overview groups by lead, matching the head.
    renderPage(makeWeeklyReportData("open"), undefined, "viewer", "lead");
    expect(
      await screen.findByRole("heading", { name: "Alice", level: 3 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Leads Overview")).toBeInTheDocument();
    // The lead section carries the scroll/focus anchor the overview card targets.
    expect(
      document.getElementById(`report-lead-${AUTHOR_ID_A}`),
    ).not.toBeNull();
  });

  it("disables publish and hides Toggle All for an empty weekly report", async () => {
    const { captured } = renderPage({
      ...makeWeeklyReportData("open", {
        portfolioOverview: [],
        leadSections: [],
      }),
      submissionCount: 0,
    });

    const publishButton = await screen.findByRole("button", {
      name: /nothing to publish/i,
    });
    expect(publishButton).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: /toggle all/i }),
    ).not.toBeInTheDocument();
    await userEvent.click(publishButton);
    expect(
      screen.queryByRole("dialog", { name: /confirm publish/i }),
    ).not.toBeInTheDocument();
    expect(
      expectDefined(captured["period.publish"]).mutationFn,
    ).not.toHaveBeenCalled();
  });

  it("shows empty-state with archive link when the report has no content and the period is open", async () => {
    renderPage({
      ...makeWeeklyReportData("open", {
        portfolioOverview: [],
        leadSections: [],
      }),
      submissionCount: 0,
    });

    const emptyState = await screen.findByTestId("empty-submissions-state");
    expect(emptyState).toBeInTheDocument();

    // Message must mention the period week label.
    expect(emptyState).toHaveTextContent(/no submissions yet for week 16/i);

    // Archive link must point to the published tab.
    const archiveLink = screen.getByRole("link", {
      name: /view archived reports in archive/i,
    });
    expect(archiveLink).toHaveAttribute("href", "/reports?tab=published");

    // Portfolio table and accordion must NOT be rendered.
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows normal report (no empty-state) when submissionCount === 0 but period is published", async () => {
    // published + 0 submissions: edge case (head published empty period).
    // Empty-state must NOT appear — show the normal layout instead.
    renderPage({
      ...makeWeeklyReportData("published", {
        portfolioOverview: [],
        leadSections: [],
      }),
      submissionCount: 0,
    });

    await screen.findByRole("button", { name: /reopen period/i });

    expect(
      screen.queryByTestId("empty-submissions-state"),
    ).not.toBeInTheDocument();
  });

  it("head-report-visibility: draft content is hidden by the submitted-only default, revealed via Show all — never the empty-state", async () => {
    // Default submitted-only + anti-empty-state: with 0 submissions but live
    // draft content, "N in draft — Show all" stands in for a false empty-state.
    renderPage(
      {
        ...makeWeeklyReportData("open", {
          portfolioOverview: [
            {
              productId: PRODUCT_ID_A,
              productName: "Product Alpha",
              worstStatus: "green",
              stageCount: 1,
              leadNames: ["Alice"],
            },
          ],
          leadSections: [
            {
              reportSectionId: "22222222-2222-4222-8222-aaaaaaaaaaa1",
              reportId: REPORT_ID,
              authorId: AUTHOR_ID_A,
              authorName: "Alice",
              status: "draft",
              submittedAt: null,
              projects: [
                { projectId: PRODUCT_ID_A, projectName: "Product Alpha" },
              ],
              items: [
                {
                  id: "33333333-3333-4333-8333-aaaaaaaaaa01",
                  projectId: PRODUCT_ID_A,
                  type: "current",
                  text: "Draft task in progress",
                  tag: "Dev",
                  workflowStatus: "in_progress",
                  carriedOver: false,
                  completed: false,
                },
              ],
              risks: [],
              decisions: [],
              priorities: [],
            },
          ],
        }),
        submissionCount: 0,
      },
      AUTHOR_ID_A,
    );

    await screen.findByRole("heading", { name: /status report/i });

    // Submitted-only default: the draft row is hidden, and the anti-empty-state
    // signal (not the "No submissions yet" empty-state) explains why.
    expect(
      screen.queryByText("Draft task in progress"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("draft-hidden-signal")).toBeInTheDocument();
    expect(
      screen.queryByTestId("empty-submissions-state"),
    ).not.toBeInTheDocument();

    // Flipping to All (via the signal's Show all) reveals the draft content —
    // the head-report-visibility invariant holds when showing all.
    await userEvent.click(screen.getByRole("button", { name: /show all/i }));
    expect(
      await screen.findByText("Draft task in progress"),
    ).toBeInTheDocument();

    // Publish stays gated on submission, not on content presence.
    expect(
      screen.getByRole("button", { name: /nothing to publish/i }),
    ).toBeInTheDocument();
  });

  it("viewer can read a published report without period mutation actions", async () => {
    const published = makeWeeklyReportData("published");

    renderPage(published, undefined, "viewer");

    // Anchor on the always-present report heading.
    await screen.findByRole("heading", { name: /status report/i });

    // Export PDF is requester-scoped, so a viewer gets a non-empty PDF of their
    // own published slice. Period-mutation actions stay head/admin-only.
    expect(
      screen.getByRole("button", { name: /export pdf/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^archive$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /reopen period/i }),
    ).not.toBeInTheDocument();
  });

  it("on publish success: all dependent caches invalidate and a success toast appears", async () => {
    const { captured } = renderPage(makeWeeklyReportData("open"));
    expectDefined(captured["period.publish"]).mutationFn.mockResolvedValue(
      undefined,
    );

    await userEvent.click(
      await screen.findByRole("button", { name: /publish & lock/i }),
    );
    const dialog = await screen.findByRole("alertdialog", {
      name: /publish & lock report/i,
    });
    const buttons = dialog.querySelectorAll("button");
    await userEvent.click(expectDefined(buttons[buttons.length - 1]));

    await waitFor(() => {
      expect(invalidateDashboard).toHaveBeenCalled();
      expect(invalidateLeadForm).toHaveBeenCalled();
      expect(invalidateLeadHistory).toHaveBeenCalled();
      expect(toastSuccess).toHaveBeenCalled();
    });
  });

  it("on publish error: a toast.error is shown", async () => {
    const { captured } = renderPage(makeWeeklyReportData("open"));
    expectDefined(captured["period.publish"]).mutationFn.mockRejectedValue(
      new Error("Forbidden"),
    );

    await userEvent.click(
      await screen.findByRole("button", { name: /publish & lock/i }),
    );
    const dialog = await screen.findByRole("alertdialog", {
      name: /publish & lock report/i,
    });
    const buttons = dialog.querySelectorAll("button");
    await userEvent.click(expectDefined(buttons[buttons.length - 1]));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Forbidden");
    });
    expect(invalidateLeadForm).not.toHaveBeenCalled();
  });

  it("clicking Reopen Period (via confirm dialog) fires period.reopen with reportId when periodStatus is published", async () => {
    const { captured } = renderPage(makeWeeklyReportData("published"));
    expectDefined(captured["period.reopen"]).mutationFn.mockResolvedValue(
      undefined,
    );

    // Reopen is destructive, so it goes through ConfirmDeleteDialog.
    const reopenBtn = await screen.findByRole("button", {
      name: /reopen period/i,
    });
    await userEvent.click(reopenBtn);

    // Confirm dialog renders with a "Reopen" button (label set via confirmLabel="Reopen").
    const confirmBtn = await screen.findByRole("button", { name: /^reopen$/i });
    await userEvent.click(confirmBtn);

    const reopenMutation = expectDefined(captured["period.reopen"]);
    await waitFor(() => {
      expect(reopenMutation.mutationFn).toHaveBeenCalledTimes(1);
    });
    expect(reopenMutation.mutationFn.mock.calls[0]?.[0]).toEqual({
      reportId: REPORT_ID,
    });
  });

  it("on reopen success: invalidateDashboard + invalidateLeadForm + invalidateLeadHistory fire", async () => {
    const { captured } = renderPage(makeWeeklyReportData("published"));
    expectDefined(captured["period.reopen"]).mutationFn.mockResolvedValue(
      undefined,
    );

    await userEvent.click(
      await screen.findByRole("button", { name: /reopen period/i }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: /^reopen$/i }),
    );

    await waitFor(() => {
      expect(invalidateDashboard).toHaveBeenCalled();
      expect(invalidateLeadForm).toHaveBeenCalled();
      expect(invalidateLeadHistory).toHaveBeenCalled();
      expect(toastSuccess).toHaveBeenCalled();
    });
  });

  it("highlights only one authored section when authorId maps to multiple products", async () => {
    const data = makeWeeklyReportData("published", {
      portfolioOverview: [
        {
          productId: PRODUCT_ID_A,
          productName: "Product Alpha",
          worstStatus: "green",
          stageCount: 2,
          leadNames: ["Alice"],
        },
        {
          productId: PRODUCT_ID_B,
          productName: "Product Beta",
          worstStatus: "yellow",
          stageCount: 1,
          leadNames: ["Alice"],
        },
      ],
      leadSections: [
        {
          reportSectionId: "22222222-2222-4222-8222-aaaaaaaaaaa1",
          reportId: REPORT_ID,
          authorId: AUTHOR_ID_A,
          authorName: "Alice",
          status: "submitted",
          submittedAt: new Date("2026-04-14T09:00:00Z"),
          projects: [
            {
              projectId: PRODUCT_ID_A,
              projectName: "Product Alpha",
            },
          ],
          items: [
            {
              id: "33333333-3333-4333-8333-aaaaaaaaaa01",
              projectId: PRODUCT_ID_A,
              type: "current",
              text: "Done task A",
              tag: "Dev",
              workflowStatus: "done",
              carriedOver: false,
              completed: true,
            },
          ],
          risks: [],
          decisions: [],
          priorities: [],
        },
        {
          reportSectionId: "44444444-4444-4444-8444-bbbbbbbbbbb1",
          reportId: REPORT_ID,
          authorId: AUTHOR_ID_A,
          authorName: "Alice",
          status: "submitted",
          submittedAt: new Date("2026-04-14T10:00:00Z"),
          projects: [
            {
              projectId: PRODUCT_ID_B,
              projectName: "Product Beta",
            },
          ],
          items: [
            {
              id: "55555555-5555-4555-8555-bbbbbbbbbbb1",
              projectId: PRODUCT_ID_B,
              type: "current",
              text: "Done task B",
              tag: "Dev",
              workflowStatus: "in_progress",
              carriedOver: false,
              completed: false,
            },
          ],
          risks: [],
          decisions: [],
          priorities: [],
        },
      ],
    });

    renderPage(data, AUTHOR_ID_A);

    await waitFor(() => {
      const alphaSection = expectDefined(
        document.getElementById(`report-product-${PRODUCT_ID_A}`),
      );
      const betaSection = expectDefined(
        document.getElementById(`report-product-${PRODUCT_ID_B}`),
      );

      const alphaAccordion = expectDefined(
        alphaSection.querySelector("button[aria-expanded]"),
      );
      const betaAccordion = expectDefined(
        betaSection.querySelector("button[aria-expanded]"),
      );

      expect(alphaAccordion).toHaveAttribute("aria-expanded", "true");
      expect(betaAccordion).toHaveAttribute("aria-expanded", "false");
    });
  });
});

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

// Submitted|All filters the rendered accordion only; header/portfolio/nav stay
// on full truth. Default submitted-only for access-holders on a live period.
const AUTHOR_ID_B = "11111111-1111-4111-8111-bbbbbbbbbbbb";

function submittedSection() {
  return {
    reportSectionId: "22222222-2222-4222-8222-aaaaaaaaaaa1",
    reportId: REPORT_ID,
    authorId: AUTHOR_ID_A,
    authorName: "Alice",
    status: "submitted" as const,
    submittedAt: new Date("2026-04-14T09:00:00Z"),
    projects: [{ projectId: PRODUCT_ID_A, projectName: "Product Alpha" }],
    items: [
      {
        id: "33333333-3333-4333-8333-aaaaaaaaaa01",
        projectId: PRODUCT_ID_A,
        type: "current" as const,
        text: "Alice submitted work",
        tag: "Dev",
        workflowStatus: "done" as const,
        carriedOver: false,
        completed: true,
      },
    ],
    risks: [] as never[],
    decisions: [] as never[],
    priorities: [] as never[],
  };
}

function draftSection() {
  return {
    reportSectionId: "44444444-4444-4444-8444-bbbbbbbbbbb1",
    reportId: REPORT_ID,
    authorId: AUTHOR_ID_B,
    authorName: "Bob",
    status: "draft" as const,
    submittedAt: null,
    projects: [{ projectId: PRODUCT_ID_B, projectName: "Product Beta" }],
    items: [
      {
        id: "55555555-5555-4555-8555-bbbbbbbbbbb1",
        projectId: PRODUCT_ID_B,
        type: "current" as const,
        text: "Bob draft work",
        tag: "Dev",
        workflowStatus: "in_progress" as const,
        carriedOver: false,
        completed: false,
      },
    ],
    risks: [] as never[],
    decisions: [] as never[],
    priorities: [] as never[],
  };
}

const TWO_PRODUCT_OVERVIEW = [
  {
    productId: PRODUCT_ID_A,
    productName: "Product Alpha",
    worstStatus: "green" as const,
    stageCount: 1,
    leadNames: ["Alice"],
  },
  {
    productId: PRODUCT_ID_B,
    productName: "Product Beta",
    worstStatus: "yellow" as const,
    stageCount: 1,
    leadNames: ["Bob"],
  },
];

describe("WeeklyReportPage — Submitted/All filter + anti-empty-state (§7)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  function accordionCard(productId: string): HTMLElement | null {
    return document.getElementById(`report-product-${productId}`);
  }

  it("defaults to submitted-only: a draft-only product is hidden until Show all reveals it", async () => {
    renderPage(
      makeWeeklyReportData("open", {
        portfolioOverview: TWO_PRODUCT_OVERVIEW,
        leadSections: [submittedSection(), draftSection()],
      }),
    );

    await screen.findByRole("heading", { name: /status report/i });

    // Submitted product's accordion renders; the draft-only one does not.
    expect(accordionCard(PRODUCT_ID_A)).not.toBeNull();
    expect(accordionCard(PRODUCT_ID_B)).toBeNull();

    // TRUTH invariant: the filter narrows the ACCORDION only. The header
    // submission count and the portfolio overview band keep reporting all
    // sections — the hidden draft product still shows as an overview card
    // (a button; its accordion counterpart above is asserted null).
    expect(screen.getByText(/4\/6 Submitted/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Product Beta/ }),
    ).toBeInTheDocument();

    // The filter toggle is present (live period, head) and the draft-hidden
    // signal names the one hidden section.
    const toggle = screen.getByRole("group", { name: "Section filter" });
    expect(toggle).toBeInTheDocument();
    expect(screen.getByTestId("draft-hidden-signal")).toHaveTextContent(
      /1 section in draft/i,
    );

    // Flip to All → the draft product's accordion appears.
    await userEvent.click(within(toggle).getByRole("button", { name: "All" }));
    await waitFor(() => {
      expect(accordionCard(PRODUCT_ID_B)).not.toBeNull();
    });
  });

  it("all-draft live period shows the 'N in draft — Show all' signal, not the empty-state", async () => {
    renderPage({
      ...makeWeeklyReportData("open", {
        portfolioOverview: [expectDefined(TWO_PRODUCT_OVERVIEW[1])],
        leadSections: [draftSection()],
      }),
      submissionCount: 0,
    });

    await screen.findByRole("heading", { name: /status report/i });

    // The accordion is empty under submitted-only, but the period is NOT
    // content-less — so the signal shows, never the misleading empty-state.
    expect(screen.getByTestId("draft-hidden-signal")).toBeInTheDocument();
    expect(
      screen.queryByTestId("empty-submissions-state"),
    ).not.toBeInTheDocument();
    expect(accordionCard(PRODUCT_ID_B)).toBeNull();

    // Show all reveals the draft accordion.
    await userEvent.click(screen.getByRole("button", { name: /show all/i }));
    await waitFor(() => {
      expect(accordionCard(PRODUCT_ID_B)).not.toBeNull();
    });
  });

  it("an activity-only draft section (no draft product content) still surfaces the 'N in draft — Show all' signal", async () => {
    // draftCount must count activity content, not only product groupings —
    // otherwise an activity-only draft is invisible to the recovery signal.
    renderPage({
      ...makeWeeklyReportData("open", {
        portfolioOverview: [],
        leadSections: [
          {
            reportSectionId: "77777777-7777-4777-8777-777777777771",
            reportId: REPORT_ID,
            authorId: AUTHOR_ID_B,
            authorName: "Bob",
            status: "draft",
            submittedAt: null,
            projects: [],
            items: [],
            risks: [],
            decisions: [],
            priorities: [],
            activities: [
              {
                activityId: "88888888-8888-4888-8888-888888888881",
                activityName: "Jira triage duty",
                status: "red",
                note: "Draft-only activity note",
              },
            ],
          },
        ],
      }),
      submissionCount: 0,
    });

    await screen.findByRole("heading", { name: /status report/i });

    // The signal surfaces (not the misleading empty-state), and clicking
    // "Show all" reveals the activity-only draft section.
    expect(screen.getByTestId("draft-hidden-signal")).toBeInTheDocument();
    expect(
      screen.queryByTestId("empty-submissions-state"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("activity-status-strip"),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /show all/i }));
    expect(
      await screen.findByTestId("activity-status-strip"),
    ).toBeInTheDocument();
    expect(screen.getByText("Draft-only activity note")).toBeInTheDocument();
  });

  it("a genuinely content-less period shows the true empty-state and no filter", async () => {
    renderPage({
      ...makeWeeklyReportData("open", {
        portfolioOverview: [],
        leadSections: [],
      }),
      submissionCount: 0,
    });

    expect(
      await screen.findByTestId("empty-submissions-state"),
    ).toBeInTheDocument();
    // No draft is hidden and the toggle lives in the (unrendered) body branch.
    expect(screen.queryByTestId("draft-hidden-signal")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: "Section filter" }),
    ).not.toBeInTheDocument();
  });

  it("published snapshot renders unfiltered with no filter toggle", async () => {
    renderPage(
      makeWeeklyReportData("published", {
        portfolioOverview: TWO_PRODUCT_OVERVIEW,
        leadSections: [submittedSection(), draftSection()],
      }),
      undefined,
      "head",
    );

    await screen.findByRole("heading", { name: /status report/i });

    // Published is never filtered: BOTH products' accordions render and the
    // toggle is absent.
    expect(accordionCard(PRODUCT_ID_A)).not.toBeNull();
    expect(accordionCard(PRODUCT_ID_B)).not.toBeNull();
    expect(
      screen.queryByRole("group", { name: "Section filter" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("draft-hidden-signal")).not.toBeInTheDocument();
  });

  it("hides a draft section's activity statuses under submitted-only, reveals them via Show all", async () => {
    renderPage(
      makeWeeklyReportData("open", {
        portfolioOverview: TWO_PRODUCT_OVERVIEW,
        leadSections: [
          submittedSection(),
          {
            ...draftSection(),
            activities: [
              {
                activityId: "66666666-6666-4666-8666-666666666666",
                activityName: "Jira triage duty",
                status: "red" as const,
                note: "Draft-only vendor note",
              },
            ],
          },
        ],
      }),
    );

    await screen.findByRole("heading", { name: /status report/i });

    // Only the draft carries activities, so under the submitted-only default
    // the strip self-suppresses — no draft status or note leaks.
    expect(
      screen.queryByTestId("activity-status-strip"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Draft-only vendor note"),
    ).not.toBeInTheDocument();

    // Show all reveals the draft author's activity row.
    const toggle = screen.getByRole("group", { name: "Section filter" });
    await userEvent.click(within(toggle).getByRole("button", { name: "All" }));
    expect(
      await screen.findByTestId("activity-status-strip"),
    ).toBeInTheDocument();
    expect(screen.getByText("Jira triage duty")).toBeInTheDocument();
    expect(screen.getByText("Draft-only vendor note")).toBeInTheDocument();
  });

  it("activity-first-class: an all-activity submitted period renders (no empty-state) and can publish", async () => {
    // A submitted section whose ONLY content is a touched activity must still
    // be publishable — hasAnyContent folds in activity content, not just
    // product content.
    renderPage({
      ...makeWeeklyReportData("open", {
        portfolioOverview: [],
        leadSections: [
          {
            reportSectionId: "22222222-2222-4222-8222-aaaaaaaaaaa1",
            reportId: REPORT_ID,
            authorId: AUTHOR_ID_A,
            authorName: "Alice",
            status: "submitted",
            submittedAt: new Date("2026-04-14T09:00:00Z"),
            projects: [],
            items: [],
            risks: [],
            decisions: [],
            priorities: [],
            activities: [
              {
                activityId: "66666666-6666-4666-8666-666666666666",
                activityName: "Jira triage duty",
                status: "green",
                note: "Handled 20 tickets",
              },
            ],
          },
        ],
      }),
      submissionCount: 1,
    });

    await screen.findByRole("heading", { name: /status report/i });

    // The truly-empty-period empty-state must NOT show — there is real content.
    expect(
      screen.queryByTestId("empty-submissions-state"),
    ).not.toBeInTheDocument();

    // The submitted activity renders under the default submitted-only view.
    expect(
      await screen.findByTestId("activity-status-strip"),
    ).toBeInTheDocument();
    expect(screen.getByText("Jira triage duty")).toBeInTheDocument();

    // Publish is unblocked: submitted > 0 AND hasAnyContent (activity content).
    const publish = screen.getByRole("button", { name: /publish & lock/i });
    expect(publish).not.toBeDisabled();
  });

  it("activity-first-class: a seeded-but-untouched green activity does NOT defeat the empty-state", async () => {
    // Guards the touched-vs-seeded distinction: seedActivityStatuses defaults an
    // attached activity to status "green" (never null) on section create, so a
    // lead who only logged in — green activity, no note, no records, no product
    // content — is still an empty period. It must read "No submissions yet", not
    // render a scaffold of seeded-green activity cards.
    renderPage({
      ...makeWeeklyReportData("open", {
        portfolioOverview: [],
        leadSections: [
          {
            reportSectionId: "22222222-2222-4222-8222-aaaaaaaaaaa1",
            reportId: REPORT_ID,
            authorId: AUTHOR_ID_A,
            authorName: "Alice",
            status: "draft",
            submittedAt: null,
            projects: [],
            items: [],
            risks: [],
            decisions: [],
            priorities: [],
            activities: [
              {
                activityId: "66666666-6666-4666-8666-666666666666",
                activityName: "Jira triage duty",
                status: "green",
                note: null,
              },
            ],
          },
        ],
      }),
      submissionCount: 0,
    });

    expect(
      await screen.findByTestId("empty-submissions-state"),
    ).toBeInTheDocument();
  });

  it("does not offer the filter to a lead on a live period", async () => {
    renderPage(
      makeWeeklyReportData("open", {
        portfolioOverview: TWO_PRODUCT_OVERVIEW,
        leadSections: [submittedSection(), draftSection()],
      }),
      undefined,
      "lead",
    );

    await screen.findByRole("heading", { name: /status report/i });
    expect(
      screen.queryByRole("group", { name: "Section filter" }),
    ).not.toBeInTheDocument();
    // A lead sees content unfiltered (no submitted-only narrowing).
    expect(accordionCard(PRODUCT_ID_B)).not.toBeNull();
  });
});

const REVIEW_COMMENT_TEXT = "Please double-check the milestone date";

// A live open period whose section the caller may review, mirroring the
// server-stamped `canReview` a head/designated reviewer receives. The reviewer
// comment makes the read-only vs review-mode split observable.
function makeReviewableData(): ReturnType<typeof makeWeeklyReportData> {
  const base = makeWeeklyReportData("open");
  return {
    ...base,
    leadSections: base.leadSections.map((section) => ({
      ...section,
      version: 1,
      reviews: [],
      canReview: true,
      // No group id keeps the per-group Acknowledge bar inert; the review-mode
      // split under test is independent of acknowledgement.
      groupId: null,
      items: section.items.map((item) => ({
        ...item,
        comments: [
          {
            id: "44444444-4444-4444-8444-aaaaaaaaaa01",
            reviewerId: "head-user-id",
            reviewerName: "Test User",
            text: REVIEW_COMMENT_TEXT,
            createdAt: new Date("2026-04-15T10:00:00Z"),
          },
        ],
      })),
    })),
  };
}

describe("WeeklyReportPage — review-mode split (report-review-mode)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it("defaults to read mode: the toggle shows for a reviewer but affordances stay hidden", async () => {
    renderPage(makeReviewableData(), undefined, "head");

    expect(
      await screen.findByRole("button", { name: "Review" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Read" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // Read mode renders read-only content — no verdict control, no composer, no
    // reviewer comments.
    expect(
      screen.queryByRole("button", { name: "Approve" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Add a review comment"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(REVIEW_COMMENT_TEXT)).not.toBeInTheDocument();
    // The roll-up strip renders on the dashboard, not inside the report body.
    expect(
      screen.queryByRole("region", { name: "Section reviews" }),
    ).not.toBeInTheDocument();
  });

  it("mounts the verdict control and comment composer once switched to review mode", async () => {
    renderPage(makeReviewableData(), undefined, "head");

    await userEvent.click(
      await screen.findByRole("button", { name: "Review" }),
    );

    expect(
      await screen.findByRole("button", { name: "Approve" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Add a review comment")).toBeInTheDocument();
    expect(screen.getByText(REVIEW_COMMENT_TEXT)).toBeInTheDocument();
    // The in-body verdict band is the designated viewer-reviewer's verdict home.
    expect(
      screen.getByRole("region", { name: "Section reviews" }),
    ).toBeInTheDocument();
  });

  it("gives a designated viewer-reviewer the in-body verdict home (not stranded by the head-only strip)", async () => {
    renderPage(makeReviewableData(), undefined, "viewer");

    await userEvent.click(
      await screen.findByRole("button", { name: "Review" }),
    );

    expect(
      await screen.findByRole("button", { name: "Approve" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Section reviews" }),
    ).toBeInTheDocument();
  });

  it("offers no review-mode toggle to a lead", async () => {
    renderPage(makeReviewableData(), undefined, "lead");

    await screen.findByRole("heading", { name: "Status Report" });
    expect(
      screen.queryByRole("button", { name: "Review" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Read" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the Agent-review placeholder rendered in both read and review mode", async () => {
    renderPage(
      makeReviewableData(),
      undefined,
      "head",
      undefined,
      undefined,
      undefined,
      <AgentReviewComingSoon />,
    );

    expect(
      await screen.findByTestId("agent-review-coming-soon"),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Review" }));

    expect(screen.getByTestId("agent-review-coming-soon")).toBeInTheDocument();
  });
});

// makeReviewableData with a real group id, so the Acknowledge control mounts.
function makeAcknowledgeableData(): ReturnType<typeof makeWeeklyReportData> {
  const base = makeReviewableData();
  return {
    ...base,
    leadSections: base.leadSections.map((section) => ({
      ...section,
      groupId: "99999999-9999-4999-8999-999999999901",
    })),
  };
}

describe("WeeklyReportPage — acknowledge placement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it("head: Acknowledge sits in the publish cluster on the header, not as a body band", async () => {
    renderPage(makeAcknowledgeableData(), undefined, "head");

    const cluster = await screen.findByTestId("acknowledge-header");
    expect(
      within(cluster).getByRole("button", { name: /acknowledge/i }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("acknowledge-body")).not.toBeInTheDocument();
    // Acknowledgement never gates publish: the lifecycle button still renders
    // alongside, un-acknowledged.
    expect(
      screen.getByRole("button", { name: /publish/i }),
    ).toBeInTheDocument();
  });

  it("viewer: Acknowledge stays a body band (no publish cluster to host it)", async () => {
    renderPage(makeAcknowledgeableData(), undefined, "viewer");

    const band = await screen.findByTestId("acknowledge-body");
    expect(
      within(band).getByRole("button", { name: /acknowledge/i }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("acknowledge-header")).not.toBeInTheDocument();
  });
});

describe("WeeklyReportPage — Archive / Restore wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  const ARCHIVE_BUTTON = /move this report to the archive/i;
  const RESTORE_BUTTON = /restore this report from the archive/i;

  it("offers Archive, not Restore, on a published report still out of the archive", async () => {
    renderPage(makeWeeklyReportData("published"));

    expect(
      await screen.findByRole("button", { name: ARCHIVE_BUTTON }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: RESTORE_BUTTON }),
    ).not.toBeInTheDocument();
  });

  it("offers neither control while the period is still open", async () => {
    renderPage(makeWeeklyReportData("open"));

    await screen.findByRole("button", { name: /publish & lock/i });
    expect(
      screen.queryByRole("button", { name: ARCHIVE_BUTTON }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: RESTORE_BUTTON }),
    ).not.toBeInTheDocument();
  });

  it("swaps Archive for Restore once the report is archived", async () => {
    renderPage({ ...makeWeeklyReportData("published"), archived: true });

    expect(
      await screen.findByRole("button", { name: RESTORE_BUTTON }),
    ).toBeInTheDocument();
    // Archiving leaves periodStatus published, so the Archive button would
    // still match its old gate — offering it again could only fail.
    expect(
      screen.queryByRole("button", { name: ARCHIVE_BUTTON }),
    ).not.toBeInTheDocument();
  });

  it("clicking Restore fires archive.unarchiveReport with the report id", async () => {
    const { captured } = renderPage({
      ...makeWeeklyReportData("published"),
      archived: true,
    });
    expectDefined(
      captured["archive.unarchiveReport"],
    ).mutationFn.mockResolvedValue({ success: true });

    await userEvent.click(
      await screen.findByRole("button", { name: RESTORE_BUTTON }),
    );

    const restoreMutation = expectDefined(captured["archive.unarchiveReport"]);
    await waitFor(() => {
      expect(restoreMutation.mutationFn).toHaveBeenCalledTimes(1);
    });
    expect(restoreMutation.mutationFn.mock.calls[0]?.[0]).toEqual({
      reportId: REPORT_ID,
    });
  });

  it("restore busts the same caches archive does and confirms with a toast", async () => {
    const { captured } = renderPage({
      ...makeWeeklyReportData("published"),
      archived: true,
    });
    expectDefined(
      captured["archive.unarchiveReport"],
    ).mutationFn.mockResolvedValue({ success: true });

    await userEvent.click(
      await screen.findByRole("button", { name: RESTORE_BUTTON }),
    );

    await waitFor(() => {
      expect(invalidateDashboard).toHaveBeenCalledTimes(1);
    });
    expect(toastSuccess).toHaveBeenCalledWith("Report restored");
    // Restore only moves the report between lists; it changes no section data.
    expect(invalidateLeadForm).not.toHaveBeenCalled();
    expect(invalidateLeadHistory).not.toHaveBeenCalled();
  });

  it("surfaces a failed restore as an error toast", async () => {
    const { captured } = renderPage({
      ...makeWeeklyReportData("published"),
      archived: true,
    });
    expectDefined(
      captured["archive.unarchiveReport"],
    ).mutationFn.mockRejectedValue(new TRPCClientError("Report not found"));

    await userEvent.click(
      await screen.findByRole("button", { name: RESTORE_BUTTON }),
    );

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Report not found");
    });
    expect(invalidateDashboard).not.toHaveBeenCalled();
  });
});
