import { describe, expect, it, vi } from "vitest";

import { makeReportSectionFixture } from "../../../../../test-utils/report-section-fixtures";
import type { StatusOverviewItem } from "../../../../report-sections";
import { saveOverviewStatus } from "./overview-status-save";
import type { LeadFormEditorHandle } from "./use-lead-form-editor";

type ReadyEditor = Extract<LeadFormEditorHandle, { status: "ready" }>;
const recordId = "80000000-0000-4000-8000-000000000005";
const stableId = "80000000-0000-4000-8000-000000000003";
const raw = {
  id: recordId,
  stableId,
  type: "current" as const,
  text: "Current result",
  nextStepText: "Explicit next plan",
  workflowStatus: "in_progress" as const,
  carriedOver: true,
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
  const apply = vi.fn<ReadyEditor["draft"]["apply"]>();
  const promote = vi
    .fn<ReadyEditor["outcomes"]["promote"]>()
    .mockResolvedValue(
      {} as Awaited<ReturnType<ReadyEditor["outcomes"]["promote"]>>,
    );
  const section = makeReportSectionFixture({ items: [raw] });
  const editor = {
    view: { viewModel: { isReadOnly: false } },
    draft: { section, apply },
    outcomes: { canExecute: true, promote },
  } as unknown as ReadyEditor;
  return { editor, section, apply, promote };
}

describe("saveOverviewStatus", () => {
  it("refuses a draft write after the report becomes read-only", async () => {
    const { editor, apply, promote } = setup();
    const locked = {
      ...editor,
      view: {
        ...editor.view,
        viewModel: { ...editor.view.viewModel, isReadOnly: true },
      },
    };
    expect(
      await saveOverviewStatus(locked, {
        item,
        status: "paused",
        input: { pausedReason: "Waiting" },
      }),
    ).toMatch(/read-only/);
    expect(apply).not.toHaveBeenCalled();
    expect(promote).not.toHaveBeenCalled();
  });

  it("writes pause input directly, without an item editor", async () => {
    const { editor, apply, promote } = setup();
    expect(
      await saveOverviewStatus(editor, {
        item,
        status: "paused",
        input: { pausedReason: "Waiting" },
      }),
    ).toBeNull();
    expect(apply.mock.calls[0]?.[0]).toMatchObject({
      kind: "item-patch",
      patch: {
        workflowStatus: "paused",
        pausedReason: "Waiting",
        carriedOver: false,
      },
    });
    expect(promote).not.toHaveBeenCalled();
  });

  it("uses the canonical promotion once and never creates another occurrence", async () => {
    const { editor, promote, apply, section } = setup();
    expect(
      await saveOverviewStatus(editor, {
        item,
        status: "done",
        input: { nextStepAction: "plan" },
      }),
    ).toBeNull();
    expect(promote).toHaveBeenCalledExactlyOnceWith(
      { recordId, commandId: expect.any(String) as string, target: "next" },
      stableId,
    );
    expect(apply).not.toHaveBeenCalled();
    expect(section.items).toEqual([raw]);
  });

  it("does not overwrite a separate explicit Next of the same stableId", async () => {
    const { editor, promote, apply, section } = setup();
    const next = {
      ...raw,
      id: "other",
      type: "next" as const,
      text: "Explicit winner",
      nextStepText: null,
    };
    const latest = {
      ...editor,
      draft: { ...editor.draft, section: { ...section, items: [raw, next] } },
    };
    expect(
      await saveOverviewStatus(latest, {
        item,
        status: "done",
        input: { nextStepAction: "plan" },
      }),
    ).toMatch(/already has a Next/);
    expect(promote).not.toHaveBeenCalled();
    expect(apply).not.toHaveBeenCalled();
    expect(next.text).toBe("Explicit winner");
  });

  it("refuses a status owned by a newly arrived covering risk", async () => {
    const { editor, promote, apply, section } = setup();
    const latest = {
      ...editor,
      draft: {
        ...editor.draft,
        section: {
          ...section,
          items: [{ ...raw, projectId: "product-1" }],
          risks: [
            {
              id: "risk-1",
              projectId: "product-1",
              stageNames: ["Development"],
              severity: "blocked" as const,
              risk: "No access",
              impact: "No shipment",
              mitigation: "Escalate",
            },
          ],
        },
      },
    };
    expect(
      await saveOverviewStatus(latest, {
        item,
        status: "done",
        input: { nextStepAction: "plan" },
      }),
    ).toMatch(/Set by risk: No access/);
    expect(promote).not.toHaveBeenCalled();
    expect(apply).not.toHaveBeenCalled();
  });

  it("keeps command failures as inline errors and makes no draft write", async () => {
    const { editor, promote, apply } = setup();
    promote.mockRejectedValue(new Error("Connection lost"));
    expect(
      await saveOverviewStatus(editor, {
        item,
        status: "done",
        input: { nextStepAction: "plan" },
      }),
    ).toBe("Connection lost");
    expect(apply).not.toHaveBeenCalled();
  });
});
