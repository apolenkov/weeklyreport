import type { ResolvePlanInput } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import type { OpenWorkRegisterItem } from "./open-work-register-model";
import type {
  OverviewPlanFields,
  OverviewPlanState,
} from "./overview-plan-command";
import {
  createOpenWorkPlanState,
  overviewPlanInput,
  overviewPlanRecoveryReason,
} from "./overview-plan-command";

type PlanInputState = Pick<OverviewPlanState, "fields" | "source">;

const CURRENT_SOURCE: ResolvePlanInput["source"] = {
  kind: "current",
  recordId: "current-record",
};
const PRIOR_SOURCE: ResolvePlanInput["source"] = {
  kind: "prior",
  reportId: "prior-report",
  recordId: "prior-record",
};

function fields(patch: Partial<OverviewPlanFields> = {}): OverviewPlanFields {
  return {
    outcome: "done",
    resultText: "Delivered result",
    planText: "Next commitment",
    nextStepText: "Follow up next week",
    reason: "No longer needed",
    parent: { kind: "product", id: "product-1" },
    stageNames: ["Development"],
    ...patch,
  };
}

function state(
  fields_: OverviewPlanFields,
  source: ResolvePlanInput["source"] = CURRENT_SOURCE,
): PlanInputState {
  return { fields: fields_, source };
}

