import type {
  MatrixAxes,
  MatrixDeclaration,
  Role,
  RouteBindingTarget,
  RouteDeclaration,
  SeedCapability,
  SeedProfile,
  SeedProfileBinding,
} from "../source/contracts.ts";
import { makeStateId, sha256Hex } from "../support/ids.ts";
import {
  campaignMatrixConstraints,
  nominalLifecycleForRoute,
  permissionsForRole,
} from "./coverage-model/campaign-matrix-constraints.ts";
import {
  excludedStateCombinations,
  witnessCapability,
} from "./coverage-model/matrix-coverage.ts";
import {
  compilePairwiseMatrix,
  type MatrixInapplicable,
  type PairwiseState,
} from "./matrix.ts";

const DEFAULT_WITNESS: SeedCapability = "canonical-identities";
const NOMINAL_PERMISSION = "allowed" as const;

export interface CampaignMatrixInput {
  readonly sourceSha: string;
  readonly declaration: MatrixDeclaration;
  readonly routes: readonly RouteDeclaration[];
  readonly seedProfiles: readonly SeedProfileBinding[];
}

export interface CampaignMatrixState extends PairwiseState {
  readonly profile: SeedProfile;
}

export interface CampaignMatrixInapplicable extends MatrixInapplicable {
  readonly profile: SeedProfile;
}

export interface CampaignMatrixPlan {
  readonly states: readonly CampaignMatrixState[];
  readonly inapplicable: readonly CampaignMatrixInapplicable[];
  readonly digest: string;
}

const profileBinding = (
  profiles: readonly SeedProfileBinding[],
  profile: SeedProfile,
): SeedProfileBinding => {
  const binding = profiles.find((candidate) => candidate.profile === profile);
  if (!binding) throw new Error(`Campaign matrix has no profile ${profile}`);
  return binding;
};

const assignedProfiles = (route: RouteDeclaration): readonly SeedProfile[] => {
  if (!route.bindings)
    throw new Error(
      `Campaign matrix route has no bindings: ${route.role}:${route.catalogRoute}`,
    );
  return route.bindings.flatMap((binding) =>
    binding.status === "assigned" ? [binding.profile] : [],
  );
};

const assignedBinding = (route: RouteDeclaration, profile: SeedProfile) => {
  const binding = route.bindings?.find(
    (candidate) => candidate.profile === profile,
  );
  if (binding?.status !== "assigned")
    throw new Error(
      `Campaign matrix profile ${profile} is not assigned to ${route.role}:${route.catalogRoute}`,
    );
  return binding;
};

const remapCapabilityWitness = (
  matrix: ReturnType<typeof compilePairwiseMatrix>,
  sourceSha: string,
  generatorSeed: string,
  routeCapability: SeedCapability | null,
  available: readonly SeedCapability[],
): ReturnType<typeof compilePairwiseMatrix> => {
  const withWitness = (axes: MatrixAxes): MatrixAxes => ({
    ...axes,
    profileCapability: witnessCapability(axes, routeCapability, available),
  });
  return {
    ...matrix,
    states: matrix.states.map((state) => {
      const axes = withWitness(state.axes);
      return {
        ...state,
        stateId: makeStateId(sourceSha, generatorSeed, axes),
        axes,
        pairwiseDigest: sha256Hex(axes),
      };
    }),
    inapplicable: matrix.inapplicable.map((entry) => ({
      ...entry,
      axes: withWitness(entry.axes),
    })),
  };
};

const canonicalNominalState = (input: {
  readonly sourceSha: string;
  readonly generatorSeed: string;
  readonly role: Role;
  readonly route: string;
  readonly routeCapability: SeedCapability | null;
  readonly availableCapabilities: readonly SeedCapability[];
  readonly lifecycleValues: readonly MatrixAxes["lifecycle"][];
}): PairwiseState => {
  const lifecycle = nominalLifecycleForRoute(input);
  const candidate: MatrixAxes = {
    role: input.role,
    route: input.route,
    profileCapability: DEFAULT_WITNESS,
    lifecycle,
    submission: "draft",
    ownershipDensity: "single",
    permission: "allowed",
    fault: "none",
    controlTransition: "none",
  };
  const axes = {
    ...candidate,
    profileCapability: witnessCapability(
      candidate,
      input.routeCapability,
      input.availableCapabilities,
    ),
  };
  return {
    stateId: makeStateId(input.sourceSha, input.generatorSeed, axes),
    axes,
    pairwiseDigest: sha256Hex(axes),
  };
};

