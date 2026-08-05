import { z } from "zod";

import {
  type Action,
  type CampaignManifest,
  type MatrixExecution,
  type MatrixExecutionInapplicable,
  matrixExecutionSchema,
  matrixInapplicableSchema,
  roleSchema,
  seedProfileSchema,
  sha256DigestSchema,
  sourceShaSchema,
  stableIdentifierSchema,
  type StateAxes,
  stateAxesSchema,
  viewportSchema,
} from "../source/contracts.ts";
import { sha256Hex, stableId } from "../support/ids.ts";
import type {
  CampaignMatrixPlan,
  CampaignMatrixState,
} from "./campaign-matrix.ts";
import { validateLegalMatrixRow } from "./matrix-execution-policy.ts";

export const DEFAULT_MAX_CONTROLS = 1024;
export const DEFAULT_MAX_CASES = 100_000;
export const DESKTOP_WIDTH = 1440;
export const DESKTOP_HEIGHT = 900;

type Route = CampaignManifest["routes"][number];
type AssignedBinding = Extract<
  NonNullable<Route["bindings"]>[number],
  { readonly status: "assigned" }
>;

const matrixIdentitySchema = z
  .object({
    caseId: stableIdentifierSchema,
    stateId: stableIdentifierSchema,
    sourceSha: sourceShaSchema,
    profile: seedProfileSchema,
    role: roleSchema,
    catalogRoute: z.string().min(1),
    resolvedRoute: z.string().min(1),
    state: stateAxesSchema,
  })
  .strict();

export const matrixExecutableCaseSchema = matrixIdentitySchema
  .extend({ kind: z.literal("executable"), execution: matrixExecutionSchema })
  .strict();
export const matrixInapplicableCaseSchema = matrixIdentitySchema
  .extend({
    kind: z.literal("inapplicable"),
    inapplicable: matrixInapplicableSchema,
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

export interface MatrixPreflightControl {
  readonly controlKey: string;
  readonly inventory: Readonly<{
    readonly ariaRole: string;
    readonly accessibleName: string;
    readonly enabled: boolean;
    readonly order: number;
    readonly domOrderKey: string;
  }>;
  readonly action?: Action | undefined;
  readonly execution?: MatrixExecution | undefined;
  readonly inapplicable?: MatrixExecutionInapplicable | undefined;
}

export interface MatrixPreflightEntry {
  readonly declarationId?: string | undefined;
  readonly state: CampaignMatrixState;
  readonly execution?: MatrixExecution | undefined;
  readonly inapplicable?: MatrixExecutionInapplicable | undefined;
}

export interface MatrixPreflightSegment {
  readonly state: CampaignMatrixState;
  readonly controls: readonly MatrixPreflightControl[];
  readonly specialized?: readonly MatrixPreflightEntry[] | undefined;
}

export interface MatrixFinalizationInput {
  readonly sourceSha: string;
  readonly declaration: CampaignManifest["matrixDeclaration"];
  readonly plan: CampaignMatrixPlan;
  readonly routes: readonly Route[];
  readonly preflight: readonly MatrixPreflightSegment[];
  readonly maxCases?: number;
  readonly maxControlsPerSegment?: number;
}

export class MatrixFinalizationError extends Error {
  override readonly name = "MatrixFinalizationError";
}

export const routeFor = (
  routes: readonly Route[],
  state: CampaignMatrixState,
): Readonly<{
  readonly role: CampaignMatrixState["axes"]["role"];
  readonly catalogRoute: string;
  readonly resolvedRoute: string;
  readonly binding?: AssignedBinding;
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
  const binding = route?.bindings?.find(
    (candidate): candidate is AssignedBinding =>
      candidate.profile === state.profile && candidate.status === "assigned",
  );
  return {
    role: state.axes.role,
    catalogRoute,
    resolvedRoute:
      binding?.resolvedRoute ?? route?.resolvedRoute ?? catalogRoute,
    ...(binding === undefined ? {} : { binding }),
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

const identityFor = (
  input: Pick<MatrixFinalizationInput, "sourceSha" | "routes">,
  state: CampaignMatrixState,
  work: unknown,
) => {
  const route = routeFor(input.routes, state);
  return {
    kind: "executable" as const,
    caseId: stableId("matrix-case", {
      sourceSha: input.sourceSha,
      profile: state.profile,
      state: state.axes,
      work,
    }),
    stateId: state.stateId,
    sourceSha: input.sourceSha,
    profile: state.profile,
    role: route.role,
    catalogRoute: route.catalogRoute,
    resolvedRoute: route.resolvedRoute,
    state: executionStateFor(state.axes),
  };
};

const executionStateFor = ({
  role: _role,
  route: _route,
  ...state
}: CampaignMatrixState["axes"]): StateAxes => state;

export const executable = (
  input: Pick<MatrixFinalizationInput, "sourceSha" | "routes">,
  state: CampaignMatrixState,
  execution: MatrixExecution,
  identity?: unknown,
): MatrixExecutableCase => {
  const route = routeFor(input.routes, state);
  if (route.binding === undefined)
    throw new MatrixFinalizationError(
      `Executable state is not assigned to a route: ${state.axes.route}:${state.profile}`,
    );
  const policy = validateLegalMatrixRow({
    state: executionStateFor(state.axes),
    execution,
  });
  if (!policy.ok)
    throw new MatrixFinalizationError(
      policy.issues
        .map(({ code, message }) => `${code}: ${message}`)
        .join("; "),
    );
  return matrixExecutableCaseSchema.parse({
    ...identityFor(input, state, identity ?? execution),
    execution,
  });
};

export const inapplicable = (
  input: Pick<MatrixFinalizationInput, "sourceSha" | "routes">,
  state: CampaignMatrixState,
  reason: MatrixExecutionInapplicable,
  identity?: unknown,
): MatrixInapplicableCase =>
  matrixInapplicableCaseSchema.parse({
    ...identityFor(input, state, identity ?? reason),
    kind: "inapplicable",
    inapplicable: reason,
  });
