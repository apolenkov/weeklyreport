import { generateProductVariantManifest } from "./product-variant-generator.ts";
import {
  catalogDigestFor,
  manifestDigestFor,
  manifestIdentityBodyForComparison,
  sourceDigestFor,
  stableSerialize,
} from "./product-variant-hash.ts";
import {
  CONTROL_FAMILY_VARIANT,
  manifestSchema,
  type ProductVariant,
  type ProductVariantManifest,
  ProductVariantManifestError,
  type ProductVariantValidation,
  ROUTE_VARIANT,
} from "./product-variant-schema.ts";
import { type ProductVariantSource } from "./product-variant-source.ts";
import {
  compareCatalogs,
  compareCurrentCoverage,
  compareCurrentDeclarations,
  compareSourceFiles,
} from "./product-variant-validation-source.ts";

const PASS_STATUS = "PASS" as const;

const manualReviewIssues = (variant: ProductVariant): readonly string[] => {
  if (
    variant.evidencePolicy.manualVisualReviewRequired &&
    (variant.terminal.manualVisualReview !== "ACCEPTED" ||
      variant.terminal.evidence.manualVisualReview === null)
  )
    return [
      `${variant.identityKey}: PASS requires accepted manual visual review`,
    ];
  return [];
};

const readBackIssues = (variant: ProductVariant): readonly string[] => {
  if (
    variant.evidencePolicy.statefulReadBackRequired &&
    variant.terminal.readBack !== PASS_STATUS
  )
    return [
      `${variant.identityKey}: PASS requires stateful read-back evidence`,
    ];
  if (
    variant.evidencePolicy.statefulReadBackRequired &&
    variant.terminal.evidence.readBack.length === 0
  )
    return [`${variant.identityKey}: PASS is missing read-back evidence`];
  return [];
};

const evidenceIssues = (variant: ProductVariant): readonly string[] => {
  const requirements: readonly [
    "before" | "after" | "a11y" | "geometry" | "logs" | "metrics",
    boolean,
  ][] = [
    ["before", variant.evidencePolicy.screenshot.before],
    ["after", variant.evidencePolicy.screenshot.after],
    ["a11y", variant.evidencePolicy.a11y],
    ["geometry", variant.evidencePolicy.geometry],
    ["logs", variant.evidencePolicy.logs],
    ["metrics", variant.evidencePolicy.metrics],
  ];
  return requirements
    .filter(
      ([name, required]) =>
        required && variant.terminal.evidence[name].length === 0,
    )
    .map(
      ([name]) => `${variant.identityKey}: PASS is missing ${name} evidence`,
    );
};

const issueForTerminal = (variant: ProductVariant): readonly string[] => {
  if (variant.terminal.status !== PASS_STATUS) return [];
  return [
    ...manualReviewIssues(variant),
    ...readBackIssues(variant),
    ...evidenceIssues(variant),
  ];
};

const variantStructuralIssues = (
  variant: ProductVariant,
): readonly string[] => [
  ...(variant.kind === ROUTE_VARIANT && variant.routeIdentity === null
    ? [`${variant.identityKey}: route variant lacks route identity`]
    : []),
  ...(variant.kind === CONTROL_FAMILY_VARIANT && variant.controlFamily === null
    ? [`${variant.identityKey}: control variant lacks control-family identity`]
    : []),
  ...(!variant.evidencePolicy.manualVisualReviewRequired
    ? [`${variant.identityKey}: variant has no manual visual evidence policy`]
    : []),
  ...(variant.evidencePolicy.statefulReadBackRequired &&
  variant.terminal.readBack === "NOT_REQUIRED"
    ? [`${variant.identityKey}: stateful variant has no read-back policy`]
    : []),
];

const duplicateIdentityIssues = (
  manifest: ProductVariantManifest,
): readonly string[] => {
  const ids = manifest.variants.map(({ id }) => id);
  const identityKeys = manifest.variants.map(({ identityKey }) => identityKey);
  return [
    ...(new Set(ids).size !== ids.length
      ? ["duplicate variant identity: id"]
      : []),
    ...(new Set(identityKeys).size !== identityKeys.length
      ? ["duplicate variant identity: identityKey"]
      : []),
  ];
};

const structuralIssues = (
  manifest: ProductVariantManifest,
): readonly string[] => [
  ...duplicateIdentityIssues(manifest),
  ...manifest.variants.flatMap(variantStructuralIssues),
];

const currentSourceIssues = (
  manifest: ProductVariantManifest,
  source: ProductVariantSource,
): readonly string[] => [
  ...(manifest.sourceSha !== source.sourceSha ? ["stale source SHA"] : []),
  ...(manifest.sourceTree !== source.sourceTree ? ["stale source tree"] : []),
  ...(manifest.catalogDigest !== catalogDigestFor(source.catalogs)
    ? ["stale catalog digest"]
    : []),
  ...compareSourceFiles(manifest.sourceFiles, source.sourceFiles),
  ...compareCatalogs(manifest, source),
  ...compareCurrentDeclarations(manifest, source),
  ...compareCurrentCoverage(manifest, source),
];

const canonicalManifestIssues = (
  manifest: ProductVariantManifest,
  source: ProductVariantSource,
): readonly string[] => {
  const expected = generateProductVariantManifest(source);
  return stableSerialize(manifestIdentityBodyForComparison(manifest)) ===
    stableSerialize(manifestIdentityBodyForComparison(expected))
    ? []
    : [
        "manifest does not match canonical manifest reconstructed from current source",
      ];
};

const manifestParseIssues = (
  value: unknown,
): ProductVariantManifest | ProductVariantValidation => {
  const parsed = manifestSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  return {
    valid: false,
    status: "BLOCKED",
    issues: [parsed.error.message],
  };
};

export function validateProductVariantManifest(
  value: unknown,
  currentSource?: ProductVariantSource,
): ProductVariantValidation {
  const parsed = manifestParseIssues(value);
  if (!("artifact" in parsed)) return parsed;
  const manifest = parsed;
  const issues = [
    ...structuralIssues(manifest),
    ...(manifest.manifestDigest !== manifestDigestFor(manifest)
      ? ["manifest digest does not match contents"]
      : []),
    ...(currentSource === undefined
      ? []
      : manifest.sourceDigest !== sourceDigestFor(currentSource)
        ? [
            "stale source digest",
            ...currentSourceIssues(manifest, currentSource),
            ...canonicalManifestIssues(manifest, currentSource),
          ]
        : [
            ...currentSourceIssues(manifest, currentSource),
            ...canonicalManifestIssues(manifest, currentSource),
          ]),
    ...manifest.variants.flatMap(issueForTerminal),
  ];
  const uniqueIssues = [...new Set(issues)];
  const allPass = manifest.variants.every(
    ({ terminal }) => terminal.status === PASS_STATUS,
  );
  return {
    valid: uniqueIssues.length === 0,
    status:
      uniqueIssues.length > 0
        ? "BLOCKED"
        : allPass
          ? PASS_STATUS
          : "PENDING_MANUAL_REVIEW",
    issues: uniqueIssues,
  };
}

export function assertProductVariantManifest(
  value: unknown,
  currentSource?: ProductVariantSource,
): ProductVariantManifest {
  const validation = validateProductVariantManifest(value, currentSource);
  if (!validation.valid)
    throw new ProductVariantManifestError(validation.issues.join("; "));
  return manifestSchema.parse(value);
}
