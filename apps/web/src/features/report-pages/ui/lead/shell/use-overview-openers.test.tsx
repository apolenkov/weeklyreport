import { act, renderHook } from "@testing-library/react";
import type { ReportSectionReadModel } from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import { makeReportSectionFixture } from "../../../../../test-utils/report-section-fixtures";
import type { StatusOverviewItem } from "../../../../report-sections";
import type { LeadFormEditorHandle } from "./use-lead-form-editor";
import { useOverviewEditOpeners } from "./use-overview-openers";

type ReadyEditor = Extract<LeadFormEditorHandle, { status: "ready" }>;
type OpenersArgs = Parameters<typeof useOverviewEditOpeners>[0];

const RECORD_ID = "80000000-0000-4000-8000-000000000005";
const PROJECT_ID = "80000000-0000-4000-8000-000000000004";

const section: ReportSectionReadModel = makeReportSectionFixture({
  projects: [
    { projectId: PROJECT_ID, projectName: "Payments", trafficLight: "green" },
  ],
  items: [
    {
      id: RECORD_ID,
      stableId: "80000000-0000-4000-8000-000000000003",
      projectId: PROJECT_ID,
      type: "current",
      text: "Ship the importer",
      tag: "delivery",
      workflowStatus: "planned",
      carriedOver: true,
      stageNames: ["Development"],
      priorityRank: 1,
    },
  ],
});

const item = {
  key: "current:1",
  recordId: RECORD_ID,
  stableId: "80000000-0000-4000-8000-000000000003",
  editTarget: { source: "current", recordId: RECORD_ID },
} as unknown as StatusOverviewItem;

function setup(pending: boolean) {
  const apply = vi.fn<ReadyEditor["draft"]["apply"]>();
  const setDialog = vi.fn();
  const build = (isPending: boolean) =>
    ({
      status: "ready",
      generation: "generation-1",
      view: { viewModel: { isReadOnly: false } },
      draft: { section, apply },
      outcomes: { pending: isPending },
    }) as unknown as ReadyEditor;
  const args = (editor: ReadyEditor): OpenersArgs =>
    ({
      editor,
      isReadOnly: false,
      dialog: null,
      setDialog,
      rememberFocus: vi.fn(),
      resetAttempt: vi.fn(),
    }) as unknown as OpenersArgs;
  const hook = renderHook(
    (editor: ReadyEditor) => useOverviewEditOpeners(args(editor)),
    { initialProps: build(pending) },
  );
  return {
    hook,
    apply,
    setDialog,
    settle: () => act(() => hook.rerender(build(false))),
  };
}

describe("useOverviewEditOpeners while an outcome command runs", () => {
  it("applies a status change right away when nothing is running", () => {
    const { hook, apply } = setup(false);

    void hook.result.current.setItemStatus(item, "done");

    expect(apply).toHaveBeenCalledOnce();
  });

  it("queues a status change behind the command instead of dropping it", async () => {
    const { hook, apply, settle } = setup(true);

    void hook.result.current.setItemStatus(item, "done");
    expect(apply).not.toHaveBeenCalled();

    settle();
    await vi.waitFor(() => expect(apply).toHaveBeenCalledOnce());
  });

  it("applies an inline pause without opening the full editor", async () => {
    const { hook, apply, setDialog } = setup(false);
    await act(() =>
      hook.result.current.setItemStatus(item, "paused", undefined, {
        pausedReason: "Waiting",
      }),
    );
    expect(apply.mock.calls[0]?.[0]).toMatchObject({
      kind: "item-patch",
      patch: { workflowStatus: "paused", pausedReason: "Waiting" },
    });
    expect(setDialog).not.toHaveBeenCalled();
  });

  it("queues a carried-over confirmation behind the command", async () => {
    const { hook, apply, settle } = setup(true);

    hook.result.current.confirmItem(item);
    expect(apply).not.toHaveBeenCalled();

    settle();
    await vi.waitFor(() => expect(apply).toHaveBeenCalledOnce());
  });
});
