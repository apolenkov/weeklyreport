import { describe, expect, it } from "vitest";

import type { StateAxes } from "../../source/contracts.ts";
import {
  assertLegalMatrixRow,
  matrixExecutionPolicyInputSchema,
  validateLegalMatrixRow,
} from "./matrix-execution-policy.ts";

const stateFor = (
  fault: StateAxes["fault"] = "none",
  controlTransition: StateAxes["controlTransition"] = "none",
): StateAxes => ({
  profileCapability: "canonical-identities",
  lifecycle: "open",
  submission: "draft",
  ownershipDensity: "single",
  permission: "allowed",
  fault,
  controlTransition,
});

const clickAction = (transition: StateAxes["controlTransition"] = "none") => ({
  controlKey: "open",
  operation: "click" as const,
  safety: "read-only" as const,
  transition,
});

const validObservation = {
  observationId: "settled",
  kind: "api" as const,
};

describe("matrix execution policy representative rows", () => {
  it("accepts representative navigation, idle, control, recovery, fault, concurrency, and infrastructure rows", () => {
    const rows = [
      {
        state: stateFor(),
        execution: {
          kind: "navigation" as const,
          action: {
            controlKey: "route:/reports",
            operation: "navigate" as const,
            safety: "read-only" as const,
            transition: "none" as const,
          },
        },
      },
      {
        state: stateFor("none", "idle"),
        execution: { kind: "idle" as const, observation: validObservation },
      },
      {
        state: stateFor("none", "open"),
        execution: { kind: "control" as const, action: clickAction("open") },
      },
      {
        state: stateFor("network-timeout", "retry"),
        execution: {
          kind: "recovery" as const,
          action: {
            controlKey: "retry",
            operation: "retry" as const,
            safety: "reversible" as const,
            transition: "retry" as const,
          },
          faultId: "publish-network-timeout",
        },
      },
      {
        state: stateFor("http-5xx", "publish"),
        execution: {
          kind: "fault" as const,
          action: { ...clickAction("publish"), operation: "publish" as const },
          faultId: "publish-http-5xx",
        },
      },
      {
        state: stateFor("concurrency-stale-version"),
        execution: {
          kind: "concurrency" as const,
          action: clickAction(),
          faultId: "period-stale-version",
        },
      },
      {
        state: stateFor("infrastructure-unavailable"),
        execution: {
          kind: "infrastructure" as const,
          observation: validObservation,
          faultId: "rate-limit-redis-unavailable",
        },
      },
    ];

    rows.forEach((row) => {
      expect(validateLegalMatrixRow(row)).toEqual({ ok: true, row });
    });
  });
});

describe("matrix execution policy transition validation", () => {
  it("rejects a transition/action mismatch", () => {
    const result = validateLegalMatrixRow({
      state: stateFor("none", "publish"),
      execution: {
        kind: "control",
        action: clickAction("none"),
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0]?.code).toBe("transition-mismatch");
  });
});

describe("matrix execution policy fault validation", () => {
  it("rejects a specialized fault without a stable fault id", () => {
    const result = validateLegalMatrixRow({
      state: stateFor("http-5xx", "publish"),
      execution: {
        kind: "fault",
        action: { ...clickAction("publish"), operation: "publish" },
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0]?.code).toBe("missing-fault-id");
  });
});

describe("matrix execution policy none-fault validation", () => {
  it("rejects a fabricated none fault witness", () => {
    const result = validateLegalMatrixRow({
      state: stateFor("none", "publish"),
      execution: {
        kind: "fault",
        action: { ...clickAction("publish"), operation: "publish" },
        faultId: "publish-http-5xx",
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0]?.code).toBe("fabricated-fault");
  });
});

describe("matrix execution policy applicability validation", () => {
  it("rejects unsupported execution kinds and unreasoned inapplicability", () => {
    expect(
      validateLegalMatrixRow({
        state: stateFor(),
        execution: { kind: "unsupported", action: clickAction() },
      }).ok,
    ).toBe(false);
    expect(
      matrixExecutionPolicyInputSchema.safeParse({
        state: stateFor(),
        inapplicable: { constraintId: "", reason: "" },
      }).success,
    ).toBe(false);
    expect(
      validateLegalMatrixRow({
        state: stateFor(),
        inapplicable: {
          constraintId: "profile-capability-boundary",
          reason: "not available",
        },
      }).ok,
    ).toBe(true);
  });
});

describe("matrix execution policy errors", () => {
  it("throws a typed policy error for an invalid row", () => {
    expect(() =>
      assertLegalMatrixRow({
        state: stateFor("http-5xx", "publish"),
        execution: {
          kind: "fault",
          action: { ...clickAction("none"), operation: "publish" },
        },
      }),
    ).toThrow("missing-fault-id");
  });
});
