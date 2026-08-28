import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import * as path from "node:path";

import { appRouterRouteForPage } from "../helpers/app-router-route.ts";
import {
  CANONICAL_ROLES,
  parseCatalog,
  type Role,
} from "../sweep/catalog-parser.ts";

export const CURRENT_PRODUCT_VARIANT_SOURCE_PATHS = [
  "e2e/runtime-sweep/replay/control-actions/control-action-roles.ts",
  "e2e/runtime-sweep/replay/control-actions/control-action-policy.ts",
  "e2e/runtime-sweep/replay/live-control/live-control-planning.ts",
  "e2e/runtime-sweep/preflight/reveal/interaction/preflight-reveal-transition.ts",
  "e2e/runtime-sweep/source/contracts.ts",
] as const;

export const CURRENT_CATALOG_ROLES = CANONICAL_ROLES;
export type ProductVariantRole = Role;

export type ProductVariantSourceFile = Readonly<{
  readonly path: string;
  readonly digest: string;
}>;

type ProductVariantCatalogRoute = Readonly<{
  readonly route: string;
  readonly access: readonly Role[];
  readonly landing?: string | undefined;
  readonly intentIds: readonly string[];
  readonly digest: string;
}>;

export type ProductVariantCatalog = Readonly<{
  readonly path: string;
  readonly role: ProductVariantRole;
  readonly digest: string;
  readonly routes: readonly ProductVariantCatalogRoute[];
}>;

export type ProductVariantRoute = Readonly<{
  readonly role: ProductVariantRole;
  readonly route: string;
  readonly sourcePath: string;
  readonly sourceDigest: string;
  readonly catalogPath: string;
  readonly catalogDigest: string;
  readonly catalogRouteDigest: string;
  readonly intentIds: readonly string[];
}>;

export type ProductVariantDeclaredControlFamily = Readonly<{
  readonly controlRole: string;
  readonly formKind: "fill" | "select" | "none";
  readonly action: "fill" | "select" | "click";
}>;

export type ProductVariantRevealFamily = Readonly<{
  readonly revealKind: string;
  readonly memberControlRoles: readonly string[];
  readonly action:
    "fill" | "select" | "click" | "navigate" | "stateful" | "none";
}>;

export type ProductVariantSource = Readonly<{
  readonly sourceSha: string;
  readonly sourceTree: string;
  readonly sourceFiles: readonly ProductVariantSourceFile[];
  readonly catalogs: readonly ProductVariantCatalog[];
  readonly routes: readonly ProductVariantRoute[];
  readonly profiles: readonly string[];
  readonly declaredControlFamilies: readonly ProductVariantDeclaredControlFamily[];
  readonly revealFamilies: readonly ProductVariantRevealFamily[];
}>;

export class ProductVariantSourceError extends Error {
  override readonly name = "ProductVariantSourceError";
}

const digestText = (text: string): string =>
  createHash("sha256").update(text, "utf8").digest("hex");

const digestValue = (value: unknown): string =>
  digestText(JSON.stringify(value));

export const repoRelative = (
  repoRoot: string,
  absolutePath: string,
): string => {
  const relative = path.relative(repoRoot, absolutePath);
  if (
    relative === "" ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new ProductVariantSourceError(
      `Product-variant source path is outside the repository: ${absolutePath}`,
    );
  }
  return relative.split(path.sep).join("/");
};

export const readSourceFile = async (
  repoRoot: string,
  relativePath: string,
): Promise<{
  readonly path: string;
  readonly text: string;
  readonly digest: string;
}> => {
  const text = await readFile(path.join(repoRoot, relativePath), "utf8");
  return { path: relativePath, text, digest: digestText(text) };
};

