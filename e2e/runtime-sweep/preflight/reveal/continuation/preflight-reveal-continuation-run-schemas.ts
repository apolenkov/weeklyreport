import { z } from "zod";

import {
  matrixAxesSchema,
  roleSchema,
  routeBindingTargetSchema,
  seedProfileSchema,
  sha256DigestSchema,
  sourceShaSchema,
  sourceTreeSchema,
  stableIdentifierSchema,
} from "../../../source/contracts.ts";
import {
  canonicalRelativeUrlSchema,
  resolverOutcomeExpectationSchema,
} from "./preflight-reveal-continuation-schema-primitives.ts";

export const routeSchema = z.union([
  z
    .object({
      kind: z.literal("resolver"),
      role: roleSchema,
      catalogRoute: canonicalRelativeUrlSchema,
      resolvedRoute: canonicalRelativeUrlSchema,
      target: routeBindingTargetSchema,
      expectedOutcome: resolverOutcomeExpectationSchema,
      landingRoute: z.never().optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("unconditional").optional(),
      role: roleSchema,
      catalogRoute: canonicalRelativeUrlSchema,
      resolvedRoute: canonicalRelativeUrlSchema,
      landingRoute: canonicalRelativeUrlSchema,
      target: routeBindingTargetSchema,
      expectedOutcome: z.never().optional(),
    })
    .strict(),
]);

const matrixStateSchema = z
  .object({
    stateId: stableIdentifierSchema,
    pairwiseDigest: sha256DigestSchema,
    profile: seedProfileSchema,
    axes: matrixAxesSchema,
  })
  .strict();
const selectorSchema = z
  .object({
    stateId: stableIdentifierSchema,
    role: roleSchema,
    route: canonicalRelativeUrlSchema,
    profile: seedProfileSchema,
  })
  .strict();

export const runIdentitySchema = z
  .object({
    campaignId: stableIdentifierSchema,
    sourceSha: sourceShaSchema,
    sourceTree: sourceTreeSchema,
    treeDigest: sha256DigestSchema,
    sourceDigest: sha256DigestSchema,
    planDigest: sha256DigestSchema,
    state: matrixStateSchema,
    stateDigest: sha256DigestSchema,
    selector: selectorSchema,
    selectorDigest: sha256DigestSchema,
    route: routeSchema,
    routeDigest: sha256DigestSchema,
    executionScope: z.literal("canary"),
    attemptId: stableIdentifierSchema,
  })
  .strict();
