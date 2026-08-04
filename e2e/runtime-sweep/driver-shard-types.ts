import type {
  MatrixExecutionKind,
  Role,
  RouteBindingTarget,
  SeedProfile,
  StateAxes,
} from "./contracts.ts";

export const MAX_DRIVER_SHARD_CASES = 32;

export interface DriverExecutionLaneSummary {
  readonly caseCount: number;
  readonly actionCount: number;
  readonly observationCount: number;
  readonly kinds: readonly MatrixExecutionKind[];
  readonly transitions: readonly string[];
  readonly summary: string;
}

export interface DriverShardAssignment {
  readonly shardId: string;
  readonly shardIndex: number;
  readonly shardCount: number;
  readonly digest: string;
  readonly sourceSha: string;
  readonly profile: SeedProfile;
  readonly role: Role;
  readonly catalogRoute: string;
  readonly resolvedRoute: string;
  readonly routeTarget: RouteBindingTarget;
  readonly stateId: string;
  readonly state: StateAxes;
  readonly caseIds: readonly string[];
  readonly executionLane: DriverExecutionLaneSummary;
}

export interface DriverShardPlan {
  readonly assignments: readonly DriverShardAssignment[];
  readonly totalShards: number;
}

export class DriverShardError extends Error {
  override readonly name = "DriverShardError";
}
