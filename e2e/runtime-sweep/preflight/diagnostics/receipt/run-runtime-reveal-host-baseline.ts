import * as path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { assertRuntimeSourceAuthorityFromEnvironment } from "../../../source/runtime-source-authority.ts";
import {
  ensurePreflightArchiveDirectory,
  ensurePreflightArchiveRoot,
} from "../../preflight-archive-path.ts";
import {
  type DiagnosticHostEnvelopeCounters,
  type DiagnosticHostEnvelopeSnapshot,
  EMPTY_HOST_ENVELOPE_BREACH_STREAKS,
  HOST_ENVELOPE_THRESHOLDS,
  readDarwinHostEnvelopeSnapshot,
} from "../preflight-diagnostic-host-envelope.ts";
import { evaluateHostEnvelopeSample } from "../preflight-diagnostic-host-envelope-evaluator.ts";
import { createDiagnosticHostEnvelopeReceipt } from "../preflight-diagnostic-host-envelope-receipt.ts";
import { readHealthyPostInfrastructureReceipt } from "./preflight-diagnostic-host-envelope-post-infrastructure-reader.ts";

const requiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Host baseline requires ${name}`);
  return value;
};

const collectBaseline = async (input: {
  readonly receipt: Awaited<
    ReturnType<typeof createDiagnosticHostEnvelopeReceipt>
  >;
  readonly sample?: (
    phase: "post-infrastructure",
  ) => Promise<DiagnosticHostEnvelopeSnapshot>;
  readonly wait?: (milliseconds: number) => Promise<void>;
}): Promise<void> => {
  const sample = input.sample ?? readDarwinHostEnvelopeSnapshot;
  const wait = input.wait ?? ((milliseconds: number) => delay(milliseconds));
  // eslint-disable-next-line no-restricted-syntax -- counters advance across the ordered baseline
  let previousCounters: DiagnosticHostEnvelopeCounters | undefined;
  // eslint-disable-next-line no-restricted-syntax -- the prior sample anchors timestamp monotonicity
  let previousSnapshot: DiagnosticHostEnvelopeSnapshot | undefined;
  // eslint-disable-next-line no-restricted-syntax -- bounded sample index is required by the receipt contract
  for (
    let index = 0;
    index < HOST_ENVELOPE_THRESHOLDS.postInfrastructureBaselineSamples;
    index += 1
  ) {
    const snapshot = await sample("post-infrastructure");
    if (
      previousSnapshot !== undefined &&
      snapshot.timestampWall <= previousSnapshot.timestampWall
    )
      throw new Error(
        `Host baseline timestamp did not advance at sample ${String(index + 1)}`,
      );
    const evaluation = evaluateHostEnvelopeSample({
      snapshot,
      mode: "baseline",
      baselineSwapUsedBytes: snapshot.swapUsedBytes ?? 0,
      priorCounters: previousCounters,
      breachStreaks: EMPTY_HOST_ENVELOPE_BREACH_STREAKS,
    });
    await input.receipt.record({
      snapshot,
      status: evaluation.status,
      reasons: evaluation.reasons,
      breachStreaks: evaluation.breachStreaks,
    });
    if (
      evaluation.status !== "healthy" ||
      evaluation.nextCounters === undefined
    )
      throw new Error(`Host baseline failed at sample ${String(index + 1)}`);
    previousCounters = evaluation.nextCounters;
    previousSnapshot = snapshot;
    if (index + 1 < HOST_ENVELOPE_THRESHOLDS.postInfrastructureBaselineSamples)
      await wait(HOST_ENVELOPE_THRESHOLDS.sampleIntervalMs);
  }
};

export const runRuntimeRevealHostBaseline = async (): Promise<number> => {
  const sourceAuthority = await assertRuntimeSourceAuthorityFromEnvironment();
  const archiveRoot = await ensurePreflightArchiveRoot(
    path.resolve(requiredEnv("RUNTIME_SWEEP_ARCHIVE")),
  );
  const outputRoot = path.resolve(
    requiredEnv("RUNTIME_SWEEP_PREFLIGHT_HOST_CHECKPOINT_BASELINE_OUTPUT_ROOT"),
  );
  const campaignId = requiredEnv("RUNTIME_SWEEP_DIAGNOSTIC_CAMPAIGN_ID");
  if (campaignId !== sourceAuthority.source.campaignId)
    throw new Error("Host baseline campaign does not match SOURCE.json");
  await ensurePreflightArchiveDirectory(archiveRoot, outputRoot);
  const receipt = await createDiagnosticHostEnvelopeReceipt({
    archiveRoot,
    outputRoot,
    sourceSha: sourceAuthority.source.sourceSha,
    sourceTree: sourceAuthority.source.sourceTree,
    campaignId,
  });
  try {
    await collectBaseline({ receipt });
    const paths = await receipt.finalize({
      status: "healthy",
      reason: "post-infrastructure host checkpoint baseline passed",
    });
    const baseline = await readHealthyPostInfrastructureReceipt({
      archiveRoot,
      manifestPath: paths.manifestPath,
      sourceSha: sourceAuthority.source.sourceSha,
      sourceTree: sourceAuthority.source.sourceTree,
      campaignId,
    });
    console.log(
      `host-checkpoint-baseline PASS manifest=${baseline.manifestPath} digest=${baseline.baselineReceiptDigest}`,
    );
    return 0;
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    await receipt
      .finalize({ status: "inconclusive", reason })
      .catch(() => receipt.closeWithoutManifest());
    console.error(`[host-checkpoint-baseline] Failed: ${reason}`);
    return 1;
  }
};

if (
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
)
  void runRuntimeRevealHostBaseline();
