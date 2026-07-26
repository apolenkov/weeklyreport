// Mapper chain memoizes on data inputs only — reviewMode reuses the view-model.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  SessionContext,
  type SessionUser,
} from "../../../lib/session-provider";
import { TRPCProxyContext } from "../../../lib/trpc-context";
import { createMockTRPC } from "../../../test-utils/mock-trpc";
import {
  useWeeklyReportPage,
  type WeeklyReportPageState,
} from "./use-weekly-report-page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

// Re-narrow independently each call (not an inline if on result.current).
function expectReady(
  state: WeeklyReportPageState,
): Extract<WeeklyReportPageState, { kind: "ready" }> {
  if (state.kind !== "ready") {
    throw new Error(`expected ready state, got "${state.kind}"`);
  }
  return state;
}

const REPORT_ID = "11111111-1111-4111-8111-111111111111";
const AUTHOR_ID = "22222222-2222-4222-8222-222222222222";
const PRODUCT_ID = "33333333-3333-4333-8333-333333333333";
const PRODUCT_ID_B = "44444444-4444-4444-8444-444444444444";

function makeActiveReportData() {
  return {
    status: "active" as const,
    reportId: REPORT_ID,
    periodStart: new Date("2026-04-14T00:00:00Z"),
    periodEnd: new Date("2026-04-20T00:00:00Z"),
    deadline: new Date("2026-04-17T15:00:00Z"),
    periodStatus: "open" as const,
    weekLabel: "Week 16",
    submissionCount: 1,
    totalLeads: 1,
    hasActiveReminderRule: true,
    portfolioOverview: [
      {
        productId: PRODUCT_ID,
        productName: "Product Alpha",
        worstStatus: "green" as const,
        stageCount: 1,
        leadNames: ["Alice"],
      },
      {
        productId: PRODUCT_ID_B,
        productName: "Product Beta",
        worstStatus: "green" as const,
        stageCount: 1,
        leadNames: ["Alice"],
      },
    ],
    leadSections: [
      {
        reportSectionId: "55555555-5555-4555-8555-555555555555",
        reportId: REPORT_ID,
        authorId: AUTHOR_ID,
        authorName: "Alice",
        version: 1,
        status: "submitted" as const,
        submittedAt: new Date("2026-04-14T09:00:00Z"),
        projects: [
          {
            projectId: PRODUCT_ID,
            projectName: "Product Alpha",
            trafficLight: "green" as const,
          },
        ],
        items: [
          {
            id: "item-1",
            projectId: PRODUCT_ID,
            type: "current" as const,
            text: "Submitted work",
            tag: "Dev",
            workflowStatus: "done" as const,
            carriedOver: false,
          },
        ],
        risks: [],
        decisions: [],
        activities: [],
      },
      {
        reportSectionId: "66666666-6666-4666-8666-666666666666",
        reportId: REPORT_ID,
        authorId: AUTHOR_ID,
        authorName: "Alice",
        version: 1,
        status: "draft" as const,
        submittedAt: null,
        projects: [
          {
            projectId: PRODUCT_ID_B,
            projectName: "Product Beta",
            trafficLight: "green" as const,
          },
        ],
        items: [
          {
            id: "item-2",
            projectId: PRODUCT_ID_B,
            type: "current" as const,
            text: "Draft work",
            tag: "Dev",
            workflowStatus: "in_progress" as const,
            carriedOver: false,
          },
        ],
        risks: [],
        decisions: [],
        activities: [],
      },
    ],
    escalations: [],
  };
}

function renderPageHook(role: SessionUser["role"] = "head") {
  const { proxy } = createMockTRPC([
    { path: ["weeklyReport", "get"], query: makeActiveReportData() },
    { path: ["period", "publish"], mutation: true },
    { path: ["period", "reopen"], mutation: true },
    { path: ["archive", "archiveReport"], mutation: true },
    { path: ["archive", "unarchiveReport"], mutation: true },
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

  return renderHook(
    () =>
      useWeeklyReportPage({
        reportId: REPORT_ID,
        canonicalBasePath: "/head/report",
        scope: "product",
      }),
    { wrapper: Wrapper },
  );
}

describe("useWeeklyReportPage — memoized mapper chain", () => {
  it("keeps the same accordion object reference across a reviewMode-only re-render", async () => {
    const { result } = renderPageHook();

    await waitFor(() => {
      expectReady(result.current);
    });
    const before = expectReady(result.current);
    const accordionBefore = before.accordion;
    const reviewModelBefore = before.reviewModel;

    act(() => {
      expectReady(result.current).handlers.setReviewMode("review");
    });

    await waitFor(() => {
      expect(expectReady(result.current).reviewMode).toBe("review");
    });
    const after = expectReady(result.current);

    // Pure UI-toggle re-render: the memoized derivation must not recompute —
    // same object references, not merely equal-by-value.
    expect(after.accordion).toBe(accordionBefore);
    expect(after.reviewModel).toBe(reviewModelBefore);
  });

  it("recomputes the accordion when a data-dependent input (submissionFilter) changes", async () => {
    const { result } = renderPageHook();

    await waitFor(() => {
      expectReady(result.current);
    });
    const before = expectReady(result.current);
    const accordionBefore = before.accordion;
    expect(before.submissionFilter).toBe("submitted");

    act(() => {
      expectReady(result.current).handlers.setSubmissionFilter("all");
    });

    await waitFor(() => {
      expect(expectReady(result.current).submissionFilter).toBe("all");
    });
    const after = expectReady(result.current);

    expect(after.accordion).not.toBe(accordionBefore);
  });
});
