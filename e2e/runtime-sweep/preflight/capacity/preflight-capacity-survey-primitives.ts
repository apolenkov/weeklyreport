import { z } from "zod";

import {
  matrixAxesSchema,
  resolverOutcomeIdentitySchema,
  roleSchema,
  routeBindingTargetSchema,
  routeUrlSchema,
  seedProfileSchema,
  sha256DigestSchema,
  stableIdentifierSchema,
  viewportSchema,
} from "../../source/contracts.ts";
import { sha256Hex, stableSerialize } from "../../support/ids.ts";
import { preflightJournalStateDigest } from "../journal/preflight-journal-contract.ts";

export const PREFLIGHT_CAPACITY_SURVEY_PLAN =
  "PREFLIGHT_CAPACITY_SURVEY_PLAN" as const;
export const PREFLIGHT_CAPACITY_SURVEY_RESULT =
  "PREFLIGHT_CAPACITY_SURVEY_RESULT" as const;
export const PREFLIGHT_CAPACITY_SURVEY_VERSION = 1 as const;
export const PREFLIGHT_CAPACITY_SURVEY_AUTHORITY = "diagnostic-only" as const;
const BYTES_PER_KIBIBYTE = 1024;
const CAPACITY_SURVEY_ARTIFACT_KIBIBYTES = 64;
export const CAPACITY_SURVEY_MAX_ARTIFACT_BYTES =
  CAPACITY_SURVEY_ARTIFACT_KIBIBYTES * BYTES_PER_KIBIBYTE;

/** Parser-level ceilings; every survey must still publish explicit bounds. */
export const CAPACITY_SURVEY_IMPLEMENTATION_LIMITS = Object.freeze({
  maxDepth: 64,
  materialEdges: 65_536,
  actions: 131_072,
  controls: 65_536,
  maxDurationMs: 86_400_000,
  maxChildren: 1,
  maxPerFileBytes: CAPACITY_SURVEY_MAX_ARTIFACT_BYTES,
  maxAggregateArchiveBytes: CAPACITY_SURVEY_MAX_ARTIFACT_BYTES * 2,
});

const positiveSafeInteger = (maximum: number) =>
  z
    .number()
    .int()
    .positive()
    .max(maximum)
    .refine(Number.isSafeInteger, "must be a safe integer");

export const nonnegativeSafeInteger = z
  .number()
  .int()
  .nonnegative()
  .refine(Number.isSafeInteger, "must be a safe integer");

const reservedSurfaceWord = /(?:canary|grant|journal)/iu;
export const capacitySurveyIdentifierSchema = stableIdentifierSchema.refine(
  (value) => !reservedSurfaceWord.test(value),
  "must not use a canary, grant, or journal identity",
);

export const capacitySurveySelectorBodySchema = z
  .object({
    stateId: stableIdentifierSchema,
    stateDigest: sha256DigestSchema,
    pairwiseDigest: sha256DigestSchema,
    profile: seedProfileSchema,
    axes: matrixAxesSchema,
    role: roleSchema,
    catalogRoute: routeUrlSchema,
    resolvedRoute: routeUrlSchema,
  })
  .strict();

export const capacitySurveySelectorSchema = capacitySurveySelectorBodySchema
  .extend({ selectorDigest: sha256DigestSchema })
  .strict();

export type CapacitySurveySelector = z.infer<
  typeof capacitySurveySelectorSchema
>;

export const capacitySurveyStateSchema = z
  .object({
    stateId: stableIdentifierSchema,
    pairwiseDigest: sha256DigestSchema,
    profile: seedProfileSchema,
    axes: matrixAxesSchema,
  })
  .strict();

const resolverRouteSchema = z
  .object({
    kind: z.literal("resolver"),
    role: roleSchema,
    catalogRoute: routeUrlSchema,
    resolvedRoute: routeUrlSchema,
    target: routeBindingTargetSchema,
    expectedOutcome: z
      .object({
        identity: resolverOutcomeIdentitySchema.extend({
          sourceDigest: sha256DigestSchema,
        }),
        expectedTarget: routeUrlSchema,
        expectedUi: z.string().min(1),
      })
      .strict(),
  })
  .strict();

const unconditionalRouteSchema = z
  .object({
    kind: z.literal("unconditional").optional(),
    role: roleSchema,
    catalogRoute: routeUrlSchema,
    resolvedRoute: routeUrlSchema,
    landingRoute: routeUrlSchema,
    target: routeBindingTargetSchema,
  })
  .strict();

export const capacitySurveyRouteSchema = z.union([
  resolverRouteSchema,
  unconditionalRouteSchema,
]);

