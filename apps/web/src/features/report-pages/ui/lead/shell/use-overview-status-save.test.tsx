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
  const promote = vi
    .fn<ReadyEditor["outcomes"]["promote"]>()
    .mockRejectedValue(new Error("Connection lost"));
  const section = makeReportSectionFixture({ items: [raw] });
  const editor = {
    generation: "generation-1",
    view: { viewModel: { isReadOnly: false } },
    draft: { section, apply: vi.fn() },
    outcomes: { canExecute: true, pending: false, promote },
  } as unknown as ReadyEditor;
  const hook = renderHook(
    (ready: ReadyEditor) => useOverviewStatusSave(ready),
    { initialProps: editor },
  );
  return { editor, hook, promote };
}

describe("inline promotion attempt identity", () => {
  it("reuses commandId after failure and a physical-id remint", async () => {
    const { editor, hook, promote } = setup();
    await act(() =>
      hook.result.current(item, "done", { nextStepAction: "plan" }),
    );
    const reminted = { ...raw, id: "reminted" };
    hook.rerender({
      ...editor,
      draft: {
        ...editor.draft,
        section: { ...editor.draft.section, items: [reminted] },
      },
    });
    await act(() =>
      hook.result.current({ ...item, recordId: "reminted" }, "done", {
        nextStepAction: "plan",
      }),
    );
    expect(promote).toHaveBeenCalledTimes(2);
    expect(promote.mock.calls[1]?.[0].commandId).toBe(
      promote.mock.calls[0]?.[0].commandId,
    );
  });

  it("replays the same command after a successful server update with a lost acknowledgement", async () => {
    const { editor, hook, promote } = setup();
    await act(() =>
      hook.result.current(item, "done", { nextStepAction: "plan" }),
    );
    const promoted = {
      ...raw,
      id: "reminted",
      type: "next" as const,
      text: raw.nextStepText,
      nextStepText: null,
    };
    hook.rerender({
      ...editor,
      draft: {
        ...editor.draft,
        section: { ...editor.draft.section, items: [promoted] },
      },
    });
    promote.mockResolvedValue(
      {} as Awaited<ReturnType<ReadyEditor["outcomes"]["promote"]>>,
    );
    await act(() =>
      hook.result.current(item, "done", { nextStepAction: "plan" }),
    );
    expect(promote).toHaveBeenCalledTimes(2);
    expect(promote.mock.calls[1]?.[0]).toEqual(promote.mock.calls[0]?.[0]);
  });

  it("does not reuse an uncertain command for changed input", async () => {
    const { editor, hook, promote } = setup();
    await act(() =>
      hook.result.current(item, "done", { nextStepAction: "plan" }),
    );
    hook.rerender({
      ...editor,
      draft: {
        ...editor.draft,
        section: {
          ...editor.draft.section,
          items: [{ ...raw, nextStepText: "Different intention" }],
        },
      },
    });
    let failure: string | null = null;
    await act(async () => {
      failure = await hook.result.current(item, "done", {
        nextStepAction: "plan",
      });
    });
    expect(failure).toMatch(/previous plan attempt is unconfirmed/);
    expect(promote).toHaveBeenCalledOnce();
  });

  it("refuses an ordinary status write when the report becomes read-only", async () => {
    const { editor, hook, promote } = setup();
    hook.rerender({
      ...editor,
      view: {
        ...editor.view,
        viewModel: { ...editor.view.viewModel, isReadOnly: true },
      },
    });
    let failure: string | null = null;
    await act(async () => {
      failure = await hook.result.current(item, "paused", {
        pausedReason: "Waiting",
      });
    });
    expect(failure).toMatch(/read-only/);
    expect(editor.draft.apply).not.toHaveBeenCalled();
    expect(promote).not.toHaveBeenCalled();
  });

  it("does not execute queued input in a different generation", async () => {
    const { editor, hook, promote } = setup();
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
    expect(promote).not.toHaveBeenCalled();
  });

  it("drops the old command after A to B to A without an action in B", async () => {
    const { editor, hook, promote } = setup();
    await act(() =>
      hook.result.current(item, "done", { nextStepAction: "plan" }),
    );
    hook.rerender({ ...editor, generation: "report-B" });
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
      hook.result.current({ ...item, recordId: "reminted" }, "done", {
        nextStepAction: "plan",
      }),
    );
    expect(promote.mock.calls[1]?.[0].commandId).not.toBe(
      promote.mock.calls[0]?.[0].commandId,
    );
  });

  it("does not cache a rejected preflight as an uncertain command", async () => {
    const { editor, hook, promote } = setup();
    hook.rerender({
      ...editor,
      outcomes: {
        ...editor.outcomes,
        canExecute: false,
        blockedReason: "Wait for autosave",
      },
    });
    await act(() =>
      hook.result.current(item, "done", { nextStepAction: "plan" }),
    );
    expect(promote).not.toHaveBeenCalled();
    hook.rerender(editor);
    let failure: string | null = null;
    await act(async () => {
      failure = await hook.result.current(item, "done", {
        nextStepAction: "clear",
      });
    });
    expect(failure).toBeNull();
    expect(editor.draft.apply).toHaveBeenCalledOnce();
  });

  it("starts a fresh attempt after the report generation changes", async () => {
    const { editor, hook, promote } = setup();
    await act(() =>
      hook.result.current(item, "done", { nextStepAction: "plan" }),
    );
    hook.rerender({ ...editor, generation: "generation-2" });
    await act(() =>
      hook.result.current(item, "done", { nextStepAction: "plan" }),
    );
    expect(promote.mock.calls[1]?.[0].commandId).not.toBe(
      promote.mock.calls[0]?.[0].commandId,
    );
  });
});
