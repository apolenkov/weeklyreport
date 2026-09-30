import type { ReportSectionReadModel } from "@customreport/shared";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { expectDefined } from "../../../../test-utils/expect-defined";
import { makeReportSectionFixture } from "../../../../test-utils/report-section-fixtures";
import type { LeadFormWritePort } from "./lead-form-write-port";
import { InMemoryLeadFormWriteAdapter } from "./lead-form-write-port.in-memory";
import { useLeadFormDraftCore } from "./use-lead-form-draft-core";

const SECTION = "11111111-1111-4111-8111-111111111111";
const REPORT = "22222222-2222-4222-8222-222222222222";
const ITEM = "33333333-3333-4333-8333-333333333333";
const SAVED_ITEM = "44444444-4444-4444-8444-444444444444";
const STABLE = "55555555-5555-4555-8555-555555555555";
const PRODUCT = "66666666-6666-4666-8666-666666666666";
const FINAL_ITEM = "77777777-7777-4777-8777-777777777777";

afterEach(() => vi.useRealTimers());

function makeSection() {
  return makeReportSectionFixture({
    reportSectionId: SECTION,
    reportId: REPORT,
    items: [
      {
        id: ITEM,
        stableId: STABLE,
        projectId: PRODUCT,
        activityId: null,
        type: "current",
        text: "Current result",
        nextStepText: null,
        tag: "general",
        workflowStatus: "in_progress",
        carriedOver: false,
        stageNames: [],
      },
    ],
  });
}

function renderDraft(
  serverSection: ReportSectionReadModel,
  saveDraft: LeadFormWritePort["saveDraft"],
) {
  const writePort = new InMemoryLeadFormWriteAdapter({
    saveDraft,
    submit: () => Promise.reject(new Error("Unexpected submit")),
  });
  const refetchSection = vi.fn().mockResolvedValue(undefined);
  const rendered = renderHook(
    ({ section }: { section: ReportSectionReadModel }) =>
      useLeadFormDraftCore({
        writePort,
        generation: `${REPORT}:${SECTION}`,
        serverSection: section,
        sectionIdForActions: SECTION,
        serverReadOnly: false,
        refetchSection,
      }),
    { initialProps: { section: serverSection } },
  );
  return { ...rendered, refetchSection };
}

function editCommitment(
  draft: ReturnType<typeof useLeadFormDraftCore>,
  nextStepText: string,
) {
  draft.apply({
    kind: "week-items",
    week: "current",
    items: (draft.draft?.items ?? []).map((item) => ({
      id: expectDefined(item.id),
      parent: { kind: "product", id: PRODUCT },
      productId: PRODUCT,
      productName: "Product",
      activityId: null,
      text: item.text,
      nextStepText:
        item.text === "Current result" ? nextStepText : item.nextStepText,
      author: "Lead",
      status: "in-progress",
      stageNames: [],
    })),
  });
}

function savedSection(
  section: ReportSectionReadModel,
  id: string,
  nextStepText: string,
  version: number,
) {
  return {
    ...section,
    version,
    items: section.items.map((item) =>
      item.text === "Current result"
        ? { ...item, id, stableId: STABLE, nextStepText }
        : item,
    ),
  };
}

