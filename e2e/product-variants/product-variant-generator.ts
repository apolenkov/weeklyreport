import {
  catalogDigestFor,
  digest,
  routeKey,
  sourceDigestFor,
  sourceFileIdentity,
} from "./product-variant-hash.ts";
import {
  type ActionVariant,
  ALL_CURRENT,
  CONTROL_FAMILY_VARIANT,
  HISTORICAL_RECONCILIATION,
  manifestSchema,
  type ProductVariant,
  type ProductVariantManifest,
  ROUTE_VARIANT,
} from "./product-variant-schema.ts";
import {
  type ProductVariantDeclaredControlFamily,
  type ProductVariantRevealFamily,
  type ProductVariantRoute,
  type ProductVariantSource,
  type ProductVariantSourceFile,
} from "./product-variant-source.ts";

export const DECLARED_CONTROL_SOURCE_PATHS = [
  "e2e/runtime-sweep/replay/control-actions/control-action-roles.ts",
  "e2e/runtime-sweep/replay/control-actions/control-action-policy.ts",
  "e2e/runtime-sweep/replay/live-control/live-control-planning.ts",
] as const;
export const REVEAL_SOURCE_PATHS = [
  "e2e/runtime-sweep/preflight/reveal/interaction/preflight-reveal-transition.ts",
  "e2e/runtime-sweep/replay/live-control/live-control-planning.ts",
] as const;

const DECLARED_CONTROL = "declared-control" as const;

const actionForDeclared = (
  family: ProductVariantDeclaredControlFamily,
): ActionVariant => family.action;

const actionForReveal = (family: ProductVariantRevealFamily): ActionVariant =>
  family.action;

const policyFor = (
  actionVariant: ActionVariant,
  stateVariant: string,
): ProductVariant["evidencePolicy"] => ({
  statefulReadBackRequired:
    actionVariant === "fill" ||
    actionVariant === "select" ||
    actionVariant === "stateful" ||
    stateVariant.includes("stateful"),
  screenshot: { before: true, after: true },
  a11y: true,
  geometry: true,
  logs: true,
  metrics: true,
  manualVisualReviewRequired: true,
});

const terminalFor = (
  evidencePolicy: ProductVariant["evidencePolicy"],
): ProductVariant["terminal"] => ({
  status: "PENDING_MANUAL_REVIEW",
  manualVisualReview: "PENDING",
  readBack: evidencePolicy.statefulReadBackRequired
    ? "REQUIRED"
    : "NOT_REQUIRED",
  evidence: {
    before: [],
    after: [],
    a11y: [],
    geometry: [],
    logs: [],
    metrics: [],
    readBack: [],
    manualVisualReview: null,
  },
});

const sourceFilesForPaths = (
  source: ProductVariantSource,
  paths: readonly string[],
): readonly ProductVariantSourceFile[] => {
  const byPath = new Map(source.sourceFiles.map((file) => [file.path, file]));
  return paths.map((sourcePath) => {
    const file = byPath.get(sourcePath);
    if (file === undefined)
      throw new Error(`Missing source digest for ${sourcePath}`);
    return sourceFileIdentity(file);
  });
};

export const allCatalogRouteKeys = (
  source: ProductVariantSource,
): readonly string[] =>
  source.routes
    .map(({ role, route }) => routeKey(role, route))
    .toSorted((left, right) => left.localeCompare(right));

export const routeIdentityFor = (route: ProductVariantRoute) => ({
  role: route.role,
  route: route.route,
  sourcePath: route.sourcePath,
  sourceDigest: route.sourceDigest,
  catalogPath: route.catalogPath,
  catalogDigest: route.catalogDigest,
  catalogRouteDigest: route.catalogRouteDigest,
  intentIds: route.intentIds,
});

const routeVariantFor = (
  source: ProductVariantSource,
  route: ProductVariantRoute,
): ProductVariant => {
  const evidencePolicy = policyFor("navigate", "catalog-entry");
  return {
    id: digest({ kind: ROUTE_VARIANT, role: route.role, route: route.route }),
    identityKey: `${ROUTE_VARIANT}:${route.role}:${route.route}`,
    kind: ROUTE_VARIANT,
    profile: ALL_CURRENT,
    role: route.role,
    route: route.route,
    stateVariant: "catalog-entry",
    actionVariant: "navigate",
    displayVariant: "route-entry",
    routeIdentity: routeIdentityFor(route),
    controlFamily: null,
    sourceFiles: sourceFilesForPaths(source, [route.sourcePath]),
    catalogRouteKeys: [routeKey(route.role, route.route)],
    evidencePolicy,
    terminal: terminalFor(evidencePolicy),
  };
};

