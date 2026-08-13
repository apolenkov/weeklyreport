import { describe, expect, it } from "vitest";

import {
  generateProductVariantManifest,
  validateProductVariantManifest,
} from "./product-variant-manifest.ts";
import { readProductVariantSource } from "./product-variant-source.ts";

const repoRoot = new URL("../../", import.meta.url).pathname.replace(
  /\/$/u,
  "",
);

const copyOf = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

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
      roleRouteCount: source.routes.length,
      intentCount: source.routes.reduce(
        (count, route) => count + route.intentIds.length,
        0,
      ),
      routeVariantCount: source.routes.length,
      declaredControlVariantCount: source.declaredControlFamilies.length,
      revealFamilyVariantCount: source.revealFamilies.length,
      totalVariantCount:
        source.routes.length +
        source.declaredControlFamilies.length +
        source.revealFamilies.length,
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
