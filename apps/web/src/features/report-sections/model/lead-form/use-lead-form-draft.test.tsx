import { act, renderHook } from "@testing-library/react";
import type { ReportSectionReadModel } from "@weeklyreport/shared";
import { reportSectionReadModelSchema } from "@weeklyreport/shared";
import { toast } from "sonner";
import { describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
}));

import { makeReportSectionFixture } from "../../../../test-utils/report-section-fixtures";
import { buildDraftActions } from "../../../report-pages/ui/lead/chrome/lead-form-draft-actions";
import { useLeadFormAddSignals } from "../../../report-pages/ui/lead/chrome/use-lead-form-add-signals";
import {
  CURRENT_ITEM_ID,
  makeDraftMergeSection,
} from "./draft/lead-form-draft-merge-test-fixtures";
import type { LeadFormLoadedContext } from "./lead-form-submit-context";
import { InMemoryLeadFormWriteAdapter } from "./lead-form-write-port.in-memory";
import { useLeadFormDraft } from "./use-lead-form-draft";
import { useLeadFormQuickAdd } from "./use-lead-form-quick-add";

const SECTION_ID = "11111111-1111-4111-8111-111111111111";
const REPORT_ID = "22222222-2222-4222-8222-222222222222";
const AUTHOR_ID = "33333333-3333-4333-8333-333333333333";
const PROJECT_ID = "44444444-4444-4444-8444-444444444444";
const ACTIVITY_ID = "55555555-5555-4555-8555-555555555555";