describe("draft save echo with recreated database rows", () => {
  it("adopts the loaded server draft as saved without a redundant write", async () => {
    vi.useFakeTimers();
    const section = makeSection();
    const saveDraft = vi.fn<LeadFormWritePort["saveDraft"]>();
    const { result } = renderDraft(section, saveDraft);

    expect(result.current.draft).toEqual(section);
    expect(result.current.autosave.dirty).toBe(false);
    expect(result.current.autosave.state).toBe("idle");

    await act(() => vi.advanceTimersByTimeAsync(15_000));
    await act(() => result.current.autosave.forceSave());

    expect(saveDraft).not.toHaveBeenCalled();
    expect(result.current.draft).toEqual(section);
    expect(result.current.autosave.dirty).toBe(false);
  });

  it("preserves a dirty draft when the same server payload advances version", async () => {
    vi.useFakeTimers();
    const initial = makeSection();
    const saveDraft = vi
      .fn()
      .mockResolvedValue(savedSection(initial, ITEM, "Local commitment", 3));
    const { result, rerender, refetchSection } = renderDraft(
      initial,
      saveDraft,
    );

    act(() => editCommitment(result.current, "Local commitment"));
    expect(result.current.autosave.dirty).toBe(true);

    rerender({ section: { ...initial, version: 2 } });

    expect(result.current.version).toBe(2);
    expect(result.current.draft?.items[0]?.nextStepText).toBe(
      "Local commitment",
    );
    expect(result.current.autosave.dirty).toBe(true);
    expect(refetchSection).not.toHaveBeenCalled();

    await act(() => result.current.autosave.forceSave());
    expect(saveDraft).toHaveBeenCalledOnce();
    expect(saveDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 2,
        items: [expect.objectContaining({ nextStepText: "Local commitment" })],
      }),
    );
  });

  it.each([false, true])(
    "confirms IDs without refetch or repeated autosave (reordered=%s)",
    async (reordered) => {
      vi.useFakeTimers();
      const initial = makeSection();
      const serverSection = {
        ...initial,
        items: [
          ...initial.items,
          {
            ...expectDefined(initial.items[0]),
            id: "extra-id",
            stableId: "extra-stable",
            text: "Another result",
          },
        ],
      };
      const saved = savedSection(
        serverSection,
        SAVED_ITEM,
        "Next commitment",
        2,
      );
      const saveDraft = vi.fn().mockResolvedValue({
        ...saved,
        items: reordered ? saved.items.toReversed() : saved.items,
      });
      const { result } = renderDraft(serverSection, saveDraft);
      act(() => editCommitment(result.current, "Next commitment"));
      await act(() => result.current.autosave.forceSave());
      expect(result.current.draft?.items[0]).toMatchObject({
        id: SAVED_ITEM,
        stableId: STABLE,
        text: "Current result",
        nextStepText: "Next commitment",
      });
      expect(result.current.autosave.dirty).toBe(false);
      expect(result.current.autosave.state).toBe("saved");
      await act(() => vi.advanceTimersByTimeAsync(15_000));
      expect(saveDraft).toHaveBeenCalledOnce();
    },
  );

  it.each([false, true])(
    "rebases queued edits onto confirmed identity (new lineage=%s)",
    async (newLineage) => {
      vi.useFakeTimers();
      const initial = makeSection();
      const serverSection = {
        ...initial,
        items: initial.items.map((item) => ({
          ...item,
          stableId: newLineage ? undefined : STABLE,
        })),
      };
      const first = Promise.withResolvers<ReportSectionReadModel>();
      const saveDraft = vi
        .fn<LeadFormWritePort["saveDraft"]>()
        .mockImplementationOnce(() => first.promise)
        .mockResolvedValueOnce(
          savedSection(serverSection, FINAL_ITEM, "Newest commitment", 3),
        );
      const { result } = renderDraft(serverSection, saveDraft);
      act(() => editCommitment(result.current, "First commitment"));
      let firstSave: Promise<void> | undefined;
      act(() => {
        firstSave = result.current.autosave.forceSave();
      });
      act(() => editCommitment(result.current, "Newest commitment"));
      await act(() => result.current.autosave.forceSave());
      await act(async () => {
        first.resolve(
          savedSection(serverSection, SAVED_ITEM, "First commitment", 2),
        );
        await firstSave;
      });
      expect(saveDraft.mock.calls[1]?.[0].items[0]).toMatchObject({
        id: SAVED_ITEM,
        stableId: STABLE,
        nextStepText: "Newest commitment",
      });
      expect(result.current.draft?.items[0]).toMatchObject({
        id: FINAL_ITEM,
        stableId: STABLE,
        nextStepText: "Newest commitment",
      });
      expect(result.current.autosave.dirty).toBe(false);
      await act(() => vi.advanceTimersByTimeAsync(15_000));
      expect(saveDraft).toHaveBeenCalledTimes(2);
    },
  );
});