const declaredControlVariantFor = (
  source: ProductVariantSource,
  family: ProductVariantDeclaredControlFamily,
): ProductVariant => {
  const actionVariant = actionForDeclared(family);
  const evidencePolicy = policyFor(actionVariant, DECLARED_CONTROL);
  return {
    id: digest({ kind: DECLARED_CONTROL, controlRole: family.controlRole }),
    identityKey: `${DECLARED_CONTROL}:${family.controlRole}`,
    kind: CONTROL_FAMILY_VARIANT,
    profile: ALL_CURRENT,
    role: ALL_CURRENT,
    route: ALL_CURRENT,
    stateVariant: DECLARED_CONTROL,
    actionVariant,
    displayVariant: "control-family",
    routeIdentity: null,
    controlFamily: {
      kind: "declared",
      controlRole: family.controlRole,
      revealKind: null,
      memberControlRoles: [family.controlRole],
    },
    sourceFiles: sourceFilesForPaths(source, DECLARED_CONTROL_SOURCE_PATHS),
    catalogRouteKeys: allCatalogRouteKeys(source),
    evidencePolicy,
    terminal: terminalFor(evidencePolicy),
  };
};

const revealFamilyVariantFor = (
  source: ProductVariantSource,
  family: ProductVariantRevealFamily,
): ProductVariant => {
  const actionVariant = actionForReveal(family);
  const evidencePolicy = policyFor(
    actionVariant,
    `reveal-${family.revealKind}`,
  );
  return {
    id: digest({ kind: "reveal", revealKind: family.revealKind }),
    identityKey: `reveal:${family.revealKind}`,
    kind: CONTROL_FAMILY_VARIANT,
    profile: ALL_CURRENT,
    role: ALL_CURRENT,
    route: ALL_CURRENT,
    stateVariant: `reveal-${family.revealKind}`,
    actionVariant,
    displayVariant: "reveal-family",
    routeIdentity: null,
    controlFamily: {
      kind: "reveal",
      controlRole: null,
      revealKind: family.revealKind,
      memberControlRoles: family.memberControlRoles,
    },
    sourceFiles: sourceFilesForPaths(source, REVEAL_SOURCE_PATHS),
    catalogRouteKeys: allCatalogRouteKeys(source),
    evidencePolicy,
    terminal: terminalFor(evidencePolicy),
  };
};

const variantsFor = (
  source: ProductVariantSource,
): readonly ProductVariant[] => [
  ...source.routes.map((route) => routeVariantFor(source, route)),
  ...source.declaredControlFamilies.map((family) =>
    declaredControlVariantFor(source, family),
  ),
  ...source.revealFamilies.map((family) =>
    revealFamilyVariantFor(source, family),
  ),
];

const summaryFor = (
  source: ProductVariantSource,
  variants: readonly ProductVariant[],
): ProductVariantManifest["summary"] => ({
  roleRouteCount: source.routes.length,
  intentCount: source.routes.reduce(
    (count, route) => count + route.intentIds.length,
    0,
  ),
  routeVariantCount: variants.filter(({ kind }) => kind === ROUTE_VARIANT)
    .length,
  declaredControlVariantCount: source.declaredControlFamilies.length,
  revealFamilyVariantCount: source.revealFamilies.length,
  totalVariantCount: variants.length,
});

export function generateProductVariantManifest(
  source: ProductVariantSource,
  generatedAt = new Date().toISOString(),
): ProductVariantManifest {
  const variants = variantsFor(source);
  const body = {
    artifact: "PRODUCT_VARIANT_MANIFEST" as const,
    schemaVersion: 1 as const,
    sourceSha: source.sourceSha,
    sourceTree: source.sourceTree,
    sourceDigest: sourceDigestFor(source),
    catalogDigest: catalogDigestFor(source.catalogs),
    sourceFiles: source.sourceFiles.map(sourceFileIdentity),
    catalogs: source.catalogs,
    profiles: [...source.profiles],
    declaredControlFamilies: [...source.declaredControlFamilies],
    revealFamilies: [...source.revealFamilies],
    historicalReconciliation: HISTORICAL_RECONCILIATION,
    summary: summaryFor(source, variants),
    variants,
    generatedAt,
  };
  const { generatedAt: _generatedAt, ...identityBody } = body;
  return manifestSchema.parse({
    ...body,
    manifestDigest: digest(identityBody),
  });
}

export const productVariantProfiles = [
  "minimal",
  "demo",
  "full",
  "stress",
] as const;
