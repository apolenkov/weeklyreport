import { describe, expect, it } from "vitest";

import { countRuns, differences } from "./compare.ts";
import type { PageRecord, RoleResult, StepRecord } from "./types.ts";

function step(action: StepRecord["action"], reason: string | null): StepRecord {
  return {
    name: "x",
    tag: "button",
    action,
    reason,
    urlChanged: false,
    stateChanged: false,
    restoredBy: "none",
    responseMs: null,
    shot: null,
  };
}

function report(steps: readonly StepRecord[]): { results: RoleResult[] } {
  const page = { key: "/p", steps } as unknown as PageRecord;
  return {
    results: [
      {
        role: "lead",
        ms: 1,
        runs: [
          {
            role: "lead",
            width: 375,
            ms: 1,
            video: "",
            findings: [],
            pages: [page],
          },
        ],
      },
    ],
  };
}

describe("run comparison", () => {
  const pressed = step("pressed", null);

  it("counts presses and gone controls per role and width", () => {
    const counts = countRuns(
      report([
        pressed,
        step("skipped", "gone: an earlier press changed the view"),
      ]),
    );
    expect(counts.get("lead@375")).toMatchObject({
      pressed: 1,
      skipped: 1,
      gone: 1,
    });
  });

  it("reports nothing for equal runs and names the page that differs", () => {
    const one = countRuns(report([pressed, pressed]));
    expect(differences(one, countRuns(report([pressed, pressed])))).toEqual([]);
    expect(differences(one, countRuns(report([pressed])))).toEqual([
      "lead@375: pressed 2 vs 1, gone 0 vs 0",
      "  /p: 2 vs 1",
    ]);
  });
});
