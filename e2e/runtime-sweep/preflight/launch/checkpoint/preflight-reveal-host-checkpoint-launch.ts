import * as path from "node:path";

import type { SourceArtifact } from "../../../source/source-artifact.ts";
import { sha256Hex } from "../../../support/ids.ts";
import { resolvePreflightCanarySelection } from "../../canary/preflight-canary.ts";
import type { PreflightCanarySelector } from "../../canary/preflight-canary-contract.ts";
import { revealRouteFor } from "../../execution/playwright-preflight-support.ts";
import {
  aggregatePartitionAttemptMaxMsFor,
  PREFLIGHT_REVEAL_AGGREGATE_PARTITION_CANDIDATE_LIMIT,
  PREFLIGHT_REVEAL_AGGREGATE_PARTITION_MAX_MS,
  PREFLIGHT_REVEAL_AGGREGATE_TEARDOWN_RESERVE_MS,
} from "../continuation/preflight-reveal-continuation-aggregate.ts";
import {
  type RunPlaywright,
  runPreflightRevealContinuation,
} from "../continuation/preflight-reveal-continuation-parent.ts";
import {
  createRevealPartitionPlan,
  type RevealPartitionPlan,
} from "../continuation/preflight-reveal-continuation-partition.ts";
import { createFileBackedHostCheckpointClient } from "./preflight-reveal-host-checkpoint-client.ts";
import {
  createRevealCanaryLifecycle,
  type RunHostCheckpointController,
  settleControllerAfterParentExit,
  settleControllerAfterParentFailure,
} from "./preflight-reveal-host-checkpoint-lifecycle.ts";
import { runRuntimeRevealHostCheckpointController } from "./run-runtime-reveal-host-checkpoint-controller.ts";

const assertExactAdminDemoLaunch = (input: {
  readonly source: SourceArtifact;
  readonly archiveRoot: string;
  readonly hostCheckpointRoot: string;
  readonly selector: PreflightCanarySelector;
}): void => {
  const expectedRoot = path.join(
    input.archiveRoot,
    "5.19-admin-demo",
    "host-checkpoints",
  );
  if (
    path.resolve(input.hostCheckpointRoot) !== input.hostCheckpointRoot ||
    input.hostCheckpointRoot !== expectedRoot
  )
    throw new Error(
      "RUNTIME_SWEEP_PREFLIGHT_HOST_CHECKPOINT_ROOT must be the exact normalized admin/demo canary archive root",
    );
  const selection = resolvePreflightCanarySelection({
    source: input.source,
    selector: input.selector,
  });
  if (
    selection.state.axes.role !== "admin" ||
    selection.state.profile !== "demo" ||
    selection.state.axes.route !== "admin:/admin"
  )
    throw new Error(
      "Reveal host checkpoint continuation is only enabled for the exact admin/demo canary",
    );
};

const aggregatePlanForInput = (input: {
  readonly source: SourceArtifact;
  readonly selector: PreflightCanarySelector;
}): RevealPartitionPlan => {
  const selection = resolvePreflightCanarySelection({
    source: input.source,
    selector: input.selector,
  });
  const revealRoute = revealRouteFor(selection.route);
  return createRevealPartitionPlan({
    campaignId: input.source.campaignId,
    sourceSha: input.source.sourceSha,
    sourceTree: input.source.sourceTree,
    sourceDigest: input.source.sourceDigest,
    planDigest: input.source.plan.digest,
    stateId: selection.state.stateId,
    stateDigest: sha256Hex(selection.state),
    profile: selection.state.profile,
    role: revealRoute.role,
    route:
      selection.selector.route ??
      `${revealRoute.role}:${revealRoute.catalogRoute}`,
    routeDigest: sha256Hex(revealRoute),
    maxRevealActions: input.source.matrixLimits.maxRevealActions,
    partitionCandidateLimit:
      PREFLIGHT_REVEAL_AGGREGATE_PARTITION_CANDIDATE_LIMIT,
    partitionMaxMs: PREFLIGHT_REVEAL_AGGREGATE_PARTITION_MAX_MS,
    teardownReserveMs: PREFLIGHT_REVEAL_AGGREGATE_TEARDOWN_RESERVE_MS,
  });
};

export const runExactAdminDemoRevealCanary = async (input: {
  readonly source: SourceArtifact;
  readonly repoRoot: string;
  readonly archiveRoot: string;
  readonly canaryPath: string;
  readonly selector: PreflightCanarySelector;
  readonly hostCheckpointRoot: string;
  readonly hostCheckpointBaselineDigest: string;
  readonly runPlaywright: RunPlaywright;
  readonly beforeRun?: Parameters<
    typeof runPreflightRevealContinuation
  >[0]["beforeRun"];
  readonly afterRun?: Parameters<
    typeof runPreflightRevealContinuation
  >[0]["afterRun"];
  readonly beforeAggregateTerminalPublication?: Parameters<
    typeof runPreflightRevealContinuation
  >[0]["beforeAggregateTerminalPublication"];
  readonly runHostCheckpointController?: RunHostCheckpointController;
  /** Use the source-bound aggregate partition runner instead of one 24-minute attempt. */
  readonly aggregatePartitions?: boolean;
}): Promise<number> => {
  assertExactAdminDemoLaunch(input);
  const aggregatePlan: RevealPartitionPlan | undefined =
    input.aggregatePartitions === true
      ? aggregatePlanForInput(input)
      : undefined;
  const requestHostCheckpoint = await createFileBackedHostCheckpointClient({
    archiveRoot: input.archiveRoot,
    root: input.hostCheckpointRoot,
    expectedBaselineReceiptDigest: input.hostCheckpointBaselineDigest,
  });
  const lifecycle = createRevealCanaryLifecycle(
    input.runHostCheckpointController ??
      runRuntimeRevealHostCheckpointController,
    aggregatePlan === undefined
      ? undefined
      : aggregatePartitionAttemptMaxMsFor(aggregatePlan),
  );
  try {
    const exitCode = await runPreflightRevealContinuation({
      source: input.source,
      repoRoot: input.repoRoot,
      archiveRoot: input.archiveRoot,
      canaryPath: input.canaryPath,
      selector: input.selector,
      baselineReceiptDigest: input.hostCheckpointBaselineDigest,
      runPlaywright: input.runPlaywright,
      requestHostCheckpoint,
      signal: lifecycle.signal,
      deadlineAt: lifecycle.deadlineAt,
      deadlineMonotonic: lifecycle.deadlineMonotonic,
      monotonicNow: lifecycle.monotonicNow,
      ...(aggregatePlan === undefined ? {} : { aggregatePlan }),
      ...(input.beforeRun === undefined ? {} : { beforeRun: input.beforeRun }),
      ...(input.afterRun === undefined ? {} : { afterRun: input.afterRun }),
      ...(input.beforeAggregateTerminalPublication === undefined
        ? {}
        : {
            beforeAggregateTerminalPublication:
              input.beforeAggregateTerminalPublication,
          }),
    }).catch((error: unknown) =>
      settleControllerAfterParentFailure(lifecycle, error),
    );
    await settleControllerAfterParentExit(lifecycle, exitCode);
    return exitCode;
  } finally {
    lifecycle.close();
  }
};
