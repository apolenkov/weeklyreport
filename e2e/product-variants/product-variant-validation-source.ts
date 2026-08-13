import {
  allCatalogRouteKeys,
  DECLARED_CONTROL_SOURCE_PATHS,
  REVEAL_SOURCE_PATHS,
  routeIdentityFor,
} from "./product-variant-generator.ts";
import { routeKey, stableSerialize } from "./product-variant-hash.ts";
import {
  CONTROL_FAMILY_VARIANT,
  type ProductVariantManifest,
  ROUTE_VARIANT,
} from "./product-variant-schema.ts";
import {
  type ProductVariantSource,
  type ProductVariantSourceFile,
} from "./product-variant-source.ts";

const DECLARED_FAMILY = "declared" as const;

type CatalogRouteLike = Readonly<{
  readonly route: string;
  readonly access: readonly string[];
  readonly landing?: string | undefined;
  readonly intentIds: readonly string[];
  readonly digest: string;
}>;
type CatalogLike = Readonly<{
  readonly role: string;
  readonly digest: string;
  readonly routes: readonly CatalogRouteLike[];
}>;

const sourceFileMap = (
  files: readonly ProductVariantSourceFile[],
): ReadonlyMap<string, string> =>
  new Map(
    files.map(({ path: filePath, digest: fileDigest }) => [
      filePath,
      fileDigest,
    ]),
  );

export const compareSourceFiles = (
  expected: readonly ProductVariantSourceFile[],
  actual: readonly ProductVariantSourceFile[],
): readonly string[] => {
  const expectedMap = sourceFileMap(expected);
  const actualMap = sourceFileMap(actual);
  const issues: string[] = [];
  for (const [filePath, expectedDigest] of expectedMap) {
    const actualDigest = actualMap.get(filePath);
    if (actualDigest === undefined)
      issues.push(`missing source digest: ${filePath}`);
    else if (actualDigest !== expectedDigest)
      issues.push(`stale source digest: ${filePath}`);
  }
  for (const filePath of actualMap.keys()) {
    if (!expectedMap.has(filePath))
      issues.push(`unexpected source digest: ${filePath}`);
  }
  return issues;
};

const compareCatalogRoutes = (
  expectedCatalog: CatalogLike,
  actualCatalog: CatalogLike,
): readonly string[] => {
  const expectedRoutes = new Map(
    expectedCatalog.routes.map((route) => [route.route, route]),
  );
  const actualRoutes = new Map(
    actualCatalog.routes.map((route) => [route.route, route]),
  );
  const issues: string[] = [];
  for (const [routePath, expectedRoute] of expectedRoutes) {
    const actualRoute = actualRoutes.get(routePath);
    if (actualRoute === undefined) {
      issues.push(
        `missing catalog route coverage: ${expectedCatalog.role}:${routePath}`,
      );
      continue;
    }
    const routeChanged =
      actualRoute.digest !== expectedRoute.digest ||
      stableSerialize(actualRoute.intentIds) !==
        stableSerialize(expectedRoute.intentIds) ||
      stableSerialize(actualRoute.access) !==
        stableSerialize(expectedRoute.access) ||
      actualRoute.landing !== expectedRoute.landing;
    if (routeChanged)
      issues.push(
        `stale catalog route digest: ${expectedCatalog.role}:${routePath}`,
      );
  }
  for (const routePath of actualRoutes.keys()) {
    if (!expectedRoutes.has(routePath))
      issues.push(
        `unexpected catalog route coverage: ${expectedCatalog.role}:${routePath}`,
      );
  }
  return issues;
};

export const compareCatalogs = (
  manifest: ProductVariantManifest,
  source: ProductVariantSource,
): readonly string[] => {
  const expected = new Map(
    source.catalogs.map((catalog) => [catalog.path, catalog]),
  );
  const actual = new Map(
    manifest.catalogs.map((catalog) => [catalog.path, catalog]),
  );
  const issues: string[] = [];
  for (const [catalogPath, expectedCatalog] of expected) {
    const actualCatalog = actual.get(catalogPath);
    if (actualCatalog === undefined) {
      issues.push(`missing catalog coverage: ${catalogPath}`);
      continue;
    }
    if (actualCatalog.digest !== expectedCatalog.digest)
      issues.push(`stale catalog digest: ${catalogPath}`);
    issues.push(...compareCatalogRoutes(expectedCatalog, actualCatalog));
  }
  for (const catalogPath of actual.keys()) {
    if (!expected.has(catalogPath))
      issues.push(`unexpected catalog coverage: ${catalogPath}`);
  }
  return issues;
};

