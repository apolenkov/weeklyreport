import { z } from "zod";

import {
  revealPathSchema,
  revealSurfaceSchema,
} from "../../preflight/reveal-path.ts";
import {
  type CampaignManifest,
  type MatrixExecution,
  matrixExecutionSchema,
  matrixInapplicableSchema,
  networkEvidencePolicySchema,
  NO_ROUTE_CACHE_CONTRACT_POLICY,
  type ResolverOutcomeKind,
  roleSchema,
  routeNetworkPolicySchema,
  seedProfileSchema,
  sha256DigestSchema,
  sourceBoundResolverOutcomeSchema,
  sourceShaSchema,
  stableIdentifierSchema,
  stateAxesSchema,
  viewportSchema,
} from "../../source/contracts.ts";
import { sha256Hex, stableId } from "../../support/ids.ts";
import type { ResolverOutcomeExpectation } from "../../support/resolver-outcome-expectations.ts";
import { resolverOutcomeExpectationFor } from "../../support/resolver-outcome-expectations.ts";
import type { CampaignMatrixState } from "../campaign-matrix.ts";
import { revealTransitionSchema } from "../reveal-transition.ts";
import {
  type MatrixPreflightControl,
  matrixPreparationSchema,
} from "./matrix-finalizer-preflight-contract.ts";
export { DEFAULT_MAX_CASES, DEFAULT_MAX_CONTROLS } from "../matrix-limits.ts";
export {
  type MatrixFinalizationInput,
  type MatrixPreflightControl,
  type MatrixPreflightEntry,
  type MatrixPreflightSegment,
  type MatrixPreparation,
  matrixPreparationSchema,
} from "./matrix-finalizer-preflight-contract.ts";
export const DESKTOP_WIDTH = 1440;
export const DESKTOP_HEIGHT = 900;
type Route = CampaignManifest["routes"][number];
type AssignedBinding = Extract<
  NonNullable<Route["bindings"]>[number],
  { readonly status: "assigned" }
>;
const resolverOutcomeExpectationSchema = z
  .object({
    identity: sourceBoundResolverOutcomeSchema,
    expectedTarget: z.string().min(1),
    expectedUi: z.string().min(1),
  })
  .strict();
export type MatrixResolverOutcomeExpectation = ResolverOutcomeExpectation;
const matrixIdentitySchema = z
  .object({
    caseId: stableIdentifierSchema,
    stateId: stableIdentifierSchema,
    sourceSha: sourceShaSchema,
    profile: seedProfileSchema,
    role: roleSchema,
    catalogRoute: z.string().min(1),
    resolvedRoute: z.string().min(1),
    networkPolicy: networkEvidencePolicySchema,
    state: stateAxesSchema,
    controlKey: z.string().min(1).optional(),
    declarationId: stableIdentifierSchema.optional(),
    resolverRecoveryOutcome: z
      .enum(["empty", "visible-current"])
      .nullable()
      .optional(),
    expectedOutcome: resolverOutcomeExpectationSchema.optional(),
  })
  .strict();
export const matrixExecutableCaseSchema = matrixIdentitySchema
  .extend({
    kind: z.literal("executable"),
    execution: matrixExecutionSchema,
    preparation: matrixPreparationSchema.optional(),
  })
  .strict();
export const matrixInapplicableCaseSchema = matrixIdentitySchema
  .extend({
    kind: z.literal("inapplicable"),
    inapplicable: matrixInapplicableSchema,
    preparation: matrixPreparationSchema.optional(),
  })
  .strict();
export const matrixRowSchema = z.union([
  matrixExecutableCaseSchema,
  matrixInapplicableCaseSchema,
]);
const matrixCountsSchema = z
  .object({
    executable: z.number().int().nonnegative(),
    inapplicable: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  })
  .strict()
  .refine(
    ({ executable, inapplicable, total }) =>
      executable + inapplicable === total,
    "matrix counts do not add up",
  );
const matrixLimitsSchema = z
  .object({
    maxCases: z.number().int().positive(),
    maxControlsPerSegment: z.number().int().positive(),
  })
  .strict();
const matrixBodySchema = z
  .object({
    version: z.literal(1),
    sourceSha: sourceShaSchema,
    viewport: viewportSchema,
    generatorSeed: z.string().min(1),
    rows: z.array(matrixRowSchema).readonly(),
    cases: z.array(matrixExecutableCaseSchema).readonly(),
    inapplicable: z.array(matrixInapplicableCaseSchema).readonly(),
    revealPaths: z.array(revealPathSchema).readonly(),
    revealSurfaces: z.array(revealSurfaceSchema).readonly(),
    revealTransitions: z.array(revealTransitionSchema).readonly(),
    coveredPairs: z.array(z.string().min(1)).readonly(),
    counts: matrixCountsSchema,
    limits: matrixLimitsSchema,
  })
  .strict();
export const frozenMatrixSchema = matrixBodySchema
  .extend({ digest: sha256DigestSchema })
  .strict();