type CapacitySurveyRoute = z.infer<typeof capacitySurveyRouteSchema>;

export const capacitySurveyLimitsSchema = z
  .object({
    maxDepth: positiveSafeInteger(
      CAPACITY_SURVEY_IMPLEMENTATION_LIMITS.maxDepth,
    ),
    materialEdges: positiveSafeInteger(
      CAPACITY_SURVEY_IMPLEMENTATION_LIMITS.materialEdges,
    ),
    actions: positiveSafeInteger(CAPACITY_SURVEY_IMPLEMENTATION_LIMITS.actions),
    controls: positiveSafeInteger(
      CAPACITY_SURVEY_IMPLEMENTATION_LIMITS.controls,
    ),
    maxDurationMs: positiveSafeInteger(
      CAPACITY_SURVEY_IMPLEMENTATION_LIMITS.maxDurationMs,
    ),
    maxChildren: z.literal(CAPACITY_SURVEY_IMPLEMENTATION_LIMITS.maxChildren),
    maxPerFileBytes: positiveSafeInteger(
      CAPACITY_SURVEY_IMPLEMENTATION_LIMITS.maxPerFileBytes,
    ),
    maxAggregateArchiveBytes: positiveSafeInteger(
      CAPACITY_SURVEY_IMPLEMENTATION_LIMITS.maxAggregateArchiveBytes,
    ),
  })
  .strict()
  .refine(
    ({ maxAggregateArchiveBytes, maxPerFileBytes }) =>
      maxAggregateArchiveBytes >= maxPerFileBytes,
    {
      path: ["maxAggregateArchiveBytes"],
      message: "aggregate archive bound must cover one per-file bound",
    },
  );

export const capacitySurveyViewportSchema = viewportSchema;

export class CapacitySurveyContractError extends Error {
  override readonly name = "CapacitySurveyContractError";
}

export type CapacitySurveyBinding = Readonly<{
  readonly selector: CapacitySurveySelector;
  readonly state: z.infer<typeof capacitySurveyStateSchema>;
  readonly route: CapacitySurveyRoute;
}>;

export type CapacitySurveySourceIdentity = Readonly<{
  readonly sourceSha: string;
  readonly sourceTree: string;
  readonly treeDigest: string;
  readonly sourceDigest: string;
  readonly planDigest: string;
}>;

const selectorBodyFor = (
  selector: CapacitySurveySelector,
): z.infer<typeof capacitySurveySelectorBodySchema> => {
  const { selectorDigest: _selectorDigest, ...body } = selector;
  return body;
};

const assertCapacitySurveySelector = (
  selector: CapacitySurveySelector,
): void => {
  if (sha256Hex(selectorBodyFor(selector)) !== selector.selectorDigest)
    throw new CapacitySurveyContractError(
      "Capacity survey selector digest does not match contents",
    );
};

export const assertCapacitySurveyBindings = (
  binding: CapacitySurveyBinding,
): void => {
  const { selector, state, route } = binding;
  assertCapacitySurveySelector(selector);
  const mismatches: string[] = [];
  const stateDigest = preflightJournalStateDigest({
    state,
    role: route.role,
    catalogRoute: route.catalogRoute,
    resolvedRoute: route.resolvedRoute,
  });
  if (selector.stateId !== state.stateId) mismatches.push("stateId");
  if (selector.stateDigest !== stateDigest) mismatches.push("stateDigest");
  if (selector.pairwiseDigest !== state.pairwiseDigest)
    mismatches.push("pairwiseDigest");
  if (selector.profile !== state.profile) mismatches.push("profile");
  if (stableSerialize(selector.axes) !== stableSerialize(state.axes))
    mismatches.push("axes");
  if (selector.role !== route.role) mismatches.push("role");
  if (selector.catalogRoute !== route.catalogRoute)
    mismatches.push("catalogRoute");
  if (selector.resolvedRoute !== route.resolvedRoute)
    mismatches.push("resolvedRoute");
  if (state.axes.route !== `${route.role}:${route.catalogRoute}`)
    mismatches.push("state route");
  if (mismatches.length > 0)
    throw new CapacitySurveyContractError(
      `Capacity survey selector/state/route mismatch: ${mismatches.join(", ")}`,
    );
};

export const parseCapacitySurveyTimestamp = (value: string): number => {
  const milliseconds = Date.parse(value);
  if (!Number.isSafeInteger(milliseconds))
    throw new CapacitySurveyContractError(
      "Capacity survey timestamps must be parseable ISO datetimes",
    );
  return milliseconds;
};
