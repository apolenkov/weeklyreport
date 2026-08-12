import { describe, expect, it } from "vitest";

import {
  actionSchema,
  campaignManifestSchema,
  coverageCellSchema,
  dispositionSchema,
  domControlSchema,
  evidenceKindSchema,
  matrixExecutionSchema,
  networkEvidencePolicySchema,
  oracleSchema,
  routeDeclarationSchema,
  sourceShaSchema,
  sourceTreeSchema,
} from "./contracts.ts";
import { manifest } from "./contracts-fixture.ts";

describe("runtime sweep boundary contracts", () => {
  it("rejects malformed and uppercase source SHAs", () => {
    expect(sourceShaSchema.safeParse("a".repeat(39)).success).toBe(false);
    expect(sourceShaSchema.safeParse("A".repeat(40)).success).toBe(false);
    expect(sourceShaSchema.safeParse("a".repeat(40)).success).toBe(true);
  });

  it("requires a raw lowercase 40-hex source tree object ID", () => {
    expect(sourceTreeSchema.safeParse("b".repeat(39)).success).toBe(false);
    expect(sourceTreeSchema.safeParse("B".repeat(40)).success).toBe(false);
    expect(sourceTreeSchema.safeParse("b".repeat(64)).success).toBe(false);
    expect(sourceTreeSchema.safeParse("b".repeat(40)).success).toBe(true);
    expect(
      campaignManifestSchema.safeParse({
        ...manifest,
        sourceTree: undefined,
      }).success,
    ).toBe(false);
  });

  it("rejects unknown fields instead of silently widening a manifest", () => {
    expect(campaignManifestSchema.safeParse(manifest).success).toBe(true);
    const result = campaignManifestSchema.safeParse({
      ...manifest,
      unexpected: true,
    });
    expect(result.success).toBe(false);
  });

  it("requires an explicit route network policy", () => {
    const firstRoute = manifest.routes[0];
    if (firstRoute === undefined) throw new Error("Fixture route is missing");
    const { networkPolicy: _networkPolicy, ...withoutPolicy } = firstRoute;
    expect(routeDeclarationSchema.safeParse(withoutPolicy).success).toBe(false);
    expect(routeDeclarationSchema.safeParse(firstRoute).success).toBe(true);
    expect(
      networkEvidencePolicySchema.safeParse({
        maxRepeatedApiRequests: 3,
        retryStormThreshold: 5,
        slowRequestThresholdMs: 5000,
        cacheExpectedOperations: ["report.get", "report.get"],
      }).success,
    ).toBe(false);
    expect(
      networkEvidencePolicySchema.safeParse({
        maxRepeatedApiRequests: 0,
        retryStormThreshold: 5,
        slowRequestThresholdMs: 5000,
        cacheExpectedOperations: [],
      }).success,
    ).toBe(false);
    expect(
      networkEvidencePolicySchema.safeParse({
        maxRepeatedApiRequests: 3,
        retryStormThreshold: 5,
        slowRequestThresholdMs: 5000,
        cacheExpectedOperations: [" ".repeat(3)],
      }).success,
    ).toBe(false);
  });

  it("accepts driver reports as a distinct evidence kind", () => {
    expect(evidenceKindSchema.safeParse("driver-report").success).toBe(true);
  });

  it("requires an explicit runtime oracle dimension", () => {
    const completeOracle = {
      domainSpecRefs: ["exhaustive-runtime-sweep"],
      function: { required: true, expectation: "the action succeeds" },
      accessibility: { required: true, expectation: "status is announced" },
      visual: { required: true, expectation: "settled screenshot matches" },
      runtime: { required: true, expectation: "runtime telemetry is clean" },
    };
    expect(oracleSchema.safeParse(completeOracle).success).toBe(true);
    const { runtime: _runtime, ...withoutRuntime } = completeOracle;
    expect(oracleSchema.safeParse(withoutRuntime).success).toBe(false);
  });

  it("keeps role and profile values closed at the cell boundary", () => {
    const result = coverageCellSchema.safeParse({
      cellId: "cell",
      sourceSha: "a".repeat(40),
      profile: "production",
      role: "operator",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing action result and incomplete fixed disposition", () => {
    const control = domControlSchema.safeParse({
      controlKey: "save",
      cellId: "cell",
      ariaRole: "button",
      accessibleName: "Save",
      enabled: true,
      order: 0,
    });
    const disposition = dispositionSchema.safeParse({
      status: "fixed",
      candidateId: "candidate",
      cellId: "cell",
      sourceSha: "a".repeat(40),
      verifierRefs: ["verifier"],
      evidence: [],
      findingRef: "finding",
      rationale: "fixed",
    });
    expect(control.success).toBe(false);
    expect(disposition.success).toBe(false);
  });
});

describe("runtime sweep execution contracts", () => {
  it("accepts each declared execution lane with one bounded work item", () => {
    const action = {
      controlKey: "publish",
      operation: "publish" as const,
      safety: "irreversible" as const,
      transition: "publish" as const,
    };
    const observation = { observationId: "settled", kind: "api" as const };
    const executions = [
      {
        kind: "navigation" as const,
        action: {
          ...action,
          operation: "navigate" as const,
          safety: "read-only" as const,
          transition: "none" as const,
        },
      },
      { kind: "idle" as const, observation },
      { kind: "control" as const, action },
      {
        kind: "recovery" as const,
        action: {
          ...action,
          operation: "retry" as const,
          safety: "reversible" as const,
          transition: "retry" as const,
        },
        faultId: "publish-http-5xx",
      },
      { kind: "fault" as const, action, faultId: "publish-http-5xx" },
      { kind: "concurrency" as const, action, faultId: "period-stale-version" },
      {
        kind: "infrastructure" as const,
        observation,
        faultId: "redis-unavailable",
      },
    ];

    executions.forEach((execution) => {
      expect(matrixExecutionSchema.safeParse(execution).success).toBe(true);
    });
  });

  it("rejects an unsupported execution kind and more than one bounded item", () => {
    const action = {
      controlKey: "open",
      operation: "click" as const,
      safety: "read-only" as const,
      transition: "open" as const,
    };
    expect(
      matrixExecutionSchema.safeParse({
        kind: "unsupported",
        action,
      }).success,
    ).toBe(false);
    expect(
      matrixExecutionSchema.safeParse({
        kind: "control",
        action,
        observation: { observationId: "settled", kind: "geometry" },
      }).success,
    ).toBe(false);
  });

  it("allows a stable link target only for click actions", () => {
    const target = { role: "link" as const, href: "/reports/stable" };
    const base = {
      controlKey: "link:Report:1",
      safety: "read-only" as const,
      transition: "none" as const,
    };
    expect(
      actionSchema.safeParse({ ...base, operation: "click", target }).success,
    ).toBe(true);
    expect(
      actionSchema.safeParse({ ...base, operation: "fill", target }).success,
    ).toBe(false);
  });
});
