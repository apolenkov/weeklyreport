import type { DbRole } from "@customreport/shared";

import {
  ADMIN_USER_ID,
  HEAD_USER_ID,
  LEAD_1_ID,
  LEAD_MARIA_ID,
  VIEWER_USER_ID,
} from "../../../prisma/seeds/support/seed-constants.ts";
import {
  SEED_USERS,
  type SeedUser,
} from "../../../prisma/seeds/support/seed-people.ts";
import {
  type CoverageCell,
  type MatrixAxes,
  type Oracle,
  type PermissionBoundary,
  type Role,
  stateAxesSchema,
} from "../source/contracts.ts";
import { type CampaignMatrixState } from "./campaign-matrix.ts";

export type {
  RuntimeMatrixSelection,
  RuntimeMatrixSource,
} from "./runtime-matrix-manifest.ts";
export {
  assertFreshRuntimeManifest,
  DEFAULT_RUNTIME_MATRIX_MAX_CELLS,
  loadRuntimeMatrix,
  routeForState,
  selectRuntimeStates,
} from "./runtime-matrix-manifest.ts";

export const RUNTIME_MATRIX_ORACLE: Oracle = {
  domainSpecRefs: [
    "openspec/specs/exhaustive-runtime-sweep/spec.md",
    "openspec/specs/behavioral-ui-regression-gate/spec.md",
  ],
  function: {
    required: true,
    expectation: "The bound route resolves for the prepared domain state",
  },
  accessibility: {
    required: true,
    expectation: "Visible controls expose usable role and name semantics",
  },
  visual: {
    required: true,
    expectation: "Chromium desktop geometry has no unbounded overflow",
  },
};

export type RuntimeMatrixActor = Readonly<{
  readonly id: string | null;
  readonly role: DbRole | null;
  readonly email: string | null;
}>;

const actorFromId = (id: string): RuntimeMatrixActor => {
  const user = userById(id);
  return { id: user.id, role: user.role, email: user.email };
};

const canonicalUserId = (role: Role): string => {
  switch (role) {
    case "lead":
      return LEAD_1_ID;
    case "head":
      return HEAD_USER_ID;
    case "admin":
      return ADMIN_USER_ID;
    case "viewer":
      return VIEWER_USER_ID;
    default:
      return assertNever(role);
  }
};

const userById = (id: string): SeedUser => {
  const user = SEED_USERS.find((candidate) => candidate.id === id);
  if (!user) throw new Error(`Seed user is missing: ${id}`);
  return user;
};

export function actorForPermission(
  boundary: PermissionBoundary,
  routeRole: Role,
): RuntimeMatrixActor {
  switch (boundary) {
    case "anonymous":
      return { id: null, role: null, email: null };
    case "allowed":
      return actorFromId(canonicalUserId(routeRole));
    case "owner":
      return actorFromId(LEAD_1_ID);
    case "non-owner":
    case "forbidden":
      return actorFromId(LEAD_MARIA_ID);
    case "head": {
      return actorFromId(HEAD_USER_ID);
    }
    case "admin": {
      return actorFromId(ADMIN_USER_ID);
    }
    case "viewer": {
      return actorFromId(VIEWER_USER_ID);
    }
    default:
      return assertNever(boundary);
  }
}

function assertNever(_value: never): never {
  throw new Error("Unknown runtime matrix value");
}

export function stateAxesFromMatrix(
  state: CampaignMatrixState,
): CoverageCell["state"] {
  const axes: MatrixAxes = state.axes;
  return stateAxesSchema.parse({
    profileCapability: axes.profileCapability,
    lifecycle: axes.lifecycle,
    submission: axes.submission,
    ownershipDensity: axes.ownershipDensity,
    permission: axes.permission,
    fault: axes.fault,
    controlTransition: axes.controlTransition,
  });
}
