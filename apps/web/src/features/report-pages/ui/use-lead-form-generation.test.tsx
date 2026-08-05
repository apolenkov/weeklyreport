import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../../shared/lib/trpc/trpc-context";
import { createMockTRPC } from "../../../test-utils/mock-trpc";
import { makeReportSectionFixture } from "../../../test-utils/report-section-fixtures";
import type { LeadFormDraftSeam } from "./lead-form-draft-seam";
import type { LeadFormGeneration } from "./lead-form-generation";
import type { LeadFormLoadedContext } from "./lead-form-submit-context";
import { useLeadFormDraft } from "./use-lead-form-draft";
import { useLeadFormQuickAdd } from "./use-lead-form-quick-add";

const AUTHOR = "11111111-1111-4111-8111-111111111111";
const PROJECT = "22222222-2222-4222-8222-222222222222";

function makeSection(reportId: string, reportSectionId: string) {
  return makeReportSectionFixture({
    reportSectionId,
    reportId,
    authorId: AUTHOR,
    authorName: "Test Lead",
  });
}

function loaded(): LeadFormLoadedContext {
  return {
    products: [
      {
        id: PROJECT,
        name: "Test Product",
        overallStatus: "on-track",
        stages: [],
      },
    ],
    currentWeekItems: [],
    nextWeekItems: [],
  } satisfies LeadFormLoadedContext;
}

function makeSeam(): LeadFormDraftSeam {
  return {
    submitSection: vi.fn(),
    submitPending: false,
    onSubmitSuccess: vi.fn(),
  };
}

function makeWrapper() {
  const { proxy, captured } = createMockTRPC([
    { path: ["reports", "saveDraft"], mutation: true },
    { path: ["leadForm", "byPeriod"], query: null },
  ]);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <TRPCProxyContext.Provider value={proxy}>
          {children}
        </TRPCProxyContext.Provider>
      </QueryClientProvider>
    );
  }
  return { Wrapper, captured };
}

const ITEM = {
  id: "33333333-3333-4333-8333-333333333333",
  parent: { kind: "product" as const, id: PROJECT },
  productId: PROJECT,
  productName: "Test Product",
  activityId: null,
  status: "planned" as const,
  text: "Captured under report A",
  author: "Test Lead",
  priorityRank: null,
};

describe("lead-form generation ownership", () => {
  it("rejects a stale quick-add callback before draft mutation or autosave", async () => {
    const reportA = makeSection("report-a", "section-a");
    const reportB = makeSection("report-b", "section-b");
    const { Wrapper, captured } = makeWrapper();
    const rendered = renderHook(
      ({ section, context }) => {
        const draft = useLeadFormDraft({
          generation: `${section.reportId}:${section.reportSectionId}`,
          serverSection: section,
          sectionIdForActions: section.reportSectionId,
          serverReadOnly: false,
          refetchSection: () => Promise.resolve(),
          seam: makeSeam(),
          crossAuthors: [],
          isEveryone: false,
        });
        const quickAdd = useLeadFormQuickAdd({
          apply: draft.apply,
          generation: draft.generation,
          loaded: context,
        });
        return { ...draft, ...quickAdd };
      },
      {
        initialProps: { section: reportA, context: loaded() },
        wrapper: Wrapper,
      },
    );
    await waitFor(() =>
      expect(rendered.result.current.draft?.reportId).toBe("report-a"),
    );
    act(() => rendered.result.current.quickAdd("current"));
    const staleSave = rendered.result.current.quickAddSave;

    rendered.rerender({ section: reportB, context: loaded() });
    await waitFor(() =>
      expect(rendered.result.current.draft?.reportId).toBe("report-b"),
    );
    act(() => staleSave(ITEM));

    expect(rendered.result.current.draft?.items).toEqual([]);
    expect(captured["reports.saveDraft"]?.calls).toEqual([]);
    rendered.rerender({ section: reportA, context: loaded() });
    await waitFor(() =>
      expect(rendered.result.current.draft?.reportId).toBe("report-a"),
    );
    expect(rendered.result.current.draft?.items).toEqual([]);
  });

  it("exposes only the current generation and its loaded context on rerender", () => {
    const applyA = vi.fn();
    const applyB = vi.fn();
    const generationA: LeadFormGeneration = "report-a:section-a";
    const rendered = renderHook(
      ({ generation, context, apply }) =>
        useLeadFormQuickAdd({ generation, loaded: context, apply }),
      {
        initialProps: {
          generation: generationA,
          context: loaded(),
          apply: applyA,
        },
      },
    );
    act(() => rendered.result.current.quickAdd("next"));
    expect(rendered.result.current.pendingQuickAdd?.week).toBe("next");

    rendered.rerender({
      generation: "report-b:section-b",
      context: loaded(),
      apply: applyB,
    });
    expect(rendered.result.current.pendingQuickAdd).toBeNull();
    act(() => rendered.result.current.quickAdd("current"));
    act(() => rendered.result.current.quickAddSave(ITEM));

    expect(applyA).not.toHaveBeenCalled();
    expect(applyB).toHaveBeenCalledWith({
      kind: "week-items",
      week: "current",
      items: [ITEM],
    });
  });
});
