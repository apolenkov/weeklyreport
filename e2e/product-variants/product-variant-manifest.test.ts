import { describe, expect, it } from "vitest";

import { manifestDigestFor } from "./product-variant-hash.ts";
import {
  generateProductVariantManifest,
  validateProductVariantManifest,
} from "./product-variant-manifest.ts";
import { HISTORICAL_RECONCILIATION_VARIANT_IDS } from "./product-variant-schema.ts";
import { readProductVariantSource } from "./product-variant-source.ts";

const repoRoot = new URL("../../", import.meta.url).pathname.replace(
  /\/$/u,
  "",
);

const copyOf = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const rehashed = <T extends Parameters<typeof manifestDigestFor>[0]>(
  candidate: T,
): T => ({ ...candidate, manifestDigest: manifestDigestFor(candidate) });

describe("product-variant manifest", () => {
  it("generates a current-source inventory and remains pending review", async () => {
    const source = await readProductVariantSource(repoRoot);
    const manifest = generateProductVariantManifest(
      source,
      "2026-08-13T00:00:00.000Z",
    );
    const validation = validateProductVariantManifest(manifest, source);

    expect(validation).toEqual({
      valid: true,
      status: "PENDING_MANUAL_REVIEW",
      issues: [],
    });
    expect(manifest.summary).toEqual({
      roleRouteCount: 51,
      intentCount: 163,
      routeVariantCount: 51,
      declaredControlVariantCount: 20,
      revealFamilyVariantCount: 6,
      totalVariantCount: 77,
    });
    expect(manifest.historicalReconciliation).toMatchObject({
      status: "PENDING_RECONCILIATION",
      historicalInventory: {
        count: 86,
        variantIds: HISTORICAL_RECONCILIATION_VARIANT_IDS,
      },
      currentInventory: {
        roleRouteCount: 51,
        intentCount: 163,
        variantCount: 77,
      },
      mapping: {
        status: "UNRESOLVED",
        oneToOneMapping: "NOT_ESTABLISHED",
      },
    });
    expect(manifest.historicalReconciliation.source).toMatchObject({
      sourceSha: "765d88da77995d7acea21b9d4977b05d0375d612",
      sourceTree: "961b185a092fdbeba979ee64636d95e3dad79693",
      acceptanceDocument: { name: "MVP-VISUAL-ACCEPTANCE.md" },
      atlasArtifact: { name: "MVP-ATLAS.json" },
      displayMatrix: { name: "DISPLAY-VARIANT-MATRIX.md" },
      closureEvidence: { name: "MVP-DEFERRED-CLOSURE-EVIDENCE.json" },
    });
    expect(
      manifest.variants.every(({ terminal }) => terminal.status !== "PASS"),
    ).toBe(true);
  });

  it("fails closed when a current route is missing", async () => {
    const source = await readProductVariantSource(repoRoot);
    const manifest = generateProductVariantManifest(source);
    const candidate = copyOf(manifest);
    candidate.variants = candidate.variants.slice(1);

    const validation = validateProductVariantManifest(candidate, source);
    expect(validation.valid).toBe(false);
    expect(
      validation.issues.some((issue) =>
        issue.includes("missing route coverage"),
      ),
    ).toBe(true);
  });

  it("keeps manifest identity deterministic when generatedAt changes", async () => {
    const source = await readProductVariantSource(repoRoot);
    const first = generateProductVariantManifest(
      source,
      "2026-08-13T00:00:00.000Z",
    );
    const second = generateProductVariantManifest(
      source,
      "2026-08-14T00:00:00.000Z",
    );

    expect(first.generatedAt).not.toBe(second.generatedAt);
    expect(first.sourceDigest).toBe(second.sourceDigest);
    expect(first.manifestDigest).toBe(second.manifestDigest);
    expect(validateProductVariantManifest(second, source)).toEqual({
      valid: true,
      status: "PENDING_MANUAL_REVIEW",
      issues: [],
    });
  });

  it.each([
    "reordered variants",
    "tampered summary",
    "altered route action and state",
    "duplicate sourceFiles",
    "reordered sourceFiles",
  ] as const)("rejects a recomputed-digest fabrication: %s", async (kind) => {
    const source = await readProductVariantSource(repoRoot);
    const manifest = generateProductVariantManifest(source);
    const candidate = copyOf(manifest);

    if (kind === "reordered variants") {
      candidate.variants = [...candidate.variants].reverse();
    } else if (kind === "tampered summary") {
      candidate.summary = {
        ...candidate.summary,
        totalVariantCount: candidate.summary.totalVariantCount + 1,
      };
    } else if (kind === "altered route action and state") {
      candidate.variants = candidate.variants.map((variant) =>
        variant.kind === "route"
          ? { ...variant, actionVariant: "click", stateVariant: "forged" }
          : variant,
      );
    } else if (kind === "duplicate sourceFiles") {
      const first = candidate.sourceFiles[0];
      if (first === undefined) throw new Error("Manifest has no source files");
      candidate.sourceFiles = [first, ...candidate.sourceFiles];
    } else {
      candidate.sourceFiles = [...candidate.sourceFiles].reverse();
    }

    const validation = validateProductVariantManifest(
      rehashed(candidate),
      source,
    );
    expect(validation.valid).toBe(false);
    expect(validation.issues).toContain(
      "manifest does not match canonical manifest reconstructed from current source",
    );
  });

  it("fails closed on duplicate identity", async () => {
    const source = await readProductVariantSource(repoRoot);
    const manifest = generateProductVariantManifest(source);
    const candidate = copyOf(manifest);
    const first = candidate.variants[0];
    if (first === undefined)
      throw new Error("Generated manifest has no variants");
    candidate.variants = [first, ...candidate.variants];

    const validation = validateProductVariantManifest(candidate, source);
    expect(validation.valid).toBe(false);
    expect(validation.issues).toContain("duplicate variant identity: id");
    expect(validation.issues).toContain(
      "duplicate variant identity: identityKey",
    );
  });

  it("fails closed on a stale catalog digest", async () => {
    const source = await readProductVariantSource(repoRoot);
    const manifest = generateProductVariantManifest(source);
    const candidate = copyOf(manifest);
    const firstCatalog = candidate.catalogs[0];
    if (firstCatalog === undefined)
      throw new Error("Generated manifest has no catalogs");
    candidate.catalogs = candidate.catalogs.map((catalog, index) =>
      index === 0 ? { ...catalog, digest: "0".repeat(64) } : catalog,
    );

    const validation = validateProductVariantManifest(candidate, source);
    expect(validation.valid).toBe(false);
    expect(validation.issues).toContain(
      `stale catalog digest: ${firstCatalog.path}`,
    );
  });

  it("fails closed when an evidence policy is removed", async () => {
    const source = await readProductVariantSource(repoRoot);
    const manifest = generateProductVariantManifest(source);
    const candidate = copyOf(manifest);
    candidate.variants = candidate.variants.map((variant, index) =>
      index === 0
        ? {
            ...variant,
            evidencePolicy: {
              ...variant.evidencePolicy,
              manualVisualReviewRequired: false,
            },
          }
        : variant,
    );

    const validation = validateProductVariantManifest(candidate, source);
    expect(validation.valid).toBe(false);
    expect(
      validation.issues.some((issue) =>
        issue.includes("no manual visual evidence policy"),
      ),
    ).toBe(true);
  });

  it("rejects PASS without required read-back and manual review evidence", async () => {
    const source = await readProductVariantSource(repoRoot);
    const manifest = generateProductVariantManifest(source);
    const candidate = copyOf(manifest);
    const stateful = candidate.variants.find(
      ({ evidencePolicy }) => evidencePolicy.statefulReadBackRequired,
    );
    if (stateful === undefined)
      throw new Error("Generated manifest has no stateful variant");
    candidate.variants = candidate.variants.map((variant) =>
      variant.id === stateful.id
        ? {
            ...variant,
            terminal: { ...variant.terminal, status: "PASS" as const },
          }
        : variant,
    );

    const validation = validateProductVariantManifest(candidate, source);
    expect(validation.valid).toBe(false);
    expect(
      validation.issues.some((issue) =>
        issue.includes("requires accepted manual visual review"),
      ),
    ).toBe(true);
    expect(
      validation.issues.some((issue) =>
        issue.includes("requires stateful read-back evidence"),
      ),
    ).toBe(true);
  });
});
