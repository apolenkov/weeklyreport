import { describe, expect, it } from "vitest";

import {
  campaignManifestSchema,
  coverageCellSchema,
  dispositionSchema,
  domControlSchema,
  sourceShaSchema,
} from "./contracts.ts";

describe("runtime sweep boundary contracts", () => {
  it("rejects malformed and uppercase source SHAs", () => {
    expect(sourceShaSchema.safeParse("a".repeat(39)).success).toBe(false);
    expect(sourceShaSchema.safeParse("A".repeat(40)).success).toBe(false);
    expect(sourceShaSchema.safeParse("a".repeat(40)).success).toBe(true);
  });

  it("rejects unknown fields instead of silently widening a manifest", () => {
    const result = campaignManifestSchema.safeParse({
      campaignId: "campaign",
      sourceSha: "a".repeat(40),
      treeDigest: "b".repeat(64),
      browser: "chromium",
      viewport: { browser: "chromium", width: 1440, height: 900 },
      roles: ["lead"],
      routes: [{ role: "lead", catalogRoute: "/", resolvedRoute: "/" }],
      profiles: ["minimal"],
      stateKinds: ["nominal"],
      actions: [
        {
          controlKey: "open",
          operation: "click",
          safety: "read-only",
          transition: "open",
        },
      ],
      catalogDigest: "c".repeat(64),
      domainSpecDigest: "d".repeat(64),
      matrixDigest: "e".repeat(64),
      exclusions: [],
      unexpected: true,
    });
    expect(result.success).toBe(false);
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
