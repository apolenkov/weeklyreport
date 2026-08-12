import { lstat } from "node:fs/promises";
import * as path from "node:path";

import type { ManifestCommandRunner } from "../../source/manifest-source.ts";
import type { SourceArtifact } from "../../source/source-artifact.ts";
import {
  assertLivePreflightSourceIdentity,
  type PreflightCampaignKind,
  PreflightCanaryError,
  resolvePreflightCampaignKind,
  resolvePreflightCanarySelection,
} from "../canary/preflight-canary.ts";

export type PreflightLaunchMode = "canary" | "full";

export type PreflightLaunchGateResult = Readonly<{
  readonly campaignKind: PreflightCampaignKind;
  readonly canaryRequired: boolean;
}>;

type PreflightLaunchInput = Readonly<{
  readonly mode: PreflightLaunchMode;
  readonly source: SourceArtifact;
  readonly repoRoot: string;
  readonly campaignKind?: string;
  readonly canaryPath?: string;
  readonly stateId?: string;
  readonly selector?: unknown;
  readonly expectedSourceSha?: string;
  readonly runGitCommand?: ManifestCommandRunner;
}>;

const assertCanaryOutputAbsent = async (canaryPath: string): Promise<void> => {
  const outputPath = path.resolve(canaryPath);
  try {
    await lstat(outputPath);
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return;
    throw error;
  }
  throw new PreflightCanaryError(
    `Preflight canary output already exists: ${outputPath}`,
  );
};

const assertCanaryLaunch = async (
  input: PreflightLaunchInput,
  campaignKind: PreflightCampaignKind,
): Promise<PreflightLaunchGateResult> => {
  if (campaignKind === "initial")
    throw new PreflightCanaryError(
      "An initial campaign cannot run a repair preflight canary",
    );
  if (input.canaryPath === undefined || input.stateId === undefined)
    throw new PreflightCanaryError(
      "Preflight canary launch requires both RUNTIME_SWEEP_PREFLIGHT_CANARY and RUNTIME_SWEEP_PREFLIGHT_REQUIRED_STATE_ID",
    );
  if (input.selector === undefined)
    throw new PreflightCanaryError(
      "Preflight canary launch requires an exact selector",
    );
  const selection = resolvePreflightCanarySelection({
    source: input.source,
    selector: input.selector,
    ...(input.expectedSourceSha === undefined
      ? {}
      : { expectedSourceSha: input.expectedSourceSha }),
  });
  if (selection.state.stateId !== input.stateId)
    throw new PreflightCanaryError(
      "Preflight canary launch state does not match its exact selector",
    );
  await assertCanaryOutputAbsent(input.canaryPath);
  return { campaignKind, canaryRequired: true };
};

const assertSourceIdentityBeforeLaunch = (
  input: PreflightLaunchInput,
): Promise<void> =>
  assertLivePreflightSourceIdentity({
    source: input.source,
    repoRoot: input.repoRoot,
    ...(input.expectedSourceSha === undefined
      ? {}
      : { expectedSourceSha: input.expectedSourceSha }),
    ...(input.runGitCommand === undefined
      ? {}
      : { runCommand: input.runGitCommand }),
  }).then(() => undefined);

const resolveLaunchCampaignKind = (
  input: PreflightLaunchInput,
): PreflightCampaignKind =>
  resolvePreflightCampaignKind({
    ...(input.campaignKind === undefined ? {} : { kind: input.campaignKind }),
    ...(input.canaryPath === undefined ? {} : { canaryPath: input.canaryPath }),
    ...(input.stateId === undefined ? {} : { stateId: input.stateId }),
  });

const assertFullLaunch = (
  campaignKind: PreflightCampaignKind,
): PreflightLaunchGateResult => {
  if (campaignKind === "initial")
    return { campaignKind, canaryRequired: false };
  throw new PreflightCanaryError(
    "Repair/resweep full preflight must use the supported test:runtime-preflight-repair chain",
  );
};

/**
 * Applies the source and repair-canary gate before Playwright starts servers,
 * creates a browser, or reaches any database-reset path.
 */
export async function assertPreflightLaunchGate(
  input: PreflightLaunchInput,
): Promise<PreflightLaunchGateResult> {
  await assertSourceIdentityBeforeLaunch(input);
  const campaignKind = resolveLaunchCampaignKind(input);
  if (input.mode === "canary") return assertCanaryLaunch(input, campaignKind);
  return assertFullLaunch(campaignKind);
}
