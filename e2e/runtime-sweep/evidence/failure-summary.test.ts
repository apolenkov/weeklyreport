import { describe, expect, it } from "vitest";

import {
  compactFailedCellSummary,
  compactFailureSummary,
} from "./failure-summary.ts";

describe("runtime failure summaries", () => {
  it("keeps failed-cell assertions bounded while retaining IDs and reasons", () => {
    const summary = compactFailedCellSummary([
      { cellId: "cell-a", verdict: "fail", reasons: ["axe: contrast"] },
      {
        cellId: "cell-b",
        verdict: "blocked",
        reasons: ["control: Submit did not settle"],
      },
      ...Array.from({ length: 100 }, (_, index) => ({
        cellId: `cell-${index + 2}`,
        verdict: "fail",
        reasons: ["x".repeat(100_000)],
      })),
    ]);

    expect(summary).toContain("cell-a");
    expect(summary).toContain("axe: contrast");
    expect(summary.length).toBeLessThanOrEqual(4096);
  });

  it("bounds arbitrary issue output before assertion formatting", () => {
    const summary = compactFailureSummary([
      `issue-a: ${"x".repeat(100_000)}`,
      ...Array.from({ length: 100 }, (_, index) => `issue-${index + 1}`),
    ]);

    expect(summary).toContain("issue-a");
    expect(summary.length).toBeLessThanOrEqual(4096);
  });

  it("does not list navigation scaffold controls as failed causes", () => {
    const summary = compactFailedCellSummary([
      {
        cellId: "cell-scaffold",
        verdict: "fail",
        action: {
          controlKey: "button:Target:1",
          operation: "click",
          safety: "read-only",
          transition: "none",
        },
        controls: [
          {
            controlKey: "button:Continue:1",
            cellId: "cell-scaffold",
            ariaRole: "button",
            accessibleName: "Continue",
            enabled: true,
            order: 0,
            actionResult: {
              kind: "not-exercised",
              policy: "unavailable",
              reason:
                "Navigation-only matrix scaffold; live-control lane must execute each DOM control",
            },
          },
        ],
        evidence: {
          before: [],
          action: [],
          after: [],
          observations: [],
          inapplicable: [],
        },
      },
    ]);

    expect(summary).toContain("cell-scaffold");
    expect(summary).toContain("no failure reason recorded");
    expect(summary).not.toContain("button:Continue");
  });

  it("retains the frozen target when its scaffold reason is the actual failure", () => {
    const summary = compactFailedCellSummary([
      {
        cellId: "cell-target",
        verdict: "fail",
        action: {
          controlKey: "button:Continue:1",
          operation: "click",
          safety: "read-only",
          transition: "none",
        },
        controls: [
          {
            controlKey: "button:Continue:1",
            cellId: "cell-target",
            ariaRole: "button",
            accessibleName: "Continue",
            enabled: true,
            order: 0,
            actionResult: {
              kind: "not-exercised",
              policy: "unavailable",
              reason:
                "Navigation-only matrix scaffold; live-control lane must execute each DOM control",
            },
          },
          {
            controlKey: "button:Other:1",
            cellId: "cell-target",
            ariaRole: "button",
            accessibleName: "Other",
            enabled: true,
            order: 1,
            actionResult: {
              kind: "not-exercised",
              policy: "unavailable",
              reason:
                "Navigation-only matrix scaffold; live-control lane must execute each DOM control",
            },
          },
        ],
        evidence: {
          before: [],
          action: [],
          after: [],
          observations: [],
          inapplicable: [],
        },
      },
    ]);

    expect(summary).toContain("button:Continue");
    expect(summary).not.toContain("button:Other");
  });

  it("names a failed exercised target without blaming disabled controls", () => {
    const summary = compactFailedCellSummary([
      {
        cellId: "cell-delete",
        verdict: "fail",
        action: {
          controlKey: "button:Delete:1",
          operation: "delete",
          safety: "irreversible",
          transition: "delete",
        },
        controls: [
          {
            controlKey: "button:Delete:1",
            cellId: "cell-delete",
            ariaRole: "button",
            accessibleName: "Delete",
            enabled: true,
            order: 1,
            actionResult: {
              kind: "exercised",
              result: "fail",
              evidenceIds: ["action-proof"],
            },
          },
          {
            controlKey: "button:Theme:1",
            cellId: "cell-delete",
            ariaRole: "button",
            accessibleName: "Theme selection is coming soon",
            enabled: false,
            order: 2,
            actionResult: {
              kind: "not-exercised",
              policy: "unavailable",
              reason: "Control is disabled",
            },
          },
        ],
        evidence: {
          before: [],
          action: [],
          after: [],
          observations: [],
          inapplicable: [],
        },
      },
    ]);

    expect(summary).toContain("button:Delete:1: exercised action failed");
    expect(summary).not.toContain("Theme");
  });
});
