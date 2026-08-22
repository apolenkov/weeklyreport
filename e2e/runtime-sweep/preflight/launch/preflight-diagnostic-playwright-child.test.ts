import { describe, expect, it } from "vitest";

import {
  buildPreflightDiagnosticPlaywrightArguments,
  diagnosticTraceModeFromEnvironment,
} from "./preflight-diagnostic-playwright-child.ts";

const BASE_ARGUMENTS = [
  "--filter",
  "@customreport/web",
  "exec",
  "playwright",
  "test",
  "--config",
  "../../e2e/runtime-sweep/preflight/playwright.diagnostic.config.ts",
] as const;

describe("diagnostic Playwright child trace boundary", () => {
  it("keeps the default launch argv unchanged", () => {
    expect(diagnosticTraceModeFromEnvironment({})).toBe("retain-on-failure");
    expect(
      buildPreflightDiagnosticPlaywrightArguments("retain-on-failure"),
    ).toEqual(BASE_ARGUMENTS);
  });

  it("appends the exact trace-off override for the causal control", () => {
    expect(buildPreflightDiagnosticPlaywrightArguments("off")).toEqual([
      ...BASE_ARGUMENTS,
      "--trace",
      "off",
    ]);
    expect(
      diagnosticTraceModeFromEnvironment({
        RUNTIME_SWEEP_DIAGNOSTIC_TRACE_MODE: "off",
      }),
    ).toBe("off");
  });

  it("rejects unsupported trace modes before spawning a child", () => {
    expect(() =>
      diagnosticTraceModeFromEnvironment({
        RUNTIME_SWEEP_DIAGNOSTIC_TRACE_MODE: "on",
      }),
    ).toThrow(/retain-on-failure.*off/u);
  });
});
