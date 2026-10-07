import { describe, expect, it } from "vitest";

import { renderMarkdown } from "./report.ts";
import type { StepRecord } from "./types.ts";
function report(values: readonly (number | null)[]) {
  const steps: StepRecord[] = values.map((responseMs, index) => ({
    name: `Action ${index}`,
    tag: "button",
    action: "pressed",
    reason: null,
    urlChanged: false,
    stateChanged: false,
    restoredBy: "none",
    responseMs,
    shot: null,
  }));
  return renderMarkdown(
    {
      url: "http://127.0.0.1:50123",
      wallMs: 0,
      started: "fixture",
      parallel: 1,
    },
    [
      {
        role: "lead",
        ms: 0,
        runs: [
          {
            role: "lead",
            width: 1280,
            ms: 0,
            video: null,
            pages: [
              {
                url: "http://127.0.0.1:50123/fixture",
                key: "/fixture",
                loadMs: 0,
                shot: null,
                controlsFound: steps.length,
                axeViolations: 0,
                geometryIssues: 0,
                steps,
              },
            ],
            findings: [],
          },
        ],
      },
    ],
  );
}
describe("crawler response statistics", () => {
  it("reports empty observations as not measured with sample count", () => {
    expect(report([null])).toContain("not measured (n=0)");
  });
  it("uses nearest rank for twenty measured responses", () => {
    expect(
      report(Array.from({ length: 20 }, (_, index) => index + 1)),
    ).toContain("19 ms (n=20)");
  });
  it("keeps actual zero while excluding unavailable responses", () => {
    expect(report([null, 0, null])).toContain("0 ms (n=1)");
    expect(report([7])).toContain("7 ms (n=1)");
  });
});
