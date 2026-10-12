import type {
  ReportSectionReadModel,
  ResolvePlanInput,
} from "@weeklyreport/shared";
import { describe, expect, it } from "vitest";

import {
  promoteItemTransition,
  resolveItemTransition,
  restoreItemTransition,
} from "./item-outcome-transition.js";
import { LeadFormConstraintError } from "./lead-form-shared.js";

const id = "11111111-1111-4111-8111-111111111111";
const item: ReportSectionReadModel["items"][number] = {
  id,
  stableId: id,
  projectId: id,
  type: "current",
  text: "Delivered the API",
  tag: "feature",
  workflowStatus: "in_progress",
  carriedOver: false,
  stageNames: ["Development"],
  nextStepText: "Validate the integration",
};
const command = (
  outcome: ResolvePlanInput["outcome"],
  overrides: Partial<ResolvePlanInput> = {},
): ResolvePlanInput => ({
  reportSectionId: id,
  commandId: id,
  version: 1,
  source: { kind: "current", recordId: id },
  outcome,
  ...overrides,
});

describe("atomic item outcome transitions", () => {
  it.each(["done", "plan_next", "wont_do"] as const)(
    "resolves the prior next-step promise, not the old result, as %s",
    (outcome) => {
      const result = resolveItemTransition(
        item,
        command(outcome, {
          source: { kind: "prior", reportId: id, recordId: id },
        }),
      );
      expect(result.text).toBe("Validate the integration");
      expect(result.beforeState).toEqual({
        type: "next",
        workflowStatus: "planned",
        pausedReason: null,
        nextStepText: null,
        text: "Validate the integration",
      });
      expect(item.text).toBe("Delivered the API");
      if (outcome === "wont_do")
        expect(result.afterState).toEqual(result.beforeState);
    },
  );
  it("preserves the current result when planning a separate next step", () => {
    const result = resolveItemTransition(
      item,
      command("plan_next", { text: "Ship the UI" }),
    );
    expect(result.text).toBe("Delivered the API");
    expect(result.afterState).toEqual({
      type: "current",
      workflowStatus: "in_progress",
      pausedReason: null,
      nextStepText: "Ship the UI",
      text: "Delivered the API",
    });
    expect(item.nextStepText).toBe("Validate the integration");
  });

  it("archives the replaced result text on a transition that rewrites it", () => {
    const result = resolveItemTransition(
      item,
      command("continue", { text: "Promoted next step" }),
    );

    expect(result.beforeState.text).toBe("Delivered the API");
    expect(result.afterState.text).toBe("Promoted next step");
  });

  it.each(["done", "continue", "plan_next"] as const)(
    "materializes a prior plan with the explicit %s outcome",
    (outcome) => {
      const result = resolveItemTransition(
        {
          ...item,
          type: "next",
          workflowStatus: "planned",
          nextStepText: null,
        },
        command(outcome, {
          source: { kind: "prior", reportId: id, recordId: id },
        }),
      );
      expect(result.afterState.type).toBe(
        outcome === "plan_next" ? "next" : "current",
      );
      expect(result.afterState.workflowStatus).toBe(
        outcome === "done"
          ? "done"
          : outcome === "continue"
            ? "in_progress"
            : "planned",
      );
      expect(result.afterState.nextStepText).toBeNull();
    },
  );

  it("clears pause and commitment when work is completed", () => {
    const result = resolveItemTransition(
      { ...item, workflowStatus: "paused", pausedReason: "Approval" },
      command("done"),
    );
    expect(result.afterState).toEqual({
      type: "current",
      workflowStatus: "done",
      pausedReason: null,
      nextStepText: null,
      text: "Delivered the API",
    });
  });

  it("resumes only through the explicit Continue command", () => {
    const paused = {
      ...item,
      workflowStatus: "paused" as const,
      pausedReason: "Approval",
    };
    expect(
      resolveItemTransition(
        paused,
        command("plan_next", { text: "After approval" }),
      ).afterState.workflowStatus,
    ).toBe("paused");
    expect(
      resolveItemTransition(paused, command("continue")).afterState
        .pausedReason,
    ).toBeNull();
  });

  it("keeps the cancellation tuple and restores it with an audit reference", () => {
    const result = resolveItemTransition(
      item,
      command("wont_do", { reason: "No longer needed" }),
    );
    expect(result.afterState).toEqual(result.beforeState);
    const cancelled = {
      ...item,
      resolution: {
        kind: "wont_do" as const,
        eventId: id,
        reason: "No longer needed",
        actorId: id,
        actorName: "Lead",
        occurredAt: "2026-09-04T10:00:00.000Z",
        previousState: result.beforeState,
      },
    };
    expect(restoreItemTransition(cancelled)).toEqual({
      beforeState: result.afterState,
      afterState: result.beforeState,
      reversesEventId: id,
    });
    expect(() => resolveItemTransition(cancelled, command("continue"))).toThrow(
      "Restore",
    );
  });

  it("rejects restore without cancellation and a commitment on finished work", () => {
    expect(() => restoreItemTransition(item)).toThrow("not cancelled");
    expect(() =>
      resolveItemTransition(
        { ...item, workflowStatus: "done", nextStepText: null },
        command("plan_next", { text: "Next step" }),
      ),
    ).toThrow("Completed work");
  });
  it("never invents a next commitment from the reported result", () => {
    expect(() =>
      resolveItemTransition(
        { ...item, nextStepText: null },
        command("plan_next"),
      ),
    ).toThrow("explicitly");
  });

  it("promotes the linked continuation over the active result", () => {
    const result = promoteItemTransition(item);

    expect(result.afterState).toEqual({
      type: "current",
      workflowStatus: "in_progress",
      pausedReason: null,
      nextStepText: null,
      text: "Validate the integration",
    });
    expect(result.beforeState).toMatchObject({
      text: "Delivered the API",
      nextStepText: "Validate the integration",
    });
  });

  it("preserves an active pause when paused work is moved to Current", () => {
    const result = promoteItemTransition({
      ...item,
      workflowStatus: "paused",
      pausedReason: "Waiting for approval.",
    });

    expect(result.afterState).toMatchObject({
      workflowStatus: "paused",
      pausedReason: "Waiting for approval.",
      text: "Validate the integration",
    });
    expect(result.beforeState).toMatchObject({
      workflowStatus: "paused",
      pausedReason: "Waiting for approval.",
      text: "Delivered the API",
    });
  });

  it("moves a linked continuation to Next without changing its workflow status", () => {
    const result = promoteItemTransition(
      {
        ...item,
        workflowStatus: "paused",
        pausedReason: "Waiting for approval.",
      },
      "next",
    );

    expect(result.beforeState).toEqual({
      type: "current",
      workflowStatus: "paused",
      pausedReason: "Waiting for approval.",
      nextStepText: "Validate the integration",
      text: "Delivered the API",
    });
    expect(result.afterState).toEqual({
      type: "next",
      workflowStatus: "paused",
      pausedReason: "Waiting for approval.",
      nextStepText: null,
      text: "Validate the integration",
    });
  });

  it("rejects promotion of completed, cancelled or commitment-free work", () => {
    const promoted = () => promoteItemTransition({ ...item });
    const cancelled = {
      ...item,
      resolution: {
        kind: "wont_do" as const,
        eventId: id,
        reason: "Retired",
        actorId: id,
        actorName: "Lead",
        occurredAt: "2026-09-05T12:00:00.000Z",
        previousState: {
          type: "current" as const,
          workflowStatus: "in_progress" as const,
          pausedReason: null,
          nextStepText: null,
          text: "Delivered the API",
        },
      },
    };

    expect(() =>
      promoteItemTransition({ ...item, workflowStatus: "done" }),
    ).toThrow(LeadFormConstraintError);
    expect(() =>
      promoteItemTransition({ ...item, nextStepText: " ".repeat(3) }),
    ).toThrow(LeadFormConstraintError);
    expect(() => promoteItemTransition(cancelled)).toThrow(
      LeadFormConstraintError,
    );
    expect(promoted).not.toThrow();
  });
});
