import { describe, expect, it } from "vitest";

import { parseAiDriverReport } from "./driver-results.ts";
import { cell, report, SOURCE_SHA } from "./import-ai-driver-test-fixtures.ts";

describe("native driver timestamp contract", () => {
  it.each([
    ["report start", { startedAt: "2026-08-05 00:00:00" }],
    ["report end", { endedAt: "2026-08-05" }],
  ] as const)("rejects a non-ISO %s timestamp", (_label, override) => {
    const value = report();
    expect(() =>
      parseAiDriverReport(
        JSON.stringify({
          ...value,
          timeline: { ...value.timeline, ...override },
        }),
        {
          sourceSha: SOURCE_SHA,
          profile: "minimal",
          role: "lead",
          cells: [cell()],
        },
      ),
    ).toThrow();
  });
});
