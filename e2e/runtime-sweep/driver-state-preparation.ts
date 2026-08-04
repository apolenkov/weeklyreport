import {
  parseSeedProfile,
  type SeedProfile,
} from "../../prisma/seed-profile-contract.js";
import type { Role } from "./contracts.ts";
import type { DriveEnvironment } from "./driver-environment.ts";
import { DriverAssignmentError } from "./driver-errors.ts";
import type { DriverShardAssignment } from "./driver-shards.ts";
import type {
  PreparedRuntimeState,
  StatePreparationRequest,
} from "./state-preparation.ts";

export type DriverStatePreparationResult = Pick<
  PreparedRuntimeState,
  "observation"
>;

export type DriverStatePreparer = (
  request: StatePreparationRequest,
) => Promise<DriverStatePreparationResult>;

export const buildDriverStatePreparationRequest = (
  environment: DriveEnvironment,
  profile: SeedProfile,
  role: Role,
  shard: DriverShardAssignment,
): StatePreparationRequest => ({
  profile: parseSeedProfile(profile),
  axes: {
    lifecycle: shard.state.lifecycle,
    submission: shard.state.submission,
    ownership: shard.state.ownershipDensity,
    permission: shard.state.permission,
  },
  databaseUrl: environment.databaseUrl,
  repoRoot: environment.repoRoot,
  routeRole: role,
  routeTarget: shard.routeTarget,
});

export async function prepareDriverShardState(
  environment: DriveEnvironment,
  profile: SeedProfile,
  role: Role,
  shard: DriverShardAssignment,
  prepare: DriverStatePreparer,
): Promise<DriverStatePreparationResult> {
  const request = buildDriverStatePreparationRequest(
    environment,
    profile,
    role,
    shard,
  );
  const prepared = await prepare(request);
  if (!prepared.observation.matches)
    throw new DriverAssignmentError(
      `Frozen state oracle mismatch for ${shard.stateId}: ${JSON.stringify(prepared.observation.mismatches)}`,
    );
  return prepared;
}
