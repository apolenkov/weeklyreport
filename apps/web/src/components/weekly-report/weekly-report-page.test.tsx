/**
 * Weekly Report page — Phase 22 (plan 22-05) wiring tests.
 *
 * Strategy: mock the tRPC proxy as a stub so we can intercept
 * `period.publish.mutationOptions` / `period.reopen.mutationOptions` and the
 * `weeklyReport.get.queryOptions`. We DO NOT extend MSW handlers — these
 * mutations are only exercised at the wire-up level here.
 *
 * The structural goal: when the head clicks the publish button, the parent's
 * mutation fires with `{ reportId }`; on success, cache invalidation helpers
 * fire and a toast confirms.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../lib/trpc-context";

// We mock cache-keys to verify invalidation cascade without actually inspecting
// react-query internals.
vi.mock("../../lib/cache-keys", () => ({
  invalidateDashboard: vi.fn(),
  invalidateLeadForm: vi.fn(),
  invalidateLeadHistory: vi.fn(),
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

// Mock Next.js navigation hooks consumed by HeadPeriodNavigator. We don't drive
// route changes in these tests — just neutralize the hook calls.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/head/report",
}));

import {
  invalidateDashboard,
  invalidateLeadForm,
  invalidateLeadHistory,
} from "../../lib/cache-keys";
import { SessionContext, type SessionUser } from "../../lib/session-provider";
import { expectDefined } from "../../test-utils/expect-defined.js";
import { createMockTRPC } from "../../test-utils/mock-trpc";
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
      readonly worstStatus: "green" | "yellow" | "red" | "empty";
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
          | "in_progress"
          | "done"
          | "blocked"
          | "canceled"
          | "not_started";
        readonly carriedOver: boolean;
        readonly completed: boolean;
      }[];
      readonly risks: never[];
      readonly decisions: never[];
      readonly priorities: never[];
    }[];
  },
) {
  return {
    reportId: REPORT_ID,
    periodStart: new Date("2026-04-14T00:00:00Z"),
    periodEnd: new Date("2026-04-20T00:00:00Z"),
    periodStatus,
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

// ---------------------------------------------------------------------------
// tRPC test double
// ---------------------------------------------------------------------------

/**
 * Typed alias for the options object stored in `lastOptions` for mutation
 * procedures that carry onSuccess/onError callbacks.
 */
interface MutationOpts<TResult = void> {
  onSuccess?: (result: TResult) => void;
  onError?: (err: Error) => void;
}

