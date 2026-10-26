import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { makeReportSectionFixture } from "../../../../../test-utils/report-section-fixtures";
import type { StatusOverviewItem } from "../../../../report-sections";
import type { LeadFormEditorHandle } from "./use-lead-form-editor";
import { useOverviewStatusSave } from "./use-overview-status-save";

type ReadyEditor = Extract<LeadFormEditorHandle, { status: "ready" }>;
const stableId = "80000000-0000-4000-8000-000000000003";
const recordId = "80000000-0000-4000-8000-000000000005";
const raw = {
  id: recordId,
  stableId,
  type: "current" as const,
  text: "Current result",
  nextStepText: "Explicit next plan",
  workflowStatus: "in_progress" as const,
  carriedOver: false,
  tag: "delivery",
  stageNames: ["Development"],
};
const item = {
  recordId,
  stableId,
  source: "current",
  editTarget: { source: "current", recordId },
} as StatusOverviewItem;
function setup() {
  const section = makeReportSectionFixture({ items: [raw] });
  const editor = {
    generation: "generation-1",
    view: { viewModel: { isReadOnly: false } },
    draft: { section, apply: vi.fn() },
    outcomes: { pending: false },
  } as unknown as ReadyEditor;
  const hook = renderHook(
    (ready: ReadyEditor) => useOverviewStatusSave(ready),
    { initialProps: editor },
  );
  return { editor, hook };
}

describe("inline status save guards", () => {
  it("finds the same stable item after a physical-id remint", async () => {
    const { editor, hook } = setup();
    hook.rerender({
      ...editor,
      draft: {
        ...editor.draft,
        section: {
          ...editor.draft.section,
          items: [{ ...raw, id: "reminted" }],
        },
      },
    });
    await act(() =>
      hook.result.current(item, "done", { nextStepAction: "clear" }),
    );
    expect(editor.draft.apply).toHaveBeenCalledWith({
      kind: "item-patch",
      itemId: "reminted",
      patch: {
        workflowStatus: "done",
        nextStepText: null,
        pausedReason: null,
        carriedOver: false,
      },
    });
  });
  it("refuses a status write when the report becomes read-only", async () => {
    const { editor, hook } = setup();
    hook.rerender({
      ...editor,
      view: {
        ...editor.view,
        viewModel: { ...editor.view.viewModel, isReadOnly: true },
      },
    });
    await expect(
      hook.result.current(item, "paused", { pausedReason: "Waiting" }),
    ).resolves.toMatch(/read-only/);
    expect(editor.draft.apply).not.toHaveBeenCalled();
  });
  it("does not execute queued input in a different generation", async () => {
    const { editor, hook } = setup();
    hook.rerender({
      ...editor,
      outcomes: { ...editor.outcomes, pending: true },
    });
    const pending = hook.result.current(item, "paused", {
      pausedReason: "Waiting",
    });
    hook.rerender({ ...editor, generation: "different" });
    await expect(pending).resolves.toMatch(/context changed/);
    expect(editor.draft.apply).not.toHaveBeenCalled();
  });
  it("fails closed without a generation instead of inventing a fallback", async () => {
    const { editor, hook } = setup();
    hook.rerender({ ...editor, generation: null });
    await expect(
      hook.result.current(item, "paused", { pausedReason: "Waiting" }),
    ).resolves.toMatch(/no longer available/);
    expect(editor.draft.apply).not.toHaveBeenCalled();
  });
});
