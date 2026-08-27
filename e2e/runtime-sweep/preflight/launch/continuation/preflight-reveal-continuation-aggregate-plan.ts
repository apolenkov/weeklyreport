import { sha256Hex } from "../../../support/ids.ts";
import { REVEAL_CONTINUATION_LIMITS } from "../../reveal/continuation/contracts/preflight-reveal-continuation-limits.ts";
import type { ParentContext } from "./preflight-reveal-continuation-parent.ts";
import {
  createRevealPartitionPlan,
  PREFLIGHT_REVEAL_AGGREGATE_CANDIDATE_RANGE_POLICY,
  PREFLIGHT_REVEAL_AGGREGATE_DEADLINE_POLICY,
  type RevealPartitionPlan,
} from "./preflight-reveal-continuation-partition.ts";

const DEFAULT_PARTITION_CANDIDATE_LIMIT =
  REVEAL_CONTINUATION_LIMITS.maxRevealActionDelta;
export const PREFLIGHT_REVEAL_AGGREGATE_PARTITION_CANDIDATE_LIMIT =
  DEFAULT_PARTITION_CANDIDATE_LIMIT;

const AGGREGATE_PARTITION_MINUTES = 75;
const MILLISECONDS_PER_MINUTE = 60_000;
export const PREFLIGHT_REVEAL_AGGREGATE_PARTITION_MAX_MS =
  AGGREGATE_PARTITION_MINUTES * MILLISECONDS_PER_MINUTE;

const AGGREGATE_TEARDOWN_MINUTES = 6;
const AGGREGATE_TEARDOWN_RESERVE_MS =
  AGGREGATE_TEARDOWN_MINUTES * MILLISECONDS_PER_MINUTE;
export const PREFLIGHT_REVEAL_AGGREGATE_TEARDOWN_RESERVE_MS =
  AGGREGATE_TEARDOWN_RESERVE_MS;
export {
  PREFLIGHT_REVEAL_AGGREGATE_CANDIDATE_RANGE_POLICY,
  PREFLIGHT_REVEAL_AGGREGATE_DEADLINE_POLICY,
};

export const aggregatePartitionPlanForContext = (input: {
  readonly context: ParentContext;
  readonly partitionCandidateLimit?: number;
  readonly partitionMaxMs?: number;
  readonly teardownReserveMs?: number;
}): RevealPartitionPlan =>
  createRevealPartitionPlan({
    campaignId: input.context.source.campaignId,
    sourceSha: input.context.source.sourceSha,
    sourceTree: input.context.source.sourceTree,
    sourceDigest: input.context.source.sourceDigest,
    planDigest: input.context.source.plan.digest,
    stateId: input.context.selection.state.stateId,
    stateDigest: sha256Hex(input.context.selection.state),
    profile: input.context.selection.state.profile,
    role: input.context.revealRoute.role,
    route:
      input.context.selection.selector.route ??
      `${input.context.revealRoute.role}:${input.context.revealRoute.catalogRoute}`,
    routeDigest: sha256Hex(input.context.revealRoute),
    maxRevealActions: input.context.source.matrixLimits.maxRevealActions,
    partitionCandidateLimit:
      input.partitionCandidateLimit ??
      PREFLIGHT_REVEAL_AGGREGATE_PARTITION_CANDIDATE_LIMIT,
    partitionMaxMs:
      input.partitionMaxMs ?? PREFLIGHT_REVEAL_AGGREGATE_PARTITION_MAX_MS,
    teardownReserveMs: input.teardownReserveMs ?? AGGREGATE_TEARDOWN_RESERVE_MS,
  });

export const aggregatePartitionSupervisorMaxMsFor = (
  plan: RevealPartitionPlan,
): number => plan.supervisorMaxMs;

export const aggregatePartitionAttemptMaxMsFor = (
  plan: RevealPartitionPlan,
): number => aggregatePartitionSupervisorMaxMsFor(plan);
