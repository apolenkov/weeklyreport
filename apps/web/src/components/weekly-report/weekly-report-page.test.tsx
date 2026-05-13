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
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

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
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
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
import { WeeklyReportPage } from "./weekly-report-page";
import { expectDefined } from "../../test/expect-defined.js";

const REPORT_ID = "11111111-1111-4111-8111-111111111111";
const AUTHOR_ID_A = "11111111-1111-4111-8111-aaaaaaaaaaaa";
const PRODUCT_ID_A = "11111111-1111-4111-8111-cccccccccccc";
const PRODUCT_ID_B = "11111111-1111-4111-8111-dddddddddddd";

function makeWeeklyReportData(
  periodStatus: "open" | "published" | "reopened",
  overrides?: {
    readonly portfolioOverview?: Array<{
      readonly productId: string;
      readonly productName: string;
      readonly worstStatus: "green" | "yellow" | "red" | "empty";
      readonly stageCount: number;
      readonly leadNames: string[];
    }>;
    readonly leadSections?: Array<{
      readonly reportSectionId: string;
      readonly reportId: string;
      readonly authorId: string;
      readonly authorName: string;
      readonly status: "submitted" | "draft" | "locked";
      readonly submittedAt: Date | null;
      readonly projects: Array<{ projectId: string; projectName: string }>;
      readonly items: Array<{
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
      }>;
      readonly risks: never[];
      readonly decisions: never[];
      readonly priorities: never[];
    }>;
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

type Captured = {
  publishOptions?: { onSuccess?: () => void; onError?: (err: Error) => void };
  reopenOptions?: { onSuccess?: () => void; onError?: (err: Error) => void };
  pdfExportRequestOptions?: {
    onSuccess?: (job: { jobId: string }) => void;
    onError?: (err: Error) => void;
  };
  publishMutationFn: ReturnType<typeof vi.fn>;
  reopenMutationFn: ReturnType<typeof vi.fn>;
  pdfExportRequestMutationFn: ReturnType<typeof vi.fn>;
};

function makeMockTRPC(
  data: ReturnType<typeof makeWeeklyReportData>,
  captured: Captured,
) {
  return {
    weeklyReport: {
      get: {
        queryOptions: () => ({
          queryKey: ["weeklyReport", "get"],
          queryFn: async () => data,
        }),
        pathFilter: () => ({ queryKey: ["weeklyReport", "get"] }),
      },
    },
    period: {
      publish: {
        mutationOptions: (opts: Captured["publishOptions"]) => {
          captured.publishOptions = opts;
          return {
            mutationFn: captured.publishMutationFn,
            onSuccess: opts?.onSuccess,
            onError: opts?.onError,
          };
        },
      },
      reopen: {
        mutationOptions: (opts: Captured["reopenOptions"]) => {
          captured.reopenOptions = opts;
          return {
            mutationFn: captured.reopenMutationFn,
            onSuccess: opts?.onSuccess,
            onError: opts?.onError,
          };
        },
      },
    },
    // Phase 23-01: ExportPdfButton (rendered inside WeeklyReportPage) calls
    // both `pdfExport.request.mutationOptions` and `pdfExport.status.queryOptions`
    // unconditionally on every render. Mock the surface here so the parent
    // page renders without throwing — these tests do not exercise PDF export
    // behavior, they only need the mock to be structurally valid.
    pdfExport: {
      request: {
        mutationOptions: (opts: Captured["pdfExportRequestOptions"]) => {
          captured.pdfExportRequestOptions = opts;
          return {
            mutationFn: captured.pdfExportRequestMutationFn,
            onSuccess: opts?.onSuccess,
            onError: opts?.onError,
          };
        },
      },
      status: {
        queryOptions: () => ({
          queryKey: ["pdfExport", "status"],
          queryFn: async () => null,
          enabled: false,
        }),
      },
    },
    review: {
      dashboard: { pathFilter: () => ({ queryKey: ["review", "dashboard"] }) },
    },
    archive: {
      list: { pathFilter: () => ({ queryKey: ["archive", "list"] }) },
      archiveReport: {
        mutationOptions: (
          opts:
            | { onSuccess?: () => void; onError?: (err: Error) => void }
            | undefined,
        ) => ({
          mutationFn: vi.fn(),
          onSuccess: opts?.onSuccess,
          onError: opts?.onError,
        }),
      },
    },
    reports: {
      myHistory: { pathFilter: () => ({ queryKey: ["reports", "myHistory"] }) },
      getActive: { pathFilter: () => ({ queryKey: ["reports", "getActive"] }) },
    },
    leadForm: {
      byPeriod: { pathFilter: () => ({ queryKey: ["leadForm", "byPeriod"] }) },
      versions: { pathFilter: () => ({ queryKey: ["leadForm", "versions"] }) },
    },
    admin: {
      snapshot: { pathFilter: () => ({ queryKey: ["admin", "snapshot"] }) },
      getSettings: {
        pathFilter: () => ({ queryKey: ["admin", "getSettings"] }),
      },
    },
    // Phase 31 (AI-01): AiSummaryCard is mounted inside WeeklyReportPage.
    // It calls ai.summary.queryOptions and conditionally ai.regenerateSummary.
    // mutationOptions. These tests do not exercise AI behaviour — provide
    // a structurally valid mock so the card renders its loading/empty state.
    ai: {
      onTrack: {
        queryOptions: () => ({
          queryKey: ["ai", "onTrack"],
          queryFn: async () => ({ available: false }) as const,
          enabled: false,
        }),
      },
      summary: {
        queryOptions: () => ({
          queryKey: ["ai", "summary"],
          queryFn: async () => null,
          enabled: false,
        }),
        queryKey: () => ["ai", "summary"],
      },
      regenerateSummary: {
        mutationOptions: (opts: { onSuccess?: () => void } | undefined) => ({
          mutationFn: vi.fn(),
          onSuccess: opts?.onSuccess,
        }),
      },
      sentiment: {
        queryOptions: () => ({
          queryKey: ["ai", "sentiment"],
          queryFn: async () => null,
          enabled: false,
        }),
      },
    },
  } as never;
}

function renderPage(
  data: ReturnType<typeof makeWeeklyReportData>,
  captured: Captured,
  authorId?: string,
) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const trpc = makeMockTRPC(data, captured);
  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <TRPCProxyContext.Provider value={trpc}>
          {children}
        </TRPCProxyContext.Provider>
      </QueryClientProvider>
    );
  }
  return render(<WeeklyReportPage authorId={authorId} />, { wrapper: Wrapper });
}

