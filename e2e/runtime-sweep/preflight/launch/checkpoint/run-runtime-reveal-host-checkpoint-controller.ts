import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { assertRuntimeSourceAuthorityFromEnvironment } from "../../../source/runtime-source-authority.ts";
import { sha256Hex } from "../../../support/ids.ts";
import {
  preflightCanarySelectorFromEnvironment,
  resolvePreflightCanarySelection,
} from "../../canary/preflight-canary.ts";
import { readHealthyPostInfrastructureReceipt } from "../../diagnostics/receipt/preflight-diagnostic-host-envelope-post-infrastructure-reader.ts";
import { revealRouteFor } from "../../execution/playwright-preflight-support.ts";
import { runHostCheckpointController } from "./preflight-reveal-host-checkpoint-controller.ts";

const MAX_CONTROLLER_TIMEOUT_MINUTES = 30;
const SECONDS_PER_MINUTE = 60;
const MILLISECONDS_PER_SECOND = 1000;
const MAX_CONTROLLER_TIMEOUT_MS =
  MAX_CONTROLLER_TIMEOUT_MINUTES * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;

const requiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Host checkpoint controller requires ${name}`);
  return value;
};

const timeoutFromEnvironment = (): number => {
  const value = Number(
    requiredEnv("RUNTIME_SWEEP_PREFLIGHT_HOST_CONTROLLER_TIMEOUT_MS"),
  );
  if (
    !Number.isSafeInteger(value) ||
    value <= 0 ||
    value > MAX_CONTROLLER_TIMEOUT_MS
  )
    throw new Error("Host checkpoint controller timeout must be 1..1800000 ms");
  return value;
};

export const runRuntimeRevealHostCheckpointController =
  async (): Promise<number> => {
    const sourceAuthority = await assertRuntimeSourceAuthorityFromEnvironment();
    const selection = resolvePreflightCanarySelection({
      source: sourceAuthority.source,
      selector: preflightCanarySelectorFromEnvironment(process.env),
    });
    const revealRoute = revealRouteFor(selection.route);
    const archiveRoot = path.resolve(requiredEnv("RUNTIME_SWEEP_ARCHIVE"));
    const mailboxRoot = path.resolve(
      requiredEnv("RUNTIME_SWEEP_PREFLIGHT_HOST_CHECKPOINT_ROOT"),
    );
    const baselineManifest = path.resolve(
      requiredEnv("RUNTIME_SWEEP_PREFLIGHT_HOST_CHECKPOINT_BASELINE_MANIFEST"),
    );
    const campaignId = requiredEnv("RUNTIME_SWEEP_DIAGNOSTIC_CAMPAIGN_ID");
    if (campaignId !== sourceAuthority.source.campaignId)
      throw new Error(
        "Host checkpoint controller campaign does not match SOURCE.json",
      );
    const baseline = await readHealthyPostInfrastructureReceipt({
      archiveRoot,
      manifestPath: baselineManifest,
      sourceSha: sourceAuthority.source.sourceSha,
      sourceTree: sourceAuthority.source.sourceTree,
      campaignId,
    });
    const abortController = new AbortController();
    const timeout = setTimeout(
      () =>
        abortController.abort(
          new Error("Host checkpoint controller deadline exceeded"),
        ),
      timeoutFromEnvironment(),
    );
    try {
      await runHostCheckpointController({
        archiveRoot,
        mailboxRoot,
        sourceSha: sourceAuthority.source.sourceSha,
        sourceTree: sourceAuthority.source.sourceTree,
        campaignId,
        treeDigest: sourceAuthority.source.treeDigest,
        sourceDigest: sourceAuthority.source.sourceDigest,
        planDigest: sourceAuthority.source.plan.digest,
        stateId: selection.state.stateId,
        stateDigest: sha256Hex(selection.state),
        profile: selection.state.profile,
        role: revealRoute.role,
        route:
          selection.selector.route ??
          `${revealRoute.role}:${revealRoute.catalogRoute}`,
        routeDigest: sha256Hex(revealRoute),
        baseline,
        signal: abortController.signal,
        maxCheckpoints: sourceAuthority.source.matrixLimits.maxRevealActions,
      });
      return 0;
    } finally {
      clearTimeout(timeout);
    }
  };

if (
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
)
  void runRuntimeRevealHostCheckpointController().catch((error: unknown) => {
    console.error("[host-checkpoint-controller] Failed:", error);
    process.exitCode = 1;
  });