describe("overviewPlanInput", () => {
  it("uses result text for Done without leaking plan or next-step text", () => {
    expect(
      overviewPlanInput(
        state(
          fields({
            outcome: "done",
            resultText: "  Delivered result  ",
            planText: "Must not become result",
            nextStepText: "Must not be sent",
          }),
        ),
      ),
    ).toEqual({
      source: CURRENT_SOURCE,
      outcome: "done",
      text: "Delivered result",
      parent: { kind: "product", id: "product-1" },
      stageNames: ["Development"],
    });
  });

  it("keeps Continue result and next step independent", () => {
    expect(
      overviewPlanInput(
        state(
          fields({
            outcome: "continue",
            resultText: "  Current delivery  ",
            planText: "Must not be sent",
            nextStepText: "  Verify production metrics  ",
          }),
        ),
      ),
    ).toEqual({
      source: CURRENT_SOURCE,
      outcome: "continue",
      text: "Current delivery",
      nextStepText: "Verify production metrics",
      parent: { kind: "product", id: "product-1" },
      stageNames: ["Development"],
    });
  });

  it("uses Plan next text for an immutable prior source and never sends nextStepText", () => {
    expect(
      overviewPlanInput(
        state(
          fields({
            outcome: "plan_next",
            resultText: "Must not become plan",
            planText: "  Reconcile the provider invoice  ",
            nextStepText: "Must not be sent for prior plan",
          }),
          PRIOR_SOURCE,
        ),
      ),
    ).toEqual({
      source: PRIOR_SOURCE,
      outcome: "plan_next",
      text: "Reconcile the provider invoice",
      parent: { kind: "product", id: "product-1" },
      stageNames: ["Development"],
    });
  });

  it("sends only the trimmed reason for Won't do and requires it", () => {
    expect(
      overviewPlanInput(
        state(
          fields({
            outcome: "wont_do",
            resultText: "Must not be sent",
            planText: "Must not be sent",
            nextStepText: "Must not be sent",
            reason: "  The dependency closed.  ",
          }),
        ),
      ),
    ).toEqual({
      source: CURRENT_SOURCE,
      outcome: "wont_do",
      reason: "The dependency closed.",
      parent: { kind: "product", id: "product-1" },
      stageNames: ["Development"],
    });

    expect(() =>
      overviewPlanInput(
        state(fields({ outcome: "wont_do", reason: " ".repeat(3) })),
      ),
    ).toThrow("Explain why this plan will not be done.");
  });

  it.each([
    [
      "has no selected outcome",
      fields({ outcome: null }),
      "Choose a plan outcome.",
    ],
    [
      "has no resolved parent",
      fields({ parent: { kind: "unresolved" } }),
      "Select an attached product or activity.",
    ],
    [
      "uses a product without a stage",
      fields({ stageNames: [] }),
      "Select at least one stage.",
    ],
  ] as const)("rejects a plan that %s", (_name, invalidFields, message) => {
    expect(() => overviewPlanInput(state(invalidFields))).toThrow(message);
  });

  it("clears product stages for an activity parent", () => {
    expect(
      overviewPlanInput(
        state(
          fields({
            outcome: "continue",
            parent: { kind: "activity", id: "activity-1" },
            stageNames: ["Must be discarded"],
            nextStepText: "",
          }),
        ),
      ),
    ).toEqual({
      source: CURRENT_SOURCE,
      outcome: "continue",
      text: "Delivered result",
      nextStepText: null,
      parent: { kind: "activity", id: "activity-1" },
      stageNames: [],
    });
  });

  it("captures immutable prior lineage and preselects explicit replan", () => {
    const reportId = "60000000-0000-4000-8000-000000000001";
    const recordId = "60000000-0000-4000-8000-000000000002";
    const stableId = "60000000-0000-4000-8000-000000000003";
    const productId = "60000000-0000-4000-8000-000000000004";
    const openWork: OpenWorkRegisterItem = {
      key: stableId,
      periodLabel: "Jul 6–12, 2026",
      action: { kind: "replan", label: "Replan deferred work" },
      occurrence: {
        source: "published",
        reportId,
        reportSectionId: "60000000-0000-4000-8000-000000000005",
        periodStart: new Date("2026-07-06T00:00:00.000Z"),
        periodEnd: new Date("2026-07-12T00:00:00.000Z"),
        parent: { kind: "product", id: productId, name: "Payments" },
        item: {
          id: recordId,
          stableId,
          projectId: productId,
          activityId: null,
          type: "next",
          text: "Reconcile provider invoices",
          tag: "delivery",
          workflowStatus: "postponed",
          carriedOver: false,
          pausedReason: null,
          stageNames: ["Development"],
        },
      },
    };
    const editor = {
      generation: "target-report:target-section",
      draft: {
        section: {
          projects: [{ projectId: productId }],
          activities: [],
          items: [openWork.occurrence.item],
        },
      },
      view: { viewModel: { isReadOnly: false } },
    } as unknown as Parameters<typeof createOpenWorkPlanState>[0];

    const captured = createOpenWorkPlanState(editor, openWork);

    expect(captured.source).toEqual({ kind: "prior", reportId, recordId });
    expect(captured.item.stableId).toBe(stableId);
    expect(captured.fields).toMatchObject({
      outcome: "plan_next",
      planText: "Reconcile provider invoices",
      parent: { kind: "product", id: productId },
      stageNames: ["Development"],
    });
    expect(overviewPlanInput(captured)).toMatchObject({
      source: { kind: "prior", reportId, recordId },
      outcome: "plan_next",
      text: "Reconcile provider invoices",
    });
    expect(
      createOpenWorkPlanState(editor, {
        ...openWork,
        action: { kind: "reopen", label: "Reopen in this report" },
      }).fields.outcome,
    ).toBe("plan_next");

    const current = {
      ...captured,
      source: { kind: "current" as const, recordId },
    };
    const owner = Symbol("owner");
    expect(overviewPlanRecoveryReason(editor, current, owner)).toBeNull();
    const changedEditor = {
      ...editor,
      draft: {
        section: {
          ...editor.draft.section,
          items: [{ ...openWork.occurrence.item, text: "Changed elsewhere" }],
        },
      },
    } as unknown as Parameters<typeof overviewPlanRecoveryReason>[0];
    expect(overviewPlanRecoveryReason(changedEditor, current, owner)).toContain(
      "changed while you were editing",
    );
    expect(
      overviewPlanRecoveryReason(
        editor,
        {
          ...current,
          attempt: {
            key: "resolve:{}",
            commandId: "60000000-0000-4000-8000-000000000006",
            owner: Symbol("previous mount"),
          },
        },
        owner,
      ),
    ).toContain("unknown after navigation");
  });
});
