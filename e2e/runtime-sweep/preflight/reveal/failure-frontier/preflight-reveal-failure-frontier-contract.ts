import { z } from "zod";

import {
  sha256DigestSchema,
  sourceShaSchema,
  sourceTreeSchema,
} from "../../../source/contracts.ts";
import { freezeDeep } from "../../../source/manifest-source.ts";
import { sha256Hex, stableSerialize } from "../../../support/ids.ts";
import type { CapacitySurveyPlan } from "../../capacity/preflight-capacity-survey-contract.ts";
import {
  assetRefSchema,
  PREFLIGHT_REVEAL_BRANCH,
  PREFLIGHT_REVEAL_CANDIDATE_LIST,
  PREFLIGHT_REVEAL_INVENTORY,
  PREFLIGHT_REVEAL_PATH_NODE,
  PREFLIGHT_REVEAL_SURFACE,
  representativeInputSchema,
} from "../continuation/preflight-reveal-continuation-schemas.ts";

export const PREFLIGHT_REVEAL_FAILURE_FRONTIER =
  "PREFLIGHT_REVEAL_FAILURE_FRONTIER" as const;
export const PREFLIGHT_REVEAL_FAILURE_FRONTIER_VERSION = 1 as const;
export const PREFLIGHT_REVEAL_FAILURE_FRONTIER_AUTHORITY =
  "diagnostic-only" as const;
export const FAILURE_FRONTIER_MANIFEST_NAME = "FAILURE_FRONTIER.json";
export const FAILURE_FRONTIER_LIMITS = Object.freeze({
  maxManifestBytes: 65_536,
  maxDepth: 8,
  maxAssets: 64,
  maxAssetBytes: 8_388_608,
  maxAggregateBytes: 67_108_864,
});

const assetArtifactSchema = z.enum([
  PREFLIGHT_REVEAL_BRANCH,
  PREFLIGHT_REVEAL_CANDIDATE_LIST,
  PREFLIGHT_REVEAL_INVENTORY,
  PREFLIGHT_REVEAL_PATH_NODE,
  PREFLIGHT_REVEAL_SURFACE,
]);

const positiveSafeInteger = z
  .number()
  .int()
  .positive()
  .refine(Number.isSafeInteger, "must be a safe integer");
const nonnegativeSafeInteger = z
  .number()
  .int()
  .nonnegative()
  .refine(Number.isSafeInteger, "must be a safe integer");

const assetDescriptorSchema = z
  .object({
    artifact: assetArtifactSchema,
    ref: assetRefSchema,
    bytes: positiveSafeInteger.max(FAILURE_FRONTIER_LIMITS.maxAssetBytes),
  })
  .strict();

const limitsSchema = z
  .object({
    maxManifestBytes: z.literal(FAILURE_FRONTIER_LIMITS.maxManifestBytes),
    maxDepth: z.literal(FAILURE_FRONTIER_LIMITS.maxDepth),
    maxAssets: z.literal(FAILURE_FRONTIER_LIMITS.maxAssets),
    maxAssetBytes: z.literal(FAILURE_FRONTIER_LIMITS.maxAssetBytes),
    maxAggregateBytes: z.literal(FAILURE_FRONTIER_LIMITS.maxAggregateBytes),
  })
  .strict();

const manifestBodySchema = z
  .object({
    artifact: z.literal(PREFLIGHT_REVEAL_FAILURE_FRONTIER),
    version: z.literal(PREFLIGHT_REVEAL_FAILURE_FRONTIER_VERSION),
    authority: z.literal(PREFLIGHT_REVEAL_FAILURE_FRONTIER_AUTHORITY),
    sourceSha: sourceShaSchema,
    sourceTree: sourceTreeSchema,
    treeDigest: sha256DigestSchema,
    sourceDigest: sha256DigestSchema,
    sourcePlanDigest: sha256DigestSchema,
    capacityPlanArtifactDigest: sha256DigestSchema,
    selectorDigest: sha256DigestSchema,
    stateDigest: sha256DigestSchema,
    routeDigest: sha256DigestSchema,
    branchRef: assetRefSchema,
    branchDigest: assetRefSchema,
    pathNodeRef: assetRefSchema,
    pathDigest: assetRefSchema,
    inventoryRef: assetRefSchema,
    inventoryDigest: assetRefSchema,
    surfaceRef: assetRefSchema,
    surfaceDigest: assetRefSchema,
    candidateListRef: assetRefSchema,
    candidateListDigest: assetRefSchema,
    candidateIndex: nonnegativeSafeInteger,
    candidateIdentity: assetRefSchema,
    pendingBranchRef: assetRefSchema.optional(),
    pendingBranchDigest: assetRefSchema.optional(),
    pendingPathNodeRef: assetRefSchema.optional(),
    pendingPathDigest: assetRefSchema.optional(),
    pendingInventoryRef: assetRefSchema.optional(),
    pendingInventoryDigest: assetRefSchema.optional(),
    pendingSurfaceRef: assetRefSchema.optional(),
    pendingSurfaceDigest: assetRefSchema.optional(),
    representativeInput: representativeInputSchema,
    actionKeyDigest: sha256DigestSchema,
    failure: z
      .object({
        kind: z.enum(["error", "non-error"]),
        nameDigest: sha256DigestSchema,
        messageDigest: sha256DigestSchema,
      })
      .strict(),
    limits: limitsSchema,
    assets: z
      .array(assetDescriptorSchema)
      .min(1)
      .max(FAILURE_FRONTIER_LIMITS.maxAssets)
      .readonly(),
  })
  .strict();

