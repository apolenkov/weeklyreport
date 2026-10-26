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
  const section = makeReportSectionFixture({ items: [raw] });
  const editor = {
    view: { viewModel: { isReadOnly: false } },
    draft: { section, apply },
  } as unknown as ReadyEditor;
  return { editor, section, apply };
}

describe("saveOverviewStatus", () => {
  it("refuses a draft write after the report becomes read-only", async () => {
    const { editor, apply } = setup();
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
  });
  it("writes pause input directly without an outcome command", async () => {
    const { editor, apply } = setup();
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
  });
  it("marks the same Current result done and clears only its continuation", async () => {
    const { editor, apply, section } = setup();
    expect(
      await saveOverviewStatus(editor, {
        item,
        status: "done",
        input: { nextStepAction: "clear" },
      }),
    ).toBeNull();
    expect(apply.mock.calls[0]?.[0]).toMatchObject({
      kind: "item-patch",
      itemId: recordId,
      patch: { workflowStatus: "done", nextStepText: null, carriedOver: false },
    });
    expect(section.items).toEqual([raw]);
  });
  it("refuses a status owned by a newly arrived covering risk", async () => {
    const { editor, apply, section } = setup();
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
        input: { nextStepAction: "clear" },
      }),
    ).toMatch(/Set by risk: No access/);
    expect(apply).not.toHaveBeenCalled();
  });
});
