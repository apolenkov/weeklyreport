import type { ReportSectionReadModel } from "@customreport/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../../lib/trpc-context";
import { createMockTRPC } from "../../../test-utils/mock-trpc";
import type { LeadFormDraftSeam } from "./lead-form-draft-seam";
import type { LeadFormLoadedContext } from "./lead-form-submit-context";
import { useLeadFormDraft } from "./use-lead-form-draft";

const SECTION_ID = "11111111-1111-4111-8111-111111111111";
const REPORT_ID = "22222222-2222-4222-8222-222222222222";
const AUTHOR_ID = "33333333-3333-4333-8333-333333333333";
const PROJECT_ID = "44444444-4444-4444-8444-444444444444";
const ACTIVITY_ID = "55555555-5555-4555-8555-555555555555";

function makeSection(): ReportSectionReadModel {
  return {
    reportSectionId: SECTION_ID,
    reportId: REPORT_ID,
    authorId: AUTHOR_ID,
    authorName: "Test Lead",
    authorRole: "lead",
    version: 1,
    status: "draft",
    submittedAt: null,
    projects: [],
    items: [],
    risks: [],
    decisions: [],
    priorities: [],
    activities: [],
  } as ReportSectionReadModel;
}

const LOADED: LeadFormLoadedContext = {
  products: [
    {
      id: PROJECT_ID,
      name: "Test Product",
      overallStatus: "on-track",
      stages: [],
    },
  ],
  currentWeekItems: [],
  nextWeekItems: [],
};

function makeSeam(): LeadFormDraftSeam {
  return {
    submitSection: vi.fn(() => Promise.resolve(makeSection())),
    submitPending: false,
    onSubmitSuccess: vi.fn(),
  };
}

function renderDraft(loaded: LeadFormLoadedContext = LOADED) {
  const { proxy } = createMockTRPC([
    { path: ["reports", "saveDraft"], mutation: true },
    { path: ["leadForm", "byPeriod"] },
  ]);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <TRPCProxyContext.Provider value={proxy}>
          {children}
        </TRPCProxyContext.Provider>
      </QueryClientProvider>
    );
  }
  const rendered = renderHook(
    () =>
      useLeadFormDraft({
        serverSection: makeSection(),
        sectionIdForActions: SECTION_ID,
        serverReadOnly: false,
        refetchSection: () => Promise.resolve(),
        crossAuthors: [],
        isEveryone: false,
        loaded,
        seam: makeSeam(),
      }),
    { wrapper: Wrapper },
  );
  return rendered;
}

describe("useLeadFormDraft merge routing", () => {
  it("routes a blocker prefill through pendingRiskPrefill with a monotonic signal", () => {
    const { result } = renderDraft();

    act(() => {
      result.current.routeToBlocker({
        productId: PROJECT_ID,
        stageIds: [],
        severity: "blocked",
      });
    });
    expect(result.current.pendingRiskPrefill).toEqual({
      signal: 1,
      productId: PROJECT_ID,
      stageIds: [],
      severity: "blocked",
    });

    act(() => {
      result.current.routeToBlocker({
        productId: "",
        stageIds: [],
        severity: "at-risk",
        activityId: ACTIVITY_ID,
      });
    });
    expect(result.current.pendingRiskPrefill).toEqual({
      signal: 2,
      productId: "",
      stageIds: [],
      severity: "at-risk",
      activityId: ACTIVITY_ID,
    });
  });

  it("opens then clears the quick-add host, merging the saved item into its week", () => {
    const { result } = renderDraft();

    act(() => {
      result.current.quickAdd("next");
    });
    expect(result.current.pendingQuickAdd).toMatchObject({
      week: "next",
      seq: 1,
    });

    act(() => {
      result.current.quickAddSave({
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        productId: PROJECT_ID,
        productName: "Test Product",
        status: "planned",
        text: "Quick item",
        author: "Test Lead",
        priorityRank: null,
      });
    });

    expect(result.current.pendingQuickAdd).toBeNull();
    expect(result.current.draft?.items).toHaveLength(1);
    expect(result.current.draft?.items[0]).toMatchObject({
      type: "next",
      text: "Quick item",
      projectId: PROJECT_ID,
      workflowStatus: "planned",
    });
  });
});