const withCanonicalNominalState = (
  states: readonly PairwiseState[],
  nominal: PairwiseState,
): readonly PairwiseState[] =>
  states.some(({ stateId }) => stateId === nominal.stateId)
    ? states
    : [...states, nominal];

const stateAxesFor = (
  input: CampaignMatrixInput,
  role: Role,
  routeTarget: RouteBindingTarget,
) =>
  routeTarget === "none"
    ? {
        lifecycle: ["open" as const],
        submission: ["draft" as const],
        ownershipDensity: ["single" as const],
        permission: [NOMINAL_PERMISSION],
      }
    : {
        lifecycle: input.declaration.axes.lifecycle,
        submission: input.declaration.axes.submission,
        ownershipDensity: input.declaration.axes.ownershipDensity,
        permission: permissionsForRole(role, input.declaration.axes.permission),
      };

const compileGroup = (
  input: CampaignMatrixInput,
  route: RouteDeclaration,
  profile: SeedProfile,
) => {
  const definition = profileBinding(input.seedProfiles, profile).definition;
  const binding = assignedBinding(route, profile);
  const routeCapability = binding.requiredCapability;
  const generatorSeed = `${input.declaration.generatorSeed}:${profile}:${route.role}:${route.catalogRoute}`;
  const stateAxes = stateAxesFor(input, route.role, binding.target);
  const witness = definition.capabilities.at(0) ?? DEFAULT_WITNESS;
  const matrix = compilePairwiseMatrix({
    sourceSha: input.sourceSha,
    generatorSeed,
    axes: {
      role: [route.role],
      route: [`${route.role}:${route.catalogRoute}`],
      profileCapability: [witness],
      lifecycle: stateAxes.lifecycle,
      submission: stateAxes.submission,
      ownershipDensity: stateAxes.ownershipDensity,
      permission: stateAxes.permission,
      fault: ["none"],
      controlTransition: ["none"],
    },
    constraints: campaignMatrixConstraints(
      definition.capabilities,
      routeCapability,
    ),
  });
  const remapped = remapCapabilityWitness(
    matrix,
    input.sourceSha,
    generatorSeed,
    routeCapability,
    definition.capabilities,
  );
  const states = withCanonicalNominalState(
    remapped.states,
    canonicalNominalState({
      sourceSha: input.sourceSha,
      generatorSeed,
      role: route.role,
      route: `${route.role}:${route.catalogRoute}`,
      routeCapability,
      availableCapabilities: definition.capabilities,
      lifecycleValues: stateAxes.lifecycle,
    }),
  );
  return {
    ...remapped,
    states,
    digest: sha256Hex({ pairwiseDigest: remapped.digest, states }),
    inapplicable: [
      ...remapped.inapplicable,
      ...excludedStateCombinations(
        route.role,
        `${route.role}:${route.catalogRoute}`,
        routeCapability,
        definition.capabilities,
        stateAxes,
      ),
    ],
  };
};

export function compileCampaignMatrix(
  input: CampaignMatrixInput,
): CampaignMatrixPlan {
  const groups = input.routes.flatMap((route) =>
    assignedProfiles(route).map((profile) => ({
      profile,
      matrix: compileGroup(input, route, profile),
    })),
  );
  const states = groups.flatMap(({ profile, matrix }) =>
    matrix.states.map((state) => ({ ...state, profile })),
  );
  const inapplicable = groups.flatMap(({ profile, matrix }) =>
    matrix.inapplicable.map((entry) => ({ ...entry, profile })),
  );
  return {
    states,
    inapplicable,
    digest: sha256Hex({
      sourceSha: input.sourceSha,
      declaration: input.declaration,
      states,
      inapplicable,
    }),
  };
}