function makeSection(): ReportSectionReadModel {
  return makeReportSectionFixture({
    reportSectionId: SECTION_ID,
    reportId: REPORT_ID,
    authorId: AUTHOR_ID,
    authorName: "Test Lead",
  });
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

function renderDraft(
  loaded: LeadFormLoadedContext = LOADED,
  section = makeSection(),
) {
  const writePort = new InMemoryLeadFormWriteAdapter({
    saveDraft: () => Promise.resolve({ ...makeSection(), version: 2 }),
    submit: () => Promise.resolve({ ...makeSection(), version: 2 }),
  });
  const rendered = renderHook(() => {
    const draft = useLeadFormDraft({
      generation: `${REPORT_ID}:${SECTION_ID}`,
      serverSection: section,
      sectionIdForActions: SECTION_ID,
      serverReadOnly: false,
      refetchSection: () => Promise.resolve(),
      crossAuthors: [],
      isEveryone: false,
      writePort,
    });
    const quickAdd = useLeadFormQuickAdd({
      apply: draft.apply,
      generation: draft.generation,
      loaded,
    });
    const handle = { ...draft, ...quickAdd };
    const signals = useLeadFormAddSignals();
    return {
      ...handle,
      actions: buildDraftActions(
        handle,
        signals,
        loaded,
        handle.draft ?? section,
      ),
    };
  });
  return rendered;
}

describe("useLeadFormDraft merge routing", () => {
  it.each([
    {
      command: "move",
      type: "next",
      workflowStatus: "in_progress",
      pausedReason: null,
    },
    {
      command: "complete",
      type: "current",
      workflowStatus: "done",
      pausedReason: null,
    },
    {
      command: "pause",
      type: "current",
      workflowStatus: "paused",
      pausedReason: "Waiting for access",
    },
  ] as const)(
    "applies an eligible public $command callback while preserving item identity",
    ({ command, type, workflowStatus, pausedReason }) => {
      const base = makeDraftMergeSection();
      const section = reportSectionReadModelSchema.parse({
        ...base,
        items: base.items.map((item) =>
          item.id === CURRENT_ITEM_ID
            ? { ...item, workflowStatus: "in_progress", pausedReason: null }
            : item,
        ),
      });
      const { result } = renderDraft(LOADED, section);
      act(() => {
        const actions = result.current.actions;
        if (command === "move") actions.onMoveToNextWeek(CURRENT_ITEM_ID);
        else if (command === "complete")
          actions.onMarkComplete(CURRENT_ITEM_ID);
        else actions.onPauseItem(CURRENT_ITEM_ID, "Waiting for access");
      });
      expect(result.current.draft?.items[0]).toMatchObject({
        id: CURRENT_ITEM_ID,
        stableId: section.items[0]?.stableId,
        priorityRank: 2,
        stageNames: ["Development"],
        type,
        workflowStatus,
        pausedReason,
      });
      expect(result.current.dirty).toBe(true);
      expect(() =>
        reportSectionReadModelSchema.parse(result.current.draft),
      ).not.toThrow();
    },
  );

  it("confirms a saved next-week plan in place instead of moving the record", () => {
    const base = makeDraftMergeSection();
    const section = reportSectionReadModelSchema.parse({
      ...base,
      items: base.items.map((item) =>
        item.id === CURRENT_ITEM_ID
          ? {
              ...item,
              type: "current",
              workflowStatus: "in_progress",
              pausedReason: null,
              carriedOver: true,
              nextStepText: "Finish the acceptance check",
            }
          : item,
      ),
    });
    const { result } = renderDraft(LOADED, section);

    act(() => {
      result.current.actions.onMoveToNextWeek(CURRENT_ITEM_ID);
    });

    // The record keeps its week placement and its commitment; only the carry
    // marker is acknowledged, so the result is not replaced by its next step.
    expect(result.current.draft?.items[0]).toMatchObject({
      id: CURRENT_ITEM_ID,
      stableId: section.items[0]?.stableId,
      type: "current",
      text: "Current product item",
      workflowStatus: "in_progress",
      nextStepText: "Finish the acceptance check",
      carriedOver: false,
    });
    expect(result.current.draft?.items).toHaveLength(section.items.length);
    expect(result.current.dirty).toBe(true);
    expect(() =>
      reportSectionReadModelSchema.parse(result.current.draft),
    ).not.toThrow();
    expect(toast.success).toHaveBeenCalledWith("Already planned for next week");
  });

  it.each(["move", "complete", "pause"] as const)(
    "keeps a resolved raw item unchanged through the public %s callback",
    (command) => {
      const base = makeDraftMergeSection();
      const section = reportSectionReadModelSchema.parse({
        ...base,
        items: base.items.map((item) =>
          item.id === CURRENT_ITEM_ID
            ? {
                ...item,
                workflowStatus: "in_progress",
                pausedReason: null,
                resolution: {
                  kind: "wont_do",
                  eventId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab",
                  reason: "The dependency was retired",
                  actorId: AUTHOR_ID,
                  actorName: "Test Lead",
                  occurredAt: "2026-09-01T00:00:00.000Z",
                  previousState: {
                    type: "current",
                    workflowStatus: "in_progress",
                    pausedReason: null,
                    nextStepText: null,
                    text: item.text,
                  },
                },
              }
            : item,
        ),
      });
      const { result } = renderDraft(LOADED, section);

      act(() => {
        const actions = result.current.actions;
        if (command === "move") actions.onMoveToNextWeek(CURRENT_ITEM_ID);
        else if (command === "complete")
          actions.onMarkComplete(CURRENT_ITEM_ID);
        else actions.onPauseItem(CURRENT_ITEM_ID, "Waiting for access");
      });

      expect(result.current.draft?.items).toEqual(section.items);
      expect(result.current.dirty).toBe(false);
    },
  );

  it("routes a blocker prefill through pendingRiskPrefill with a monotonic signal", () => {
    const { result } = renderDraft();

    act(() => {
      result.current.routeToBlocker({
        productId: PROJECT_ID,
        stageNames: [],
        severity: "blocked",
      });
    });
    expect(result.current.pendingRiskPrefill).toEqual({
      signal: 1,
      productId: PROJECT_ID,
      stageNames: [],
      severity: "blocked",
    });

    act(() => {
      result.current.routeToBlocker({
        productId: "",
        stageNames: [],
        severity: "at-risk",
        activityId: ACTIVITY_ID,
      });
    });
    expect(result.current.pendingRiskPrefill).toEqual({
      signal: 2,
      productId: "",
      stageNames: [],
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
        parent: { kind: "product", id: PROJECT_ID },
        productId: PROJECT_ID,
        productName: "Test Product",
        activityId: null,
        status: "planned",
        text: "Quick item",
        author: "Test Lead",
        priorityRank: null,
        stageNames: [],
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