describe("WeeklyReportPage — Publish & Lock / Reopen wiring (Phase 22 plan 22-05)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it("clicking Publish & Lock fires period.publish with reportId from view.period", async () => {
    const captured: Captured = {
      publishMutationFn: vi.fn().mockResolvedValue(undefined),
      reopenMutationFn: vi.fn().mockResolvedValue(undefined),
      pdfExportRequestMutationFn: vi.fn(),
    };
    renderPage(makeWeeklyReportData("open"), captured);

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
      expect(captured.publishMutationFn).toHaveBeenCalledTimes(1);
    });
    // TanStack Query invokes mutationFn(variables, context); assert the first arg only.
    expect(captured.publishMutationFn.mock.calls[0]?.[0]).toEqual({
      reportId: REPORT_ID,
    });
  });

  it("disables publish and hides Toggle All for an empty weekly report", async () => {
    const captured: Captured = {
      publishMutationFn: vi.fn().mockResolvedValue(undefined),
      reopenMutationFn: vi.fn().mockResolvedValue(undefined),
      pdfExportRequestMutationFn: vi.fn(),
    };
    const emptyData = {
      ...makeWeeklyReportData("open", {
        portfolioOverview: [],
        leadSections: [],
      }),
      submissionCount: 0,
    };

    renderPage(emptyData, captured);

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
    expect(captured.publishMutationFn).not.toHaveBeenCalled();
  });

  it("A32: shows empty-state with archive link when submissionCount === 0 and period is open", async () => {
    const captured: Captured = {
      publishMutationFn: vi.fn().mockResolvedValue(undefined),
      reopenMutationFn: vi.fn().mockResolvedValue(undefined),
      pdfExportRequestMutationFn: vi.fn(),
    };
    const emptyData = {
      ...makeWeeklyReportData("open", {
        portfolioOverview: [],
        leadSections: [],
      }),
      submissionCount: 0,
    };

    renderPage(emptyData, captured);

    // Empty-state card must be present.
    const emptyState = await screen.findByTestId("empty-submissions-state");
    expect(emptyState).toBeInTheDocument();

    // Message must mention the period week label.
    expect(emptyState).toHaveTextContent(/no submissions yet for week 16/i);

    // Archive link must point to the published tab.
    const archiveLink = screen.getByRole("link", {
      name: /view last published report in archive/i,
    });
    expect(archiveLink).toHaveAttribute("href", "/reports?tab=published");

    // Portfolio table and accordion must NOT be rendered.
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("A32: shows normal report (no empty-state) when submissionCount === 0 but period is published", async () => {
    const captured: Captured = {
      publishMutationFn: vi.fn().mockResolvedValue(undefined),
      reopenMutationFn: vi.fn().mockResolvedValue(undefined),
      pdfExportRequestMutationFn: vi.fn(),
    };
    // published + 0 submissions: edge case (head published empty period).
    // Empty-state must NOT appear — show the normal layout instead.
    const publishedEmpty = {
      ...makeWeeklyReportData("published", {
        portfolioOverview: [],
        leadSections: [],
      }),
      submissionCount: 0,
    };

    renderPage(publishedEmpty, captured);

    // Wait for render to settle.
    await screen.findByRole("button", { name: /reopen period/i });

    expect(
      screen.queryByTestId("empty-submissions-state"),
    ).not.toBeInTheDocument();
  });

  it("on publish success: invalidateDashboard + invalidateLeadHistory fire and a success toast appears", async () => {
    const captured: Captured = {
      publishMutationFn: vi.fn().mockResolvedValue(undefined),
      reopenMutationFn: vi.fn().mockResolvedValue(undefined),
      pdfExportRequestMutationFn: vi.fn(),
    };
    renderPage(makeWeeklyReportData("open"), captured);

    await screen.findByRole("button", { name: /publish & lock/i });

    // Trigger the onSuccess hook directly via the captured options. This decouples
    // the test from internal react-query timing while still exercising the user code.
    expect(captured.publishOptions?.onSuccess).toBeTypeOf("function");
    act(() => {
      expectDefined(expectDefined(captured.publishOptions).onSuccess)();
    });

    expect(invalidateDashboard).toHaveBeenCalled();
    expect(invalidateLeadHistory).toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalled();
  });

  it("on publish error: a toast.error is shown", async () => {
    const captured: Captured = {
      publishMutationFn: vi.fn(),
      reopenMutationFn: vi.fn(),
      pdfExportRequestMutationFn: vi.fn(),
    };
    renderPage(makeWeeklyReportData("open"), captured);

    await screen.findByRole("button", { name: /publish & lock/i });

    expect(captured.publishOptions?.onError).toBeTypeOf("function");
    act(() => {
      expectDefined(expectDefined(captured.publishOptions).onError)(
        new Error("Forbidden"),
      );
    });

    expect(toastError).toHaveBeenCalled();
  });

  it("clicking Reopen Period (via confirm dialog) fires period.reopen with reportId when periodStatus is published", async () => {
    const captured: Captured = {
      publishMutationFn: vi.fn(),
      reopenMutationFn: vi.fn().mockResolvedValue(undefined),
      pdfExportRequestMutationFn: vi.fn(),
    };
    renderPage(makeWeeklyReportData("published"), captured);

    // Reopen is now destructive → goes through ConfirmDeleteDialog.
    const reopenBtn = await screen.findByRole("button", {
      name: /reopen period/i,
    });
    await userEvent.click(reopenBtn);

    // Confirm dialog renders with a "Reopen" button (label set via confirmLabel="Reopen").
    const confirmBtn = await screen.findByRole("button", { name: /^reopen$/i });
    await userEvent.click(confirmBtn);

    await waitFor(() => {
      expect(captured.reopenMutationFn).toHaveBeenCalledTimes(1);
    });
    expect(captured.reopenMutationFn.mock.calls[0]?.[0]).toEqual({
      reportId: REPORT_ID,
    });
  });

  it("on reopen success: invalidateDashboard + invalidateLeadForm + invalidateLeadHistory fire", async () => {
    const captured: Captured = {
      publishMutationFn: vi.fn(),
      reopenMutationFn: vi.fn(),
      pdfExportRequestMutationFn: vi.fn(),
    };
    renderPage(makeWeeklyReportData("published"), captured);

    await screen.findByRole("button", { name: /reopen period/i });

    expect(captured.reopenOptions?.onSuccess).toBeTypeOf("function");
    act(() => {
      expectDefined(expectDefined(captured.reopenOptions).onSuccess)();
    });

    expect(invalidateDashboard).toHaveBeenCalled();
    expect(invalidateLeadForm).toHaveBeenCalled();
    expect(invalidateLeadHistory).toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalled();
  });

  it("highlights only one authored section when authorId maps to multiple products", async () => {
    const captured: Captured = {
      publishMutationFn: vi.fn(),
      reopenMutationFn: vi.fn(),
      pdfExportRequestMutationFn: vi.fn(),
    };
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

    renderPage(data, captured, AUTHOR_ID_A);

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
