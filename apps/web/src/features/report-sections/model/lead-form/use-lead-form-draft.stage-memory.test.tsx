import { act, renderHook } from "@testing-library/react";
import type {
  DraftSavePayload,
  ReportSectionReadModel,
} from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import { makeReportSectionFixture } from "../../../../test-utils/report-section-fixtures";
import type { KanbanItem } from "../types";
import type { LeadFormGeneration } from "./lead-form-generation";
import type { LeadFormWritePort } from "./lead-form-write-port";
import { InMemoryLeadFormWriteAdapter } from "./lead-form-write-port.in-memory";
import { useLeadFormDraftCore } from "./use-lead-form-draft-core";

const SECTION = "11111111-1111-4111-8111-111111111111";
const REPORT = "22222222-2222-4222-8222-222222222222";
const PRODUCT = "33333333-3333-4333-8333-333333333333";
const OTHER_REPORT = "44444444-4444-4444-8444-444444444444";

function makeSection(reportId = REPORT): ReportSectionReadModel {
  return makeReportSectionFixture({
    reportSectionId: SECTION,
    reportId,
    projects: [
      {
        projectId: PRODUCT,
        projectName: "Payments",
        trafficLight: "green",
      },
    ],
  });
}

function productItem(stageNames: readonly string[]): KanbanItem {
  return {
    id: "item-1",
    parent: { kind: "product", id: PRODUCT },
    productId: PRODUCT,
    productName: "Payments",
    activityId: null,
    text: "Ship the importer",
    status: "in-progress",
    author: "Test Lead",
    stageNames,
  };
}

function savedSectionFor(payload: DraftSavePayload): ReportSectionReadModel {
  return makeReportSectionFixture({
    reportSectionId: payload.reportSectionId,
    reportId: REPORT,
    version: payload.version + 1,
    projects: [
      {
        projectId: PRODUCT,
        projectName: "Payments",
        trafficLight: "green",
      },
    ],
    items: payload.items.map((item, index) => ({
      id: `55555555-5555-4555-8555-55555555555${index}`,
      stableId: `66666666-6666-4666-8666-66666666666${index}`,
      projectId: item.projectId ?? null,
      activityId: item.activityId ?? null,
      type: item.type,
      text: item.text,
      tag: item.tag,
      workflowStatus: item.workflowStatus,
      carriedOver: item.carriedOver ?? false,
      stageNames: [...(item.stageNames ?? [])],
    })),
  });
}

function renderCore(
  saveDraft: LeadFormWritePort["saveDraft"],
  generation: LeadFormGeneration = `${REPORT}:${SECTION}`,
  section = makeSection(),
) {
  const writePort = new InMemoryLeadFormWriteAdapter({
    saveDraft,
    submit: () => Promise.reject(new Error("Unexpected submit")),
  });
  return renderHook(
    ({
      generation: currentGeneration,
      section: currentSection,
    }: {
      readonly generation: LeadFormGeneration;
      readonly section: ReportSectionReadModel;
    }) =>
      useLeadFormDraftCore({
        writePort,
        generation: currentGeneration,
        serverSection: currentSection,
        sectionIdForActions: SECTION,
        serverReadOnly: false,
        refetchSection: () => Promise.resolve(),
      }),
    { initialProps: { generation, section } },
  );
}

function saveItem(
  draft: ReturnType<typeof useLeadFormDraftCore>,
  stageNames: readonly string[],
) {
  draft.apply({
    kind: "week-items",
    week: "current",
    items: [productItem(stageNames)],
  });
}

describe("open lead-form draft stage memory", () => {
  it("remembers a saved singleton and keeps it after the save confirms", async () => {
    const saveDraft = vi
      .fn<LeadFormWritePort["saveDraft"]>()
      .mockImplementation((payload) =>
        Promise.resolve(savedSectionFor(payload)),
      );
    const { result } = renderCore(saveDraft);

    act(() => saveItem(result.current, ["Testing"]));
    expect(result.current.stageMemory.recall(PRODUCT)).toBe("Testing");

    await act(() => result.current.autosave.forceSave());
    expect(result.current.stageMemory.recall(PRODUCT)).toBe("Testing");
  });

  it("drops a locally saved default when persistence fails", async () => {
    const saveDraft = vi
      .fn<LeadFormWritePort["saveDraft"]>()
      .mockRejectedValue(new Error("offline"));
    const { result } = renderCore(saveDraft);

    act(() => saveItem(result.current, ["Testing"]));
    expect(result.current.stageMemory.recall(PRODUCT)).toBe("Testing");

    await act(async () => {
      await result.current.autosave.forceSave().catch(() => undefined);
    });
    expect(result.current.autosave.state).toBe("error");
    expect(result.current.stageMemory.recall(PRODUCT)).toBeUndefined();
  });

  it("keeps the persisted default when a later save fails", async () => {
    const saveDraft = vi
      .fn<LeadFormWritePort["saveDraft"]>()
      .mockImplementationOnce((payload) =>
        Promise.resolve(savedSectionFor(payload)),
      )
      .mockRejectedValueOnce(new Error("offline"));
    const { result } = renderCore(saveDraft);

    act(() => saveItem(result.current, ["Development"]));
    await act(() => result.current.autosave.forceSave());
    expect(result.current.stageMemory.recall(PRODUCT)).toBe("Development");

    act(() => saveItem(result.current, ["Testing"]));
    await act(async () => {
      await result.current.autosave.forceSave().catch(() => undefined);
    });

    expect(result.current.autosave.state).toBe("error");
    expect(result.current.stageMemory.recall(PRODUCT)).toBe("Development");
  });

  it("does not remember a deliberate multi-stage save", async () => {
    const saveDraft = vi
      .fn<LeadFormWritePort["saveDraft"]>()
      .mockImplementation((payload) =>
        Promise.resolve(savedSectionFor(payload)),
      );
    const { result } = renderCore(saveDraft);

    act(() => saveItem(result.current, ["Development"]));
    await act(() => result.current.autosave.forceSave());

    act(() => saveItem(result.current, ["Development", "Testing"]));
    await act(() => result.current.autosave.forceSave());

    expect(result.current.stageMemory.recall(PRODUCT)).toBe("Development");
  });

  it("forgets the default when the draft or report changes", async () => {
    const saveDraft = vi
      .fn<LeadFormWritePort["saveDraft"]>()
      .mockImplementation((payload) =>
        Promise.resolve(savedSectionFor(payload)),
      );
    const { result, rerender } = renderCore(saveDraft);

    act(() => saveItem(result.current, ["Testing"]));
    await act(() => result.current.autosave.forceSave());
    expect(result.current.stageMemory.recall(PRODUCT)).toBe("Testing");

    rerender({
      generation: `${OTHER_REPORT}:${SECTION}`,
      section: makeSection(OTHER_REPORT),
    });
    expect(result.current.stageMemory.recall(PRODUCT)).toBeUndefined();
  });
});
