/// <reference lib="dom" />
// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { hung } from "./press.ts";
import type { ProbedControl } from "./probe.ts";
import { testContext } from "./test-context.fixture.ts";

const target = {
  key: "/fixture",
  url: "http://127.0.0.1:50123/fixture",
  shotBase: "fixture",
};
const control = { name: "Inspect health", tag: "button" } as ProbedControl;

// C4184 (TASK-503.09): a cause whose first line is empty must not erase the press-hung diagnostic.
describe("press hung reason", () => {
  it.each([
    ["empty cause", "", "press failed without a message"],
    ["empty leading line", "\nnavigation timed out", "navigation timed out"],
  ])("keeps a diagnostic for an %s", (_name, cause, expected) => {
    const ctx = testContext();
    const step = hung(ctx, target, control, cause);
    expect(step.reason).toBe(expected);
    expect(ctx.findings.at(-1)?.detail).toBe(`Inspect health: ${expected}`);
  });

  it("keeps the first line of a normal multi-line cause", () => {
    const step = hung(testContext(), target, control, "PRIMARY timeout\nstack");
    expect(step.reason).toBe("PRIMARY timeout");
  });
});
