// Wire-up tests: tRPC stub intercepts publish/reopen/get; no MSW handlers.
// Assert mutation variables, cache invalidation, and toast on success.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
import { expectDefined } from "../../../test-utils/expect-defined.js";
import { createMockTRPC } from "../../../test-utils/mock-trpc";
import {
  AUTHOR_ID_A,
  makeWeeklyReportData,
  PRODUCT_ID_A,
  PRODUCT_ID_B,
  REPORT_ID,
} from "./__tests__/weekly-report-page-harness";
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
