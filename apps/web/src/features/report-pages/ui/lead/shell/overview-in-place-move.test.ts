import type { ReportSectionReadModel } from "@weeklyreport/shared";
import { toast } from "sonner";
import { describe, expect, it, vi } from "vitest";

import { makeReportSectionFixture } from "../../../../../test-utils/report-section-fixtures";
import type { StatusOverviewItem } from "../../../../report-sections";
import { applyDraftPatch } from "../../../../report-sections/model/lead-form/draft/lead-form-draft-patch";
import { moveWithoutEditor } from "./overview-in-place-move";
import type { LeadFormEditorHandle } from "./use-lead-form-editor";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

type ReadyEditor = Extract<LeadFormEditorHandle, { status: "ready" }>;
type MoveArgs = Parameters<typeof moveWithoutEditor>[0];

const RECORD_ID = "80000000-0000-4000-8000-000000000010";
const STABLE_ID = "80000000-0000-4000-8000-000000000011";
const PROJECT_ID = "80000000-0000-4000-8000-000000000004";

function sectionOf(type: "current" | "next"): ReportSectionReadModel {
  return makeReportSectionFixture({
    projects: [
      { projectId: PROJECT_ID, projectName: "Payments", trafficLight: "green" },
    ],
    items: [
      {
        id: RECORD_ID,
        stableId: STABLE_ID,
        projectId: PROJECT_ID,
        type,
        text: "Ship the importer",
        tag: "delivery",
        workflowStatus: "planned",
        carriedOver: false,
        stageNames: ["Development"],
      },
    ],
  });
}

function overviewItem(source: "current" | "next"): StatusOverviewItem {
  return {
    key: `${source}:${STABLE_ID}`,
    recordId: RECORD_ID,
    stableId: STABLE_ID,
    source,
    editTarget: { recordId: RECORD_ID, source },
    text: "Ship the importer",
  } as unknown as StatusOverviewItem;
}

function harness(type: "current" | "next") {
  // The draft store stands in for the autosave engine: applied patches mutate
  // the section the next patch is built from, like the real draft.
  const store = { section: sectionOf(type) };
  const ready = {
    draft: {
      get section() {
        return store.section;
      },
      apply: (patch: Parameters<ReadyEditor["draft"]["apply"]>[0]) => {
        store.section = applyDraftPatch(store.section, patch);
      },
    },
  } as unknown as ReadyEditor;
  const args = (item: StatusOverviewItem, target: "current" | "next") =>
    ({
      whenIdle: (action: (editor: ReadyEditor) => void) => action(ready),
      focusMoved: vi.fn(),
      section: store.section,
      item,
      target,
    }) as unknown as MoveArgs;
  return { args, ready, store };
}

interface ToastOptions {
  duration?: number;
  action?: { readonly label: unknown; onClick(): void } | undefined;
}

// The last move toast's options carry the Undo click handler; calling it here
// stands in for the user pressing the notification's Undo button.
function moveToastOptions(): ToastOptions | undefined {
  return vi.mocked(toast.success).mock.calls.at(-1)?.[1] as
    ToastOptions | undefined;
}

describe("moveWithoutEditor", () => {
  it("moves a genuine Next item to this week directly and offers Undo", () => {
    const { args, store } = harness("next");

    expect(moveWithoutEditor(args(overviewItem("next"), "current"))).toBe(true);

    expect(store.section.items[0]).toMatchObject({ type: "current" });
    expect(vi.mocked(toast.success).mock.calls.at(-1)?.[0]).toBe(
      "Moved to this week",
    );
    const offered = moveToastOptions();
    expect(offered?.duration).toBe(8000);
    expect(offered?.action?.label).toBe("Undo");

    // Undo moves the same record back to Next through the same draft write.
    offered?.action?.onClick();
    expect(store.section.items[0]).toMatchObject({ type: "next" });
    expect(vi.mocked(toast.success).mock.calls.at(-1)?.[0]).toBe(
      "Moved to next week",
    );
    expect(moveToastOptions()?.action?.label).toBe("Undo");
  });

  it("reports a refused Undo and keeps the server state", () => {
    const { args, store } = harness("current");
    const item = overviewItem("current");

    expect(moveWithoutEditor(args(item, "next"))).toBe(true);
    expect(store.section.items[0]).toMatchObject({ type: "next" });

    // The occurrence was moved back before Undo ran, so the reverse patch is
    // refused: the notification reports it and nothing is written.
    store.section = applyDraftPatch(store.section, {
      kind: "item-patch",
      itemId: RECORD_ID,
      patch: { type: "current" },
    });
    moveToastOptions()?.action?.onClick();

    expect(store.section.items[0]).toMatchObject({ type: "current" });
    expect(toast.error).toHaveBeenCalledWith(
      "This move can no longer be undone.",
    );
  });
  it("undoes a move after a draft save re-issued the row id", () => {
    const { args, store } = harness("current");
    const item = overviewItem("current");

    expect(moveWithoutEditor(args(item, "next"))).toBe(true);
    // The draft save returns the same occurrence under a new row id; Undo must
    // find it again by its stable identity in the week it moved to.
    store.section = {
      ...store.section,
      items: store.section.items.map((row) => ({ ...row, id: "reissued-id" })),
    };
    moveToastOptions()?.action?.onClick();

    expect(store.section.items[0]).toMatchObject({ type: "current" });
    expect(toast.error).not.toHaveBeenCalled();
  });
});
