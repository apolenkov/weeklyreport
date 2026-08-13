import { createHash } from "node:crypto";

import { type ProductVariantManifest } from "./product-variant-schema.ts";
import {
  type ProductVariantCatalog,
  type ProductVariantSource,
  type ProductVariantSourceFile,
} from "./product-variant-source.ts";

export const stableSerialize = (value: unknown): string => {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (typeof value !== "object")
    throw new TypeError(`Unsupported digest value: ${typeof value}`);
  return `{${Object.entries(value)
    .filter(([, entry]) => entry !== undefined)
    .toSorted(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableSerialize(entry)}`)
    .join(",")}}`;
};

export const digest = (value: unknown): string =>
  createHash("sha256").update(stableSerialize(value), "utf8").digest("hex");

export const sourceFileIdentity = (
  file: ProductVariantSourceFile,
): ProductVariantSourceFile => ({
  path: file.path,
  digest: file.digest,
});

export const routeKey = (role: string, route: string): string =>
  `${role}:${route}`;

export const catalogDigestFor = (
  catalogs: readonly ProductVariantCatalog[],
): string =>
  digest(
    catalogs
      .map(({ path: catalogPath, role, digest: catalogFileDigest }) => ({
        path: catalogPath,
        role,
        digest: catalogFileDigest,
      }))
      .toSorted((left, right) => left.path.localeCompare(right.path)),
  );

export const sourceDigestFor = (source: ProductVariantSource): string =>
  digest({
    sourceSha: source.sourceSha,
    sourceTree: source.sourceTree,
    sourceFiles: source.sourceFiles.map(sourceFileIdentity),
    catalogs: source.catalogs,
    routes: source.routes,
    profiles: source.profiles,
    declaredControlFamilies: source.declaredControlFamilies,
    revealFamilies: source.revealFamilies,
  });

export const manifestBodyForDigest = (
  manifest: ProductVariantManifest,
): Omit<ProductVariantManifest, "generatedAt" | "manifestDigest"> => {
  const {
    generatedAt: _generatedAt,
    manifestDigest: _manifestDigest,
    ...body
  } = manifest;
  return body;
};

export const manifestDigestFor = (manifest: ProductVariantManifest): string =>
  digest(manifestBodyForDigest(manifest));

export const manifestIdentityBodyForComparison = (
  manifest: ProductVariantManifest,
): Omit<ProductVariantManifest, "generatedAt" | "manifestDigest"> =>
  manifestBodyForDigest(manifest);