const compareRouteDeclarations = (
  manifest: ProductVariantManifest,
  source: ProductVariantSource,
): readonly string[] => {
  const sourceRoutes = new Map(
    source.routes.map((route) => [routeKey(route.role, route.route), route]),
  );
  const issues: string[] = [];
  for (const variant of manifest.variants) {
    if (variant.kind !== ROUTE_VARIANT) continue;
    const expected = sourceRoutes.get(
      variant.identityKey.replace(/^route:/u, ""),
    );
    if (expected === undefined || variant.routeIdentity === null) continue;
    if (
      stableSerialize(variant.routeIdentity) !==
      stableSerialize(routeIdentityFor(expected))
    )
      issues.push(
        `${variant.identityKey}: stale route source/catalog identity`,
      );
    if (
      stableSerialize(variant.catalogRouteKeys) !==
      stableSerialize([routeKey(expected.role, expected.route)])
    )
      issues.push(`${variant.identityKey}: stale route catalog link`);
  }
  return issues;
};

const compareControlVariantLinks = (
  manifest: ProductVariantManifest,
  source: ProductVariantSource,
): readonly string[] => {
  const allRouteKeys = allCatalogRouteKeys(source);
  const issues: string[] = [];
  for (const variant of manifest.variants) {
    if (
      variant.kind !== CONTROL_FAMILY_VARIANT ||
      variant.controlFamily === null
    )
      continue;
    const expectedPaths =
      variant.controlFamily.kind === DECLARED_FAMILY
        ? DECLARED_CONTROL_SOURCE_PATHS
        : REVEAL_SOURCE_PATHS;
    const actualPaths = variant.sourceFiles.map(
      ({ path: sourcePath }) => sourcePath,
    );
    if (stableSerialize(actualPaths) !== stableSerialize(expectedPaths))
      issues.push(`${variant.identityKey}: stale control source links`);
    if (
      stableSerialize(variant.catalogRouteKeys) !==
      stableSerialize(allRouteKeys)
    )
      issues.push(`${variant.identityKey}: stale control catalog links`);
  }
  return issues;
};

export const compareCurrentDeclarations = (
  manifest: ProductVariantManifest,
  source: ProductVariantSource,
): readonly string[] => [
  ...(stableSerialize(manifest.profiles) !== stableSerialize(source.profiles)
    ? ["stale profile declarations"]
    : []),
  ...(stableSerialize(manifest.declaredControlFamilies) !==
  stableSerialize(source.declaredControlFamilies)
    ? ["stale declared control-family declarations"]
    : []),
  ...(stableSerialize(manifest.revealFamilies) !==
  stableSerialize(source.revealFamilies)
    ? ["stale reveal-family declarations"]
    : []),
  ...compareRouteDeclarations(manifest, source),
  ...compareControlVariantLinks(manifest, source),
];

const currentRouteKeys = (source: ProductVariantSource): ReadonlySet<string> =>
  new Set(source.routes.map(({ role, route }) => routeKey(role, route)));

const currentControlKeys = (
  source: ProductVariantSource,
): ReadonlySet<string> =>
  new Set([
    ...source.declaredControlFamilies.map(
      ({ controlRole }) => `declared-control:${controlRole}`,
    ),
    ...source.revealFamilies.map(({ revealKind }) => `reveal:${revealKind}`),
  ]);

const missingAndStaleIssues = (
  expected: ReadonlySet<string>,
  actual: ReadonlySet<string>,
  label: string,
): readonly string[] => [
  ...[...expected]
    .filter((key) => !actual.has(key))
    .map((key) => `missing ${label} coverage: ${key}`),
  ...[...actual]
    .filter((key) => !expected.has(key))
    .map((key) => `stale ${label} coverage: ${key}`),
];

export const compareCurrentCoverage = (
  manifest: ProductVariantManifest,
  source: ProductVariantSource,
): readonly string[] => {
  const routeKeys = new Set(
    manifest.variants
      .filter(({ kind }) => kind === ROUTE_VARIANT)
      .map(({ identityKey }) => identityKey.replace(/^route:/u, "")),
  );
  const controlKeys = new Set(
    manifest.variants
      .filter(({ kind }) => kind === CONTROL_FAMILY_VARIANT)
      .map(({ identityKey }) => identityKey),
  );
  return [
    ...missingAndStaleIssues(currentRouteKeys(source), routeKeys, "route"),
    ...missingAndStaleIssues(
      currentControlKeys(source),
      controlKeys,
      "control",
    ),
  ];
};
