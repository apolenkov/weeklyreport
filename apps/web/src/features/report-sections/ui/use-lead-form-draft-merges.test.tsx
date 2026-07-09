import type { ReportSectionReadModel } from "@customreport/shared";
import { act, renderHook } from "@testing-library/react";
import type { SetStateAction } from "react";
import { describe, expect, it } from "vitest";

import type { KanbanItem, Product } from "../model/mock-data";
import { useLeadFormDraftMerges } from "./use-lead-form-draft-merges";

const REPORT_SECTION_ID = "11111111-1111-4111-8111-111111111111";
const REPORT_ID = "22222222-2222-4222-8222-222222222222";
const AUTHOR_ID = "33333333-3333-4333-8333-333333333333";
const PROJECT_ID = "44444444-4444-4444-8444-444444444444";
const ACTIVITY_ID = "55555555-5555-4555-8555-555555555555";

function makeSection(): ReportSectionReadModel {
  return {
    reportSectionId: REPORT_SECTION_ID,
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

const products: Product[] = [
  {
    id: PROJECT_ID,
    name: "Test Product",
    overallStatus: "on-track",
    stages: [],
  },
];

function makeItem(overrides: Partial<KanbanItem> = {}): KanbanItem {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    productId: PROJECT_ID,
    productName: "Test Product",
    status: "planned",
    text: "Quick item",
    author: "Test Lead",
    priorityRank: null,
    ...overrides,
  };
}

describe("useLeadFormDraftMerges", () => {
  it("routes quick-add blocker and activity raises through risk prefill state", () => {
    let draft: ReportSectionReadModel | null = makeSection();
    const setDraftSection = (
      next: SetStateAction<ReportSectionReadModel | null>,
    ) => {
      draft = typeof next === "function" ? next(draft) : next;
    };
    const { result } = renderHook(() =>
      useLeadFormDraftMerges({
        setDraftSection,
        getLoadedContext: () => ({
          products,
          currentWeekItems: [],
          nextWeekItems: [],
        }),
      }),
    );

    act(() => {
      result.current.handleQuickAdd("blocker");
    });

    expect(result.current.riskPrefill).toEqual({
      signal: 1,
      productId: PROJECT_ID,
      stageIds: [],
      severity: "blocked",
    });

    act(() => {
      result.current.handleActivityRaiseRequiresRisk(ACTIVITY_ID, "at-risk");
    });

    expect(result.current.riskPrefill).toEqual({
      signal: 2,
      productId: "",
      stageIds: [],
      severity: "at-risk",
      activityId: ACTIVITY_ID,
    });
    expect(draft.risks).toEqual([]);
  });

  it("increments existing section add signals for risk and decision quick-adds", () => {
    const { result } = renderHook(() =>
      useLeadFormDraftMerges({
        setDraftSection: () => undefined,
        getLoadedContext: () => ({
          products,
          currentWeekItems: [],
          nextWeekItems: [],
        }),
      }),
    );

    act(() => {
      result.current.handleQuickAdd("risk");
      result.current.handleQuickAdd("decision");
    });

    expect(result.current.risksAddSignal).toBe(1);
    expect(result.current.decisionsAddSignal).toBe(1);
  });

  it("merges quick-add item saves into the selected week and closes the host", () => {
    let draft: ReportSectionReadModel | null = makeSection();
    const setDraftSection = (
      next: SetStateAction<ReportSectionReadModel | null>,
    ) => {
      draft = typeof next === "function" ? next(draft) : next;
    };
    const nextItem = makeItem({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      text: "Next quick item",
    });
    const { result } = renderHook(() =>
      useLeadFormDraftMerges({
        setDraftSection,
        getLoadedContext: () => ({
          products,
          currentWeekItems: [],
          nextWeekItems: [],
        }),
      }),
    );

    act(() => {
      result.current.handleQuickAdd("next-item");
    });
    expect(result.current.quickAddItem).toMatchObject({ week: "next", seq: 1 });

    act(() => {
      result.current.handleQuickAddSave(nextItem);
    });

    expect(result.current.quickAddItem).toBeNull();
    expect(draft.items).toHaveLength(1);
    expect(draft.items[0]).toMatchObject({
      id: nextItem.id,
      type: "next",
      text: "Next quick item",
      projectId: PROJECT_ID,
      workflowStatus: "planned",
    });
  });
});