const manifestSchema = manifestBodySchema
  .extend({ manifestDigest: sha256DigestSchema })
  .strict();

export type RevealFailureFrontierManifest = z.infer<typeof manifestSchema>;
export type RevealFailureFrontierAssetDescriptor = z.infer<
  typeof assetDescriptorSchema
>;

export class RevealFailureFrontierError extends Error {
  override readonly name = "RevealFailureFrontierError";
}

const bodyFor = (
  manifest: RevealFailureFrontierManifest,
): z.infer<typeof manifestBodySchema> => {
  const { manifestDigest: _manifestDigest, ...body } = manifest;
  return body;
};

const assetKey = (asset: RevealFailureFrontierAssetDescriptor): string =>
  `${asset.artifact}:${asset.ref}`;

const assertManifestSemantics = (
  manifest: z.infer<typeof manifestBodySchema>,
): void => {
  const keys = manifest.assets.map(assetKey);
  if (new Set(keys).size !== keys.length)
    throw new RevealFailureFrontierError(
      "Failure-frontier assets contain duplicate references",
    );
  if (
    stableSerialize(keys) !==
    stableSerialize(keys.toSorted((left, right) => left.localeCompare(right)))
  )
    throw new RevealFailureFrontierError(
      "Failure-frontier assets are not in canonical order",
    );
  const aggregate = manifest.assets.reduce(
    (total, asset) => total + asset.bytes,
    0,
  );
  if (aggregate > manifest.limits.maxAggregateBytes)
    throw new RevealFailureFrontierError(
      "Failure-frontier assets exceed the aggregate byte bound",
    );
};

export const parseRevealFailureFrontierManifest = (
  value: unknown,
): RevealFailureFrontierManifest => {
  const parsed = manifestSchema.safeParse(value);
  if (!parsed.success)
    throw new RevealFailureFrontierError(
      `Invalid failure-frontier manifest: ${parsed.error.message}`,
    );
  assertManifestSemantics(parsed.data);
  if (sha256Hex(bodyFor(parsed.data)) !== parsed.data.manifestDigest)
    throw new RevealFailureFrontierError(
      "Failure-frontier manifest digest does not match contents",
    );
  return freezeDeep(parsed.data);
};

export const createRevealFailureFrontierManifest = (
  input: z.input<typeof manifestBodySchema>,
): RevealFailureFrontierManifest => {
  const body = manifestBodySchema.parse(input);
  assertManifestSemantics(body);
  return parseRevealFailureFrontierManifest({
    ...body,
    manifestDigest: sha256Hex(body),
  });
};

export const assertFailureFrontierMatchesPlan = (
  manifest: RevealFailureFrontierManifest,
  plan: CapacitySurveyPlan,
): void => {
  const expected = {
    sourceSha: plan.sourceSha,
    sourceTree: plan.sourceTree,
    treeDigest: plan.treeDigest,
    sourceDigest: plan.sourceDigest,
    sourcePlanDigest: plan.planDigest,
    capacityPlanArtifactDigest: plan.planArtifactDigest,
    selectorDigest: plan.selector.selectorDigest,
    stateDigest: plan.selector.stateDigest,
    routeDigest: sha256Hex(plan.route),
  } as const;
  const mismatches = Object.entries(expected)
    .filter(([key, value]) => manifest[key as keyof typeof expected] !== value)
    .map(([key]) => key);
  if (mismatches.length > 0)
    throw new RevealFailureFrontierError(
      `Failure-frontier packet does not match exact capacity plan: ${mismatches.join(", ")}`,
    );
};