function renderPage(
  data: ReturnType<typeof makeWeeklyReportData>,
  authorId?: string,
  role: SessionUser["role"] = "head",
  scope?: "product" | "lead",
  contextToolbar?: boolean,
) {
  const { proxy, captured } = createMockTRPC([
    { path: ["weeklyReport", "get"], query: data },
    { path: ["period", "publish"], mutation: true },
    { path: ["period", "reopen"], mutation: true },
    // Phase 23-01: ExportPdfButton calls both pdfExport.request.mutationOptions
    // and pdfExport.status.queryOptions unconditionally on every render. Mock the
    // surface here so the parent page renders without throwing — these tests do
    // not exercise PDF export behavior, they only need the mock to be structurally
    // valid. pdfExport.status has enabled:false in the component; the factory
    // stub without enabled is fine because the component manages enabled itself.
    { path: ["pdfExport", "request"], mutation: true },
    { path: ["pdfExport", "status"], query: null },
    { path: ["review", "dashboard"] },
    { path: ["archive", "list"] },
    { path: ["archive", "archiveReport"], mutation: true },
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
      contextToolbar={contextToolbar}
    />,
    { wrapper: Wrapper },
  );

  return { ...renderResult, captured };
}

describe("WeeklyReportPage — Publish & Lock / Reopen wiring (Phase 22 plan 22-05)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it("clicking Publish & Lock fires period.publish with reportId from view.period", async () => {
    const { captured } = renderPage(makeWeeklyReportData("open"));
    captured["period.publish"].mutationFn.mockResolvedValue(undefined);

    // Wait for query to resolve and page to render.
    await screen.findByRole("button", { name: /publish & lock/i });

    // First click opens the confirmation dialog.
    await userEvent.click(
      screen.getByRole("button", { name: /publish & lock/i }),
    );

    // Confirm in the dialog.
    const dialog = await screen.findByRole("dialog", {
      name: /confirm publish/i,
    });
    const buttons = dialog.querySelectorAll("button");
    await userEvent.click(expectDefined(buttons[buttons.length - 1]));

    await waitFor(() => {
      expect(captured["period.publish"].mutationFn).toHaveBeenCalledTimes(1);
    });
    // TanStack Query invokes mutationFn(variables, context); assert the first arg only.
    expect(captured["period.publish"].mutationFn.mock.calls[0]?.[0]).toEqual({
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
    expect(captured["period.publish"].mutationFn).not.toHaveBeenCalled();
  });

  it("A32: shows empty-state with archive link when submissionCount === 0 and period is open", async () => {
    renderPage({
      ...makeWeeklyReportData("open", {
        portfolioOverview: [],
        leadSections: [],
      }),
      submissionCount: 0,
    });

    // Empty-state card must be present.
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

  it("A32: shows normal report (no empty-state) when submissionCount === 0 but period is published", async () => {
    // published + 0 submissions: edge case (head published empty period).
    // Empty-state must NOT appear — show the normal layout instead.
    renderPage({
      ...makeWeeklyReportData("published", {
        portfolioOverview: [],
        leadSections: [],
      }),
      submissionCount: 0,
    });

    // Wait for render to settle.
    await screen.findByRole("button", { name: /reopen period/i });

    expect(
      screen.queryByTestId("empty-submissions-state"),
    ).not.toBeInTheDocument();
  });

  it("viewer can read a published report without period mutation actions", async () => {
    const published = makeWeeklyReportData("published");

    renderPage(published, undefined, "viewer");

    // Anchor on the always-present report heading: the async Export PDF button
    // is head/admin-only (its `pdfExport.request` job is headProcedure-gated),
    // so it must not render for a viewer and cannot be the render anchor.
    await screen.findByRole("heading", { name: /status report/i });

    expect(
      screen.queryByRole("button", { name: /export pdf/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^archive$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /reopen period/i }),
    ).not.toBeInTheDocument();
  });

  it("on publish success: invalidateDashboard + invalidateLeadHistory fire and a success toast appears", async () => {
    const { captured } = renderPage(makeWeeklyReportData("open"));

    await screen.findByRole("button", { name: /publish & lock/i });

    // Trigger the onSuccess hook directly via the captured options. This decouples
    // the test from internal react-query timing while still exercising the user code.
    const publishOpts = captured["period.publish"].lastOptions as MutationOpts;
    expect(publishOpts.onSuccess).toBeTypeOf("function");
    act(() => {
      expectDefined(publishOpts.onSuccess)();
    });

    expect(invalidateDashboard).toHaveBeenCalled();
    expect(invalidateLeadHistory).toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalled();
  });

  it("on publish error: a toast.error is shown", async () => {
    const { captured } = renderPage(makeWeeklyReportData("open"));

    await screen.findByRole("button", { name: /publish & lock/i });

    const publishOpts = captured["period.publish"].lastOptions as MutationOpts;
    expect(publishOpts.onError).toBeTypeOf("function");
    act(() => {
      expectDefined(publishOpts.onError)(new Error("Forbidden"));
    });

    expect(toastError).toHaveBeenCalled();
  });

  it("clicking Reopen Period (via confirm dialog) fires period.reopen with reportId when periodStatus is published", async () => {
    const { captured } = renderPage(makeWeeklyReportData("published"));
    captured["period.reopen"].mutationFn.mockResolvedValue(undefined);

    // Reopen is now destructive → goes through ConfirmDeleteDialog.
    const reopenBtn = await screen.findByRole("button", {
      name: /reopen period/i,
    });
    await userEvent.click(reopenBtn);

    // Confirm dialog renders with a "Reopen" button (label set via confirmLabel="Reopen").
    const confirmBtn = await screen.findByRole("button", { name: /^reopen$/i });
    await userEvent.click(confirmBtn);

    await waitFor(() => {
      expect(captured["period.reopen"].mutationFn).toHaveBeenCalledTimes(1);
    });
    expect(captured["period.reopen"].mutationFn.mock.calls[0]?.[0]).toEqual({
      reportId: REPORT_ID,
    });
  });

  it("on reopen success: invalidateDashboard + invalidateLeadForm + invalidateLeadHistory fire", async () => {
    const { captured } = renderPage(makeWeeklyReportData("published"));

    await screen.findByRole("button", { name: /reopen period/i });

    const reopenOpts = captured["period.reopen"].lastOptions as MutationOpts;
    expect(reopenOpts.onSuccess).toBeTypeOf("function");
    act(() => {
      expectDefined(reopenOpts.onSuccess)();
    });

    expect(invalidateDashboard).toHaveBeenCalled();
    expect(invalidateLeadForm).toHaveBeenCalled();
    expect(invalidateLeadHistory).toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalled();
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

describe("WeeklyReportPage — async Export PDF button role gating (driver sweep 2026-06-09)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  // The async export starts a `pdfExport.request` job the API gates to
  // head/admin (headProcedure). Before the fix the button rendered for every
  // role, so a viewer/lead on the read-only /reports/[reportId] route (which
  // embeds this page) saw an enabled button that 403'd on click.
  it.each(["head", "admin"] as const)(
    "renders the async Export PDF button for %s",
    async (role) => {
      renderPage(makeWeeklyReportData("published"), undefined, role);
      expect(
        await screen.findByRole("button", { name: /export pdf/i }),
      ).toBeInTheDocument();
    },
  );

  it.each(["viewer", "lead"] as const)(
    "hides the async Export PDF button for %s",
    async (role) => {
      renderPage(makeWeeklyReportData("published"), undefined, role);
      // Anchor on the report heading so the absence assertion is not a race.
      await screen.findByRole("heading", { name: /status report/i });
      expect(
        screen.queryByRole("button", { name: /export pdf/i }),
      ).not.toBeInTheDocument();
    },
  );
});

// head-toolbar-parity: the bespoke gradient "Context shell" is gone — the
// period-context bar renders through the shared ReportToolbar container.
// Standalone consumers (bare /head/report, /reports/[reportId], lead preview,
// present client) keep the default; HeadReportShell passes
// contextToolbar={false} because it owns the page's single toolbar.
describe("WeeklyReportPage — shared period toolbar (head-toolbar-parity)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it("renders the shared ReportToolbar container with the department label by default", async () => {
    renderPage(makeWeeklyReportData("open"));
    await screen.findByRole("heading", { name: /status report/i });
    const toolbar = screen.getByTestId("report-toolbar");
    expect(toolbar).toBeInTheDocument();
    expect(toolbar).toHaveTextContent("Live portfolio review");
  });

  it("suppresses the toolbar when contextToolbar is false (shell owns the single toolbar)", async () => {
    renderPage(
      makeWeeklyReportData("open"),
      undefined,
      "head",
      undefined,
      false,
    );
    await screen.findByRole("heading", { name: /status report/i });
    expect(screen.queryByTestId("report-toolbar")).not.toBeInTheDocument();
  });
});
