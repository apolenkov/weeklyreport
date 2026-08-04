import type {
  MatrixAxes,
  MatrixDeclaration,
  PermissionBoundary,
  Role,
  RouteDeclaration,
  SeedCapability,
  SeedProfile,
  SeedProfileBinding,
} from "./contracts.ts";
import { makeStateId, sha256Hex } from "./ids.ts";
import {
  compilePairwiseMatrix,
  type MatrixConstraint,
  type MatrixInapplicable,
  type PairwiseState,
} from "./matrix.ts";
import {
  excludedStateCombinations,
  stateCapabilities,
  witnessCapability,
} from "./matrix-coverage.ts";

const DEFAULT_WITNESS: SeedCapability = "canonical-identities";

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

const ROLE_PERMISSIONS: Readonly<
  Record<Role, ReadonlySet<PermissionBoundary>>
> = {
  lead: new Set(["allowed", "owner", "non-owner", "anonymous", "forbidden"]),
  head: new Set(["allowed", "head", "anonymous"]),
  admin: new Set(["allowed", "admin", "anonymous"]),
  viewer: new Set(["allowed", "viewer", "anonymous"]),
};

const NOMINAL_PERMISSION: Readonly<Record<Role, PermissionBoundary>> = {
  lead: "allowed",
  head: "allowed",
  admin: "allowed",
  viewer: "allowed",
};

const constraints = (
  availableCapabilities: readonly SeedCapability[],
  routeCapability: SeedCapability | null,
): readonly MatrixConstraint[] => [
  {
    id: "profile-capability-boundary",
    reason: "State requires a capability absent from the seed profile",
    check: (axes) =>
      stateCapabilities(axes, routeCapability).every((capability) =>
        availableCapabilities.includes(capability),
      ),
    checkPartial: (axes) =>
      stateCapabilities(axes, routeCapability).every((capability) =>
        availableCapabilities.includes(capability),
      ),
  },
  {
    id: "role-permission-boundary",
    reason: "Permission boundary is not meaningful for the session role",
    check: ({ role, permission }) => ROLE_PERMISSIONS[role].has(permission),
    checkPartial: ({ role, permission }) =>
      role === undefined ||
      permission === undefined ||
      ROLE_PERMISSIONS[role].has(permission),
  },
  {
    id: "ownership-permission-boundary",
    reason: "Owner permission requires an assigned stage",
    check: ({ ownershipDensity, permission }) =>
      permission !== "owner" || ownershipDensity !== "none",
    checkPartial: ({ ownershipDensity, permission }) =>
      permission === undefined ||
      ownershipDensity === undefined ||
      permission !== "owner" ||
      ownershipDensity !== "none",
  },
];

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

const compileGroup = (
  input: CampaignMatrixInput,
  route: RouteDeclaration,
  profile: SeedProfile,
) => {
  const definition = profileBinding(input.seedProfiles, profile).definition;
  const binding = route.bindings?.find(
    (candidate) => candidate.profile === profile,
  );
  if (binding?.status !== "assigned")
    throw new Error(
      `Campaign matrix profile ${profile} is not assigned to ${route.role}:${route.catalogRoute}`,
    );
  const routeCapability = binding.requiredCapability;
  const generatorSeed = `${input.declaration.generatorSeed}:${profile}:${route.role}:${route.catalogRoute}`;
  const stateAxes =
    binding.target === "none"
      ? {
          lifecycle: ["open" as const],
          submission: ["draft" as const],
          ownershipDensity: ["single" as const],
          permission: [NOMINAL_PERMISSION[route.role]],
        }
      : {
          lifecycle: input.declaration.axes.lifecycle,
          submission: input.declaration.axes.submission,
          ownershipDensity: input.declaration.axes.ownershipDensity,
          permission: input.declaration.axes.permission.filter((value) =>
            ROLE_PERMISSIONS[route.role].has(value),
          ),
        };
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
    constraints: constraints(definition.capabilities, routeCapability),
  });
  const remapped = remapCapabilityWitness(
    matrix,
    input.sourceSha,
    generatorSeed,
    routeCapability,
    definition.capabilities,
  );
  return {
    ...remapped,
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
