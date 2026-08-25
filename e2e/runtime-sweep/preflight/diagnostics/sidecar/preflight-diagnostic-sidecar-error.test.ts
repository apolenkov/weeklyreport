import { describe, expect, it } from "vitest";

import {
  diagnosticFailureFor,
  selectDiagnosticPrimaryError,
} from "./preflight-diagnostic-sidecar.ts";

describe("diagnostic sidecar secondary errors", () => {
  it("keeps the original failure unchanged when the sidecar is healthy", () => {
    const original = new Error("Target crashed");

    expect(diagnosticFailureFor(original, undefined)).toBe(original);
    expect(original.cause).toBeUndefined();
  });

  it("returns a sidecar failure when no primary failure exists", () => {
    const secondary = new Error("sidecar overflow");

    expect(diagnosticFailureFor(undefined, secondary)).toBe(secondary);
  });

  it("keeps an original Playwright error primary over sidecar failure", () => {
    const original = new Error("Target crashed");
    const secondary = new Error("sidecar overflow");
    const primary = selectDiagnosticPrimaryError(original, secondary);
    expect(primary).toBe(original);
    expect(primary.message).toBe("Target crashed");
    expect(primary.stack).toBe(original.stack);
    expect(primary.cause).toEqual({
      name: secondary.name,
      message: secondary.message,
      stack: secondary.stack?.slice(0, 512),
    });
    expect(selectDiagnosticPrimaryError(undefined, secondary)).toBe(secondary);
  });

  it("does not overwrite an existing error cause", () => {
    const original = new Error("Target crashed");
    const existingCause = new Error("existing cause");
    original.cause = existingCause;

    const primary = selectDiagnosticPrimaryError(
      original,
      new Error("sidecar overflow"),
    );

    expect(primary).toBe(original);
    expect(primary.cause).toBe(existingCause);
  });

  it("keeps a frozen original error primary", () => {
    const original = Object.freeze(new Error("Target crashed"));
    const primary = selectDiagnosticPrimaryError(
      original,
      new Error("sidecar overflow"),
    );

    expect(primary).toBe(original);
    expect(primary.message).toBe("Target crashed");
  });
});
