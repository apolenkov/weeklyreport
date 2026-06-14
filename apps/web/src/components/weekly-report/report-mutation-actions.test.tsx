/**
 * @vitest-environment jsdom
 *
 * lead-live-walk-2026-06-14 task 5.3/5.4: ReportMutationActions is the head
 * period-mutation cluster (Export-PDF + Archive + Publish/Reopen) extracted
 * from the WeeklyReportPage header so it can be mounted inside the shared
 * ReportActionsPill. These tests pin the extracted contract: the right controls
 * render per role + period status, every pill control shares the touch-target
 * height, and the publish mutation fires intact.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../lib/trpc-context";

vi.mock("../../lib/cache-keys", () => ({
  invalidateDashboard: vi.fn(),
  invalidateLeadForm: vi.fn(),
  invalidateLeadHistory: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { SessionContext, type SessionUser } from "../../lib/session-provider";
import { expectDefined } from "../../test-utils/expect-defined.js";
import { createMockTRPC } from "../../test-utils/mock-trpc";
import { ReportMutationActions } from "./report-mutation-actions";

const REPORT_ID = "11111111-1111-4111-8111-111111111111";
const PRODUCT_ID_A = "11111111-1111-4111-8111-cccccccccccc";
const AUTHOR_ID_A = "11111111-1111-4111-8111-aaaaaaaaaaaa";

function makeWeeklyReportData(periodStatus: "open" | "published" | "reopened") {
  return {
    reportId: REPORT_ID,
    periodStart: new Date("2026-04-14T00:00:00Z"),
    periodEnd: new Date("2026-04-20T00:00:00Z"),
    periodStatus,
    weekLabel: "Week 16",
    submissionCount: 4,
    totalLeads: 6,
    portfolioOverview: [
      {
        productId: PRODUCT_ID_A,
        productName: "Product Alpha",
        worstStatus: "green" as const,
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
        status: "submitted" as const,
        submittedAt: new Date("2026-04-14T09:00:00Z"),
        projects: [{ projectId: PRODUCT_ID_A, projectName: "Product Alpha" }],
        items: [
          {
            id: "33333333-3333-4333-8333-aaaaaaaaaa01",
            projectId: PRODUCT_ID_A,
            type: "current" as const,
            text: "Done task A",
            tag: "Dev",
            workflowStatus: "done" as const,
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

function renderCluster(
  data: ReturnType<typeof makeWeeklyReportData>,
  role: SessionUser["role"] = "head",
) {
  const { proxy, captured } = createMockTRPC([
    { path: ["weeklyReport", "get"], query: data },
    { path: ["period", "publish"], mutation: true },
    { path: ["period", "reopen"], mutation: true },
    { path: ["pdfExport", "request"], mutation: true },
    { path: ["pdfExport", "status"], query: null },
    { path: ["archive", "archiveReport"], mutation: true },
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

  const result = render(<ReportMutationActions reportId={REPORT_ID} />, {
    wrapper: Wrapper,
  });
  return { ...result, captured };
}

describe("ReportMutationActions — control set (task 5.3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("head sees Export-PDF + Publish on an open period", async () => {
    renderCluster(makeWeeklyReportData("open"), "head");
    expect(
      await screen.findByRole("button", { name: /export pdf/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /publish & lock/i }),
    ).toBeInTheDocument();
  });

  it("head sees Export-PDF + Archive + Reopen on a published period", async () => {
    renderCluster(makeWeeklyReportData("published"), "head");
    expect(
      await screen.findByRole("button", { name: /export pdf/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /move this report to the archive/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /reopen period/i }),
    ).toBeInTheDocument();
  });

  it("lead sees Export-PDF but no publish/archive controls", async () => {
    renderCluster(makeWeeklyReportData("published"), "lead");
    expect(
      await screen.findByRole("button", { name: /export pdf/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: /move this report to the archive/i,
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /reopen period/i }),
    ).not.toBeInTheDocument();
  });

  // Task 5.1/5.2: every pill control shares ONE height (--touch-target-min).
  it("every rendered control carries the shared touch-target min-height", async () => {
    renderCluster(makeWeeklyReportData("published"), "head");
    await screen.findByRole("button", { name: /export pdf/i });
    const buttons = [
      screen.getByRole("button", { name: /export pdf/i }),
      screen.getByRole("button", { name: /move this report to the archive/i }),
      screen.getByRole("button", { name: /reopen period/i }),
    ];
    for (const btn of buttons) {
      expect(btn.className).toContain("min-h-[var(--touch-target-min)]");
    }
  });

  it("clicking Publish & Lock fires period.publish with the report id", async () => {
    const { captured } = renderCluster(makeWeeklyReportData("open"), "head");
    captured["period.publish"].mutationFn.mockResolvedValue(undefined);

    await userEvent.click(
      await screen.findByRole("button", { name: /publish & lock/i }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: /confirm publish/i,
    });
    const dialogButtons = dialog.querySelectorAll("button");
    await userEvent.click(
      expectDefined(dialogButtons[dialogButtons.length - 1]),
    );

    await waitFor(() => {
      expect(captured["period.publish"].mutationFn).toHaveBeenCalledTimes(1);
    });
    expect(captured["period.publish"].mutationFn.mock.calls[0]?.[0]).toEqual({
      reportId: REPORT_ID,
    });
  });
});
