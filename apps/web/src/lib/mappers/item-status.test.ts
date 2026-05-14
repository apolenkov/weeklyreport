import { describe, expect, it } from "vitest";

import {
  deriveItemStatus,
  itemStatusToWorkflow,
  workflowToItemStatus,
} from "./item-status";

describe("workflowToItemStatus", () => {
  it("maps 'done' to 'completed'", () => {
    expect(workflowToItemStatus("done")).toBe("completed");
  });

  it("maps 'in_progress' to 'in-progress'", () => {
    expect(workflowToItemStatus("in_progress")).toBe("in-progress");
  });

  it("maps 'blocked' to 'blocked'", () => {
    expect(workflowToItemStatus("blocked")).toBe("blocked");
  });
});

describe("itemStatusToWorkflow", () => {
  it("maps 'completed' to 'done'", () => {
    expect(itemStatusToWorkflow("completed")).toBe("done");
  });

  it("maps 'in-progress' to 'in_progress'", () => {
    expect(itemStatusToWorkflow("in-progress")).toBe("in_progress");
  });

  it("maps 'blocked' to 'blocked'", () => {
    expect(itemStatusToWorkflow("blocked")).toBe("blocked");
  });
});

describe("deriveItemStatus", () => {
  it("returns 'completed' for current item with workflowStatus 'done'", () => {
    expect(deriveItemStatus({ workflowStatus: "done", type: "current" })).toBe(
      "completed",
    );
  });

  it("computes 'planned' for a next-week item with no workflowStatus", () => {
    expect(deriveItemStatus({ workflowStatus: null, type: "next" })).toBe(
      "planned",
    );
  });

  it("computes 'planned' for next-week in_progress with completed null", () => {
    expect(
      deriveItemStatus({
        workflowStatus: "in_progress",
        type: "next",
        completed: null,
      }),
    ).toBe("planned");
  });

  it("preserves explicit in-progress for next-week completed false", () => {
    expect(
      deriveItemStatus({
        workflowStatus: "in_progress",
        type: "next",
        completed: false,
      }),
    ).toBe("in-progress");
  });

  it("preserves blocked for next-week items", () => {
    expect(deriveItemStatus({ workflowStatus: "blocked", type: "next" })).toBe(
      "blocked",
    );
  });

  it("preserves completed for next-week items", () => {
    expect(deriveItemStatus({ workflowStatus: "done", type: "next" })).toBe(
      "completed",
    );
  });

  it("returns 'in-progress' for current-week item with no workflowStatus", () => {
    expect(deriveItemStatus({ workflowStatus: null, type: "current" })).toBe(
      "in-progress",
    );
  });
});
