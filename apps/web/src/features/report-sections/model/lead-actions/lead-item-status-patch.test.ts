import type { ReportSectionReadModel } from "@weeklyreport/shared";
import { describe, expect, it } from "vitest";

import { buildSetItemStatusPatch } from "./lead-item-status-patch";

type Item = ReportSectionReadModel["items"][number];
type Risk = ReportSectionReadModel["risks"][number];

const ITEM_ID = "10000000-0000-4000-8000-000000000001";

function section(
  item: Partial<Item>,
  risks: readonly Partial<Risk>[] = [],
  status: "draft" | "submitted" = "draft",
): ReportSectionReadModel {
  return {
    status,
    items: [
      {
        id: ITEM_ID,
        type: "current",
        projectId: "product-1",
        stageNames: ["Development"],
        workflowStatus: "in_progress",
        carriedOver: true,
        pausedReason: null,
        nextStepText: null,
        resolution: null,
        ...item,
      },
    ],
    risks,
  } as unknown as ReportSectionReadModel;
}

const COVERING_RISK = {
  projectId: "product-1",
  stageNames: ["Development"],
  severity: "at-risk",
  risk: "Slipping",
} as const;

describe("buildSetItemStatusPatch", () => {
  it("sets the status, clears the pause reason and confirms a carried item", () => {
    expect(
      buildSetItemStatusPatch(
        section({ workflowStatus: "paused", pausedReason: "Waiting" }),
        ITEM_ID,
        "in_progress",
      ),
    ).toEqual({
      kind: "item-patch",
      itemId: ITEM_ID,
      patch: {
        workflowStatus: "in_progress",
        pausedReason: null,
        carriedOver: false,
      },
    });
  });

  it("leaves the carry marker alone on a Next item", () => {
    expect(
      buildSetItemStatusPatch(section({ type: "next" }), ITEM_ID, "planned"),
    ).toEqual({
      kind: "item-patch",
      itemId: ITEM_ID,
      patch: { workflowStatus: "planned", pausedReason: null },
    });
  });

  it("sends a pause to the editor because it needs a reason", () => {
    expect(buildSetItemStatusPatch(section({}), ITEM_ID, "paused")).toBeNull();
  });

  it("sends done to the editor while a next step exists, and patches it otherwise", () => {
    expect(
      buildSetItemStatusPatch(
        section({ nextStepText: "Ship the follow-up" }),
        ITEM_ID,
        "done",
      ),
    ).toBeNull();
    expect(
      buildSetItemStatusPatch(section({}), ITEM_ID, "done"),
    ).not.toBeNull();
  });

  it("leaves a status owned by a covering risk to the editor", () => {
    expect(
      buildSetItemStatusPatch(section({}, [COVERING_RISK]), ITEM_ID, "done"),
    ).toBeNull();
    // Another stage is not covered.
    expect(
      buildSetItemStatusPatch(
        section({ stageNames: ["Testing"] }, [COVERING_RISK]),
        ITEM_ID,
        "done",
      ),
    ).not.toBeNull();
  });

  it("accepts a safe inline pause reason and still rejects invisible text", () => {
    expect(
      buildSetItemStatusPatch(section({}), ITEM_ID, "paused", {
        pausedReason: "Waiting",
      }),
    ).toMatchObject({
      patch: {
        workflowStatus: "paused",
        pausedReason: "Waiting",
        carriedOver: false,
      },
    });
    expect(
      buildSetItemStatusPatch(section({}), ITEM_ID, "paused", {
        pausedReason: "\u200B",
      }),
    ).toBeNull();
  });

  it("clears a next step only after an explicit Done decision", () => {
    expect(
      buildSetItemStatusPatch(
        section({ nextStepText: "Verify" }),
        ITEM_ID,
        "done",
        { nextStepAction: "clear" },
      ),
    ).toMatchObject({
      patch: {
        workflowStatus: "done",
        nextStepText: null,
        pausedReason: null,
        carriedOver: false,
      },
    });
    expect(
      buildSetItemStatusPatch(
        section({ nextStepText: "Verify" }),
        ITEM_ID,
        "done",
        { nextStepAction: "plan" },
      ),
    ).toBeNull();
  });

  it("refuses a resolved item, a missing item and a submitted section", () => {
    expect(
      buildSetItemStatusPatch(
        section({ resolution: { kind: "wont_do" } as Item["resolution"] }),
        ITEM_ID,
        "done",
      ),
    ).toBeNull();
    expect(buildSetItemStatusPatch(section({}), "missing", "done")).toBeNull();
    expect(
      buildSetItemStatusPatch(section({}, [], "submitted"), ITEM_ID, "done"),
    ).toBeNull();
  });
});
