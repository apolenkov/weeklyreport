import { describe, expect, it } from "vitest";

import {
  actionSchema,
  campaignManifestSchema,
  coverageCellSchema,
  dispositionSchema,
  domControlSchema,
  evidenceKindSchema,
  matrixExecutionSchema,
  sourceShaSchema,
} from "./contracts.ts";

const manifest = {
  campaignId: "campaign",
  sourceSha: "a".repeat(40),
  treeDigest: "b".repeat(64),
  browser: "chromium",
  viewport: { browser: "chromium", width: 1440, height: 900 },
  roles: ["lead", "head", "admin", "viewer"],
  routes: [
    { role: "lead", catalogRoute: "/lead", resolvedRoute: "/lead" },
    { role: "head", catalogRoute: "/head", resolvedRoute: "/head" },
    { role: "admin", catalogRoute: "/admin", resolvedRoute: "/admin" },
    {
      role: "viewer",
      catalogRoute: "/reports",
      resolvedRoute: "/reports",
    },
  ],
  profiles: ["minimal", "demo", "full", "stress"],
  seedProfiles: ["minimal", "demo", "full", "stress"].map((profile) => ({
    profile,
    definition: {
      purpose: "fixture",
      capabilities: ["canonical-identities"],
      stableIds: { activeReport: "report" },
      counts: {
        users: { min: 1, max: 1 },
        projects: { min: 1, max: 1 },
        reports: { min: 1, max: 1 },
        sections: { min: 1, max: 1 },
        items: { min: 1, max: 1 },
      },
    },
    digest: "f".repeat(64),
  })),
  stateKinds: ["nominal", "boundary", "lifecycle", "permission", "fault"],
  actions: [
    {
      controlKey: "open",
      operation: "click",
      safety: "read-only",
      transition: "open",
    },
  ],
  toolVersions: { node: "26.0.0" },
  catalogDigest: "c".repeat(64),
  domainSpecDigest: "d".repeat(64),
  matrixDeclaration: {
    generatorSeed: "fixture",
    axes: {
      role: ["lead"],
      route: ["/lead"],
      profileCapability: ["canonical-identities"],
      lifecycle: ["open"],
      submission: ["draft"],
      ownershipDensity: ["single"],
      permission: ["allowed"],
      fault: ["none"],
      controlTransition: ["none"],
    },
    constraints: [],
  },
  matrixDigest: "e".repeat(64),
  exclusions: [
    {
      id: "firefox",
      scope: "browser",
      target: "firefox",
      reason: "fixture",
    },
    { id: "webkit", scope: "browser", target: "webkit", reason: "fixture" },
    {
      id: "mobile",
      scope: "viewport",
      target: "mobile",
      reason: "fixture",
    },
    {
      id: "tablet",
      scope: "viewport",
      target: "tablet",
      reason: "fixture",
    },
  ],
};

describe("runtime sweep boundary contracts", () => {
  it("rejects malformed and uppercase source SHAs", () => {
    expect(sourceShaSchema.safeParse("a".repeat(39)).success).toBe(false);
    expect(sourceShaSchema.safeParse("A".repeat(40)).success).toBe(false);
    expect(sourceShaSchema.safeParse("a".repeat(40)).success).toBe(true);
  });

  it("rejects unknown fields instead of silently widening a manifest", () => {
    expect(campaignManifestSchema.safeParse(manifest).success).toBe(true);
    const result = campaignManifestSchema.safeParse({
      ...manifest,
      unexpected: true,
    });
    expect(result.success).toBe(false);
  });

  it("accepts driver reports as a distinct evidence kind", () => {
    expect(evidenceKindSchema.safeParse("driver-report").success).toBe(true);
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