export const sourceArray = (text: string, name: string): readonly string[] => {
  const match = new RegExp(
    String.raw`(?:const|export const)\s+${name}[^=]*=\s*\[([\s\S]*?)\]`,
    "u",
  ).exec(text);
  if (match?.[1] === undefined)
    throw new ProductVariantSourceError(
      `Cannot find ${name} in runtime source`,
    );
  const values = [...match[1].matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"/gu)].map(
    ([, value]) => value,
  );
  if (values.includes(undefined) || values.length === 0)
    throw new ProductVariantSourceError(`${name} has no string members`);
  return values.filter((value): value is string => value !== undefined);
};

export const sourceTuple = (text: string, name: string): readonly string[] => {
  const match = new RegExp(
    String.raw`(?:const|export const)\s+${name}[^=]*=\s*tuple\(([\s\S]*?)\)`,
    "u",
  ).exec(text);
  if (match?.[1] === undefined)
    throw new ProductVariantSourceError(
      `Cannot find ${name} in runtime source`,
    );
  const values = [...match[1].matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"/gu)].map(
    ([, value]) => value,
  );
  if (values.includes(undefined) || values.length === 0)
    throw new ProductVariantSourceError(`${name} has no string members`);
  return values.filter((value): value is string => value !== undefined);
};

export const revealKinds = (text: string): readonly string[] => {
  const start = text.indexOf("export type RevealTransitionClassification");
  const end = text.indexOf("const resolvedRouteFor", start);
  if (start === -1 || end === -1)
    throw new ProductVariantSourceError(
      "Reveal transition classification declaration is missing",
    );
  const declaration = text.slice(start, end);
  const values = new Set<string>();
  for (const [, value] of declaration.matchAll(/kind:\s*"([^"]+)"/gu)) {
    if (value !== undefined) values.add(value);
  }
  if (declaration.includes("typeof MUTATION_REQUIRED"))
    values.add("mutation-required");
  const result = [...values].toSorted((left, right) =>
    left.localeCompare(right),
  );
  if (result.length === 0)
    throw new ProductVariantSourceError(
      "Reveal transition source declares no kinds",
    );
  return result;
};

export const revealActionFor = (
  revealKind: string,
): ProductVariantRevealFamily["action"] => {
  switch (revealKind) {
    case "client-form":
      return "fill";
    case "cross-route-catalog-link":
      return "navigate";
    case "mutation-required":
      return "stateful";
    case "not-exercised":
      return "none";
    default:
      return "click";
  }
};

export const pageRouteFor = appRouterRouteForPage;

export const pageFiles = async (
  directory: string,
): Promise<readonly string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) return pageFiles(absolute);
      return entry.isFile() && entry.name === "page.tsx" ? [absolute] : [];
    }),
  );
  return nested.flat().toSorted((left, right) => left.localeCompare(right));
};

export const requireSha = (value: string, label: string): string => {
  if (!/^[0-9a-f]{40}$/u.test(value))
    throw new ProductVariantSourceError(`${label} is not a full lowercase SHA`);
  return value;
};

export const parseCatalogSnapshot = async (
  repoRoot: string,
  role: ProductVariantRole,
): Promise<ProductVariantCatalog> => {
  const relativePath = `e2e/catalog/${role}.yaml`;
  const file = await readSourceFile(repoRoot, relativePath);
  const parsed = parseCatalog(file.text);
  if (parsed?.role !== role)
    throw new ProductVariantSourceError(
      `Catalog ${relativePath} has an invalid role`,
    );
  return {
    path: relativePath,
    role,
    digest: file.digest,
    routes: parsed.routes.map((route) => ({
      route: route.route,
      access: [...route.access],
      ...(route.landing === undefined ? {} : { landing: route.landing }),
      intentIds: route.intents.map(({ id }) => id),
      digest: digestValue({
        role,
        route: route.route,
        access: route.access,
        landing: route.landing ?? null,
        intentIds: route.intents.map(({ id }) => id),
      }),
    })),
  };
};

export type { ProductVariantGitCommand } from "./product-variant-source-reader.ts";
export { readProductVariantSource } from "./product-variant-source-reader.ts";