export type MatrixExecutableCase = z.infer<typeof matrixExecutableCaseSchema>;
export type MatrixInapplicableCase = z.infer<
  typeof matrixInapplicableCaseSchema
>;
export type MatrixRow = z.infer<typeof matrixRowSchema>;
export type FrozenMatrix = z.infer<typeof frozenMatrixSchema>;
export class MatrixFinalizationError extends Error {
  override readonly name = "MatrixFinalizationError";
}

const expectedOutcomeFor = (
  route: Route,
  binding: AssignedBinding | undefined,
  state: CampaignMatrixState,
  sourceDigest: string | undefined,
  resolverOutcome: ResolverOutcomeKind | undefined,
  routeLabel: string,
): ResolverOutcomeExpectation | undefined => {
  if (route.kind !== "resolver" || binding === undefined) return undefined;
  if (sourceDigest === undefined)
    throw new MatrixFinalizationError(
      `Resolver route ${routeLabel} requires source digest`,
    );
  return resolverOutcomeExpectationFor({
    route,
    state,
    sourceDigest,
    ...(resolverOutcome === undefined ? {} : { outcome: resolverOutcome }),
  });
};

export const routeFor = (
  routes: readonly Route[],
  state: CampaignMatrixState,
  sourceDigest?: string,
  resolverOutcome?: ResolverOutcomeKind,
): Readonly<{
  readonly role: CampaignMatrixState["axes"]["role"];
  readonly catalogRoute: string;
  readonly resolvedRoute: string;
  readonly networkPolicy: z.infer<typeof networkEvidencePolicySchema>;
  readonly binding?: AssignedBinding;
  readonly expectedOutcome?: ResolverOutcomeExpectation;
}> => {
  const separator = state.axes.route.indexOf(":");
  const role =
    separator === -1 ? state.axes.role : state.axes.route.slice(0, separator);
  const catalogRoute =
    separator === -1 ? state.axes.route : state.axes.route.slice(separator + 1);
  const route = routes.find(
    (candidate) =>
      candidate.role === role && candidate.catalogRoute === catalogRoute,
  );
  if (route === undefined)
    throw new MatrixFinalizationError(
      `No route declaration for ${role}:${catalogRoute}`,
    );
  const routeRecord = route as unknown as Record<string, unknown>;
  if (
    !Object.hasOwn(routeRecord, "networkPolicy") ||
    routeRecord.networkPolicy === undefined
  )
    throw new MatrixFinalizationError(
      `Route declaration ${role}:${catalogRoute} has no network policy`,
    );
  const parsedNetworkPolicy = routeNetworkPolicySchema.safeParse(
    routeRecord.networkPolicy,
  );
  if (!parsedNetworkPolicy.success)
    throw new MatrixFinalizationError(
      `Route declaration ${role}:${catalogRoute} has invalid network policy`,
    );
  const binding = route.bindings?.find(
    (candidate): candidate is AssignedBinding =>
      candidate.profile === state.profile && candidate.status === "assigned",
  );
  const expectedOutcome = expectedOutcomeFor(
    route,
    binding,
    state,
    sourceDigest,
    resolverOutcome,
    `${role}:${catalogRoute}`,
  );
  return {
    role: state.axes.role,
    catalogRoute,
    resolvedRoute: binding?.resolvedRoute ?? route.resolvedRoute,
    networkPolicy: parsedNetworkPolicy.data ?? NO_ROUTE_CACHE_CONTRACT_POLICY,
    ...(binding === undefined ? {} : { binding }),
    ...(expectedOutcome === undefined ? {} : { expectedOutcome }),
  };
};
export const navigationExecution = (
  state: CampaignMatrixState,
): MatrixExecution => ({
  kind: "navigation",
  action: {
    controlKey: `route:${state.axes.route}`,
    operation: "navigate",
    safety: "read-only",
    transition: "none",
  },
});
export const executionFor = (
  control: MatrixPreflightControl,
): MatrixExecution => {
  if (control.execution !== undefined && control.action !== undefined)
    throw new MatrixFinalizationError(
      `Control ${control.controlKey} declares both action and execution`,
    );
  if (control.execution !== undefined) return control.execution;
  if (control.action !== undefined)
    return { kind: "control", action: control.action };
  throw new MatrixFinalizationError(
    `Control ${control.controlKey} has no bounded action or inapplicable reason`,
  );
};
export const stateForControl = (
  state: CampaignMatrixState,
  execution: MatrixExecution,
): CampaignMatrixState => {
  const action = "action" in execution ? execution.action : undefined;
  if (
    action === undefined ||
    state.axes.controlTransition !== "none" ||
    action.transition === "none"
  )
    return state;
  const axes = { ...state.axes, controlTransition: action.transition };
  return {
    ...state,
    axes,
    stateId: stableId("matrix-control-state", {
      base: state.stateId,
      transition: action.transition,
    }),
    pairwiseDigest: sha256Hex(axes),
  };
};
