import type {
  ReportSectionReadModel,
  ResolvePlanInput,
} from "@customreport/shared";
import { describe, expect, it } from "vitest";

import {
  resolveItemTransition,
  restoreItemTransition,
} from "./item-outcome-transition.js";

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
    });
    expect(item.nextStepText).toBe("Validate the integration");
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
});