// A row the payload cannot carry (a required field is still blank) is unsaved
// user content. Without this the draft comparison key calls the section clean and
// an external update replaces the draft with no notice.
describe("draft rows the payload cannot carry", () => {
  const RISK = "88888888-8888-4888-8888-888888888888";

  function changeElsewhere(section: ReportSectionReadModel) {
    return {
      ...section,
      version: section.version + 1,
      items: section.items.map((item) => ({
        ...item,
        text: "Changed elsewhere",
      })),
    };
  }

  function addHalfTypedRisk(result: {
    current: ReturnType<typeof useLeadFormDraftCore>;
  }) {
    act(() => {
      result.current.apply({
        kind: "risks",
        risks: [
          {
            id: RISK,
            productId: PRODUCT,
            productName: "Product",
            activityId: null,
            stageNames: [],
            severity: "at-risk",
            text: "Half typed risk",
            impact: "",
            mitigation: "Mitigate later",
          },
        ],
      });
    });
  }

  it("reports a conflict instead of replacing a partially typed row in silence", () => {
    const section = makeSection();
    const saveDraft = vi.fn<LeadFormWritePort["saveDraft"]>();
    const { result, rerender, refetchSection } = renderDraft(
      section,
      saveDraft,
    );

    addHalfTypedRisk(result);
    expect(result.current.draft?.risks).toHaveLength(1);
    expect(result.current.autosave.dirty).toBe(false);

    rerender({ section: changeElsewhere(section) });

    expect(refetchSection).toHaveBeenCalledTimes(1);
  });

  it("still adopts a changed server section when nothing is typed locally", () => {
    const section = makeSection();
    const saveDraft = vi.fn<LeadFormWritePort["saveDraft"]>();
    const { result, rerender, refetchSection } = renderDraft(
      section,
      saveDraft,
    );

    expect(result.current.autosave.dirty).toBe(false);

    rerender({ section: changeElsewhere(section) });

    expect(refetchSection).not.toHaveBeenCalled();
    expect(result.current.draft?.items[0]?.text).toBe("Changed elsewhere");
  });
});

// A reviewer comment does not move the section version, so the refetch keeps
// the same draft payload. The lead surface renders comments from the draft, which
// means the reseed still has to refresh them or feedback stays invisible.
describe("reviewer feedback arriving without a payload change", () => {
  const COMMENT = "99999999-9999-4999-8999-999999999999";
  const REVIEWER = "a0a0a0a0-a0a0-4a0a-8a0a-a0a0a0a0a0a0";

  function withComment(
    items: ReportSectionReadModel["items"],
  ): ReportSectionReadModel["items"] {
    return items.map((item) => ({
      ...item,
      comments: [
        {
          id: COMMENT,
          reviewerId: REVIEWER,
          reviewerName: "Head",
          text: "Please add the impact",
          createdAt: new Date("2026-09-17T00:00:00.000Z"),
        },
      ],
    }));
  }

  it("refreshes comments on an existing record without a save", () => {
    const section = makeSection();
    const saveDraft = vi.fn<LeadFormWritePort["saveDraft"]>();
    const { result, rerender } = renderDraft(section, saveDraft);

    expect(result.current.draft?.items[0]?.comments ?? []).toHaveLength(0);

    // A comment write does not move the section version, so the refetch arrives
    // at the same revision and the merge must still run.
    rerender({ section: { ...section, items: withComment(section.items) } });

    expect(result.current.draft?.items[0]?.comments).toHaveLength(1);
    expect(result.current.autosave.dirty).toBe(false);
    expect(saveDraft).not.toHaveBeenCalled();
  });

  it("refreshes comments when the section version also advanced", () => {
    const section = makeSection();
    const saveDraft = vi.fn<LeadFormWritePort["saveDraft"]>();
    const { result, rerender } = renderDraft(section, saveDraft);

    rerender({
      section: {
        ...section,
        version: section.version + 1,
        items: withComment(section.items),
      },
    });

    expect(result.current.draft?.items[0]?.comments).toHaveLength(1);
  });
});

describe("draft save echo for decisions the server re-owns", () => {
  it("settles after one save when a decision owner differs from the section author", async () => {
    vi.useFakeTimers();
    const decision = {
      id: "88888888-8888-4888-8888-888888888888",
      stableId: "99999999-9999-4999-8999-999999999999",
      text: "Adopt the new runbook",
      owner: "Lead S.",
      deadline: null,
      impact: "Fewer incidents",
      resolvedAt: null,
      productId: null,
      activityId: null,
      stageNames: [],
    };
    const initial = { ...makeSection(), decisions: [decision] };
    // The server stores every decision under the section author.
    const saved = savedSection(
      {
        ...initial,
        decisions: [{ ...decision, owner: initial.authorName }],
      },
      SAVED_ITEM,
      "Next commitment",
      2,
    );
    const saveDraft = vi.fn().mockResolvedValue(saved);
    const { result } = renderDraft(initial, saveDraft);

    act(() => editCommitment(result.current, "Next commitment"));
    await act(() => result.current.autosave.forceSave());
    await act(() => vi.advanceTimersByTimeAsync(20_000));

    expect(saveDraft).toHaveBeenCalledOnce();
    expect(result.current.autosave.dirty).toBe(false);
    expect(result.current.autosave.state).toBe("saved");
  });
});
