import * as path from "node:path";

import type { SourceArtifact } from "../../../source/source-artifact.ts";
import { resolvePreflightCanarySelection } from "../../canary/preflight-canary.ts";
import type { PreflightCanarySelector } from "../../canary/preflight-canary-contract.ts";
import {
  type RunPlaywright,
  runPreflightRevealContinuation,
} from "../continuation/preflight-reveal-continuation-parent.ts";
import { createFileBackedHostCheckpointClient } from "./preflight-reveal-host-checkpoint-client.ts";

export const runExactAdminDemoRevealCanary = async (input: {
  readonly source: SourceArtifact;
  readonly repoRoot: string;
  readonly archiveRoot: string;
  readonly canaryPath: string;
  readonly selector: PreflightCanarySelector;
  readonly hostCheckpointRoot: string;
  readonly hostCheckpointBaselineDigest: string;
  readonly runPlaywright: RunPlaywright;
}): Promise<number> => {
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
  const requestHostCheckpoint = await createFileBackedHostCheckpointClient({
    archiveRoot: input.archiveRoot,
    root: input.hostCheckpointRoot,
    expectedBaselineReceiptDigest: input.hostCheckpointBaselineDigest,
  });
  return runPreflightRevealContinuation({
    source: input.source,
    repoRoot: input.repoRoot,
    archiveRoot: input.archiveRoot,
    canaryPath: input.canaryPath,
    selector: input.selector,
    baselineReceiptDigest: input.hostCheckpointBaselineDigest,
    runPlaywright: input.runPlaywright,
    requestHostCheckpoint,
  });
};
