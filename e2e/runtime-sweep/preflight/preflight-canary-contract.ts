import { z } from "zod";

import { revealTransitionSchema } from "../matrix/reveal-transition.ts";
import {
  resolverOutcomeIdentitySchema,
  roleSchema,
  seedProfileSchema,
  sha256DigestSchema,
  sourceShaSchema,
  sourceTreeSchema,
  stableIdentifierSchema,
  viewportSchema,
} from "../source/contracts.ts";
import type { SourceArtifact } from "../source/source-artifact.ts";
import type { PreflightRoute } from "./playwright-preflight-support.ts";
import { preflightSegmentSchema } from "./preflight-artifact.ts";
import { revealPathSchema, revealSurfaceSchema } from "./reveal-path.ts";

export const PREFLIGHT_CANARY_VIEWPORT = {
  browser: "chromium",
  width: 1440,
  height: 900,
} as const;

export const preflightCanarySelectorSchema = z
  .object({
    stateId: stableIdentifierSchema,
    role: roleSchema.optional(),
    route: z.string().trim().min(1).optional(),
    profile: seedProfileSchema.optional(),
  })
  .strict();

const resolverExpectationSchema = z
  .object({
    identity: resolverOutcomeIdentitySchema.extend({
      sourceDigest: sha256DigestSchema,
    }),
    expectedTarget: z.string().min(1),
    expectedUi: z.string().min(1),
  })
  .strict();

const canaryRouteSchema = z.union([
  z
    .object({
      role: roleSchema,
      catalogRoute: z.string().min(1),
      resolvedRoute: z.string().min(1),
      landingRoute: z.string().min(1),
      kind: z.literal("unconditional").optional(),
    })
    .strict(),
  z
    .object({
      role: roleSchema,
      catalogRoute: z.string().min(1),
      resolvedRoute: z.string().min(1),
      kind: z.literal("resolver"),
      expectedOutcome: resolverExpectationSchema,
      landingRoute: z.never().optional(),
    })
    .strict(),
]);

const canaryErrorSchema = z
  .object({
    name: z.string().min(1),
    message: z.string().min(1),
  })
  .strict();

const canaryFailurePhaseSchema = z.enum([
  "selection",
  "preparation",
  "navigation",
  "inventory",
  "reveal",
  "non-mutation",
  "unknown",
]);

const canaryIdentityShape = {
  artifact: z.literal("PREFLIGHT_CANARY"),
  version: z.literal(1),
  campaignId: z.string().trim().min(1),
  sourceSha: sourceShaSchema,
  sourceTree: sourceTreeSchema,
  treeDigest: sha256DigestSchema,
  sourceDigest: sha256DigestSchema,
  planDigest: sha256DigestSchema,
  selector: preflightCanarySelectorSchema,
  viewport: viewportSchema,
  capturedAt: z.string().min(1),
} as const;

const canaryPassSchema = z
  .object({
    ...canaryIdentityShape,
    status: z.literal("PASS"),
    route: canaryRouteSchema,
    segment: preflightSegmentSchema,
    revealPaths: z.array(revealPathSchema).readonly(),
    revealSurfaces: z.array(revealSurfaceSchema).readonly(),
    revealTransitions: z.array(revealTransitionSchema).readonly(),
    segmentDigest: sha256DigestSchema,
    canaryDigest: sha256DigestSchema,
  })
  .strict();

const canaryFailureSchema = z
  .object({
    ...canaryIdentityShape,
    status: z.literal("FAIL"),
    route: canaryRouteSchema,
    phase: canaryFailurePhaseSchema,
    error: canaryErrorSchema,
    canaryDigest: sha256DigestSchema,
  })
  .strict();

const canaryBlockedSchema = z
  .object({
    ...canaryIdentityShape,
    status: z.literal("BLOCKED"),
    phase: z.literal("selection"),
    error: canaryErrorSchema,
    canaryDigest: sha256DigestSchema,
  })
  .strict();

export const preflightCanaryArtifactSchema = z.discriminatedUnion("status", [
  canaryPassSchema,
  canaryFailureSchema,
  canaryBlockedSchema,
]);

export type PreflightCanarySelector = z.infer<
  typeof preflightCanarySelectorSchema
>;
export type PreflightCanaryArtifact = z.infer<
  typeof preflightCanaryArtifactSchema
>;
export type PreflightCanarySelection = Readonly<{
  readonly selector: PreflightCanarySelector;
  readonly state: SourceArtifact["plan"]["states"][number];
  readonly route: PreflightRoute;
}>;

export type PreflightCanaryLiveIdentity = Readonly<{
  readonly sourceSha: string;
  readonly sourceTree: string;
  readonly treeDigest: string;
}>;

export type PreflightCanaryEnvironment = Readonly<
  Record<string, string | undefined>
>;

export const PREFLIGHT_CAMPAIGN_KINDS = [
  "initial",
  "repair",
  "resweep",
  "fix",
] as const;
export type PreflightCampaignKind = (typeof PREFLIGHT_CAMPAIGN_KINDS)[number];

export class PreflightCanaryError extends Error {
  override readonly name = "PreflightCanaryError";
}

export type CanaryFailurePhase = z.infer<typeof canaryFailurePhaseSchema>;
