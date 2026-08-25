import {
  type ManifestCommandRunner,
  runGitCommand,
} from "../../source/manifest-source.ts";
import type { SourceArtifact } from "../../source/source-artifact.ts";
import { sha256Hex } from "../../support/ids.ts";
import {
  type PreflightRoute,
  routeForState,
} from "../execution/playwright-preflight-support.ts";
import {
  PREFLIGHT_CAMPAIGN_KINDS,
  type PreflightCampaignKind,
  type PreflightCanaryEnvironment,
  PreflightCanaryError,
  type PreflightCanaryLiveIdentity,
  type PreflightCanarySelection,
  type PreflightCanarySelector,
  preflightCanarySelectorSchema,
} from "./preflight-canary-contract.ts";

const selectorFields = (
  environment: PreflightCanaryEnvironment,
  stateId: string,
): Record<string, string> => ({
  stateId,
  ...(environment.RUNTIME_SWEEP_CANARY_ROLE?.trim()
    ? { role: environment.RUNTIME_SWEEP_CANARY_ROLE.trim() }
    : {}),
  ...(environment.RUNTIME_SWEEP_CANARY_ROUTE?.trim()
    ? { route: environment.RUNTIME_SWEEP_CANARY_ROUTE.trim() }
    : {}),
  ...(environment.RUNTIME_SWEEP_CANARY_PROFILE?.trim()
    ? { profile: environment.RUNTIME_SWEEP_CANARY_PROFILE.trim() }
    : {}),
});

const assertNoSelectorFields = (
  environment: PreflightCanaryEnvironment,
): void => {
  const fieldNames = [
    "RUNTIME_SWEEP_CANARY_STATE_ID",
    "RUNTIME_SWEEP_CANARY_ROLE",
    "RUNTIME_SWEEP_CANARY_ROUTE",
    "RUNTIME_SWEEP_CANARY_PROFILE",
  ];
  const configured = fieldNames.find((name) => environment[name] !== undefined);
  if (configured !== undefined)
    throw new PreflightCanaryError(
      "RUNTIME_SWEEP_CANARY_SELECTOR cannot be combined with field selector variables",
    );
};

export function preflightCanarySelectorFromEnvironment(
  environment: PreflightCanaryEnvironment,
): PreflightCanarySelector {
  const serialized = environment.RUNTIME_SWEEP_CANARY_SELECTOR?.trim();
  if (serialized !== undefined && serialized !== "") {
    assertNoSelectorFields(environment);
    try {
      return preflightCanarySelectorSchema.parse(
        JSON.parse(serialized) as unknown,
      );
    } catch (error: unknown) {
      throw new PreflightCanaryError(
        `RUNTIME_SWEEP_CANARY_SELECTOR is invalid: ${
          error instanceof Error ? error.message : "invalid JSON"
        }`,
      );
    }
  }
  const stateId = environment.RUNTIME_SWEEP_CANARY_STATE_ID?.trim();
  if (stateId === undefined || stateId === "")
    throw new PreflightCanaryError("RUNTIME_SWEEP_CANARY_STATE_ID is required");
  return preflightCanarySelectorSchema.parse(
    selectorFields(environment, stateId),
  );
}

/**
 * Resolves the explicit operator mode. A missing kind must never silently
 * turn a repair or resweep into an initial campaign that bypasses its canary.
 */
export function resolvePreflightCampaignKind(input: {
  readonly kind?: string;
  readonly canaryPath?: string;
  readonly stateId?: string;
}): PreflightCampaignKind {
  const configuredCanary =
    input.canaryPath !== undefined || input.stateId !== undefined;
  const rawKind = input.kind?.trim();
  if (input.kind !== undefined && rawKind === "")
    throw new PreflightCanaryError(
      "RUNTIME_SWEEP_CAMPAIGN_KIND cannot be empty",
    );
  if (rawKind === undefined)
    throw new PreflightCanaryError("RUNTIME_SWEEP_CAMPAIGN_KIND is required");
  if (!(PREFLIGHT_CAMPAIGN_KINDS as readonly string[]).includes(rawKind))
    throw new PreflightCanaryError(
      `Unsupported RUNTIME_SWEEP_CAMPAIGN_KIND: ${rawKind}`,
    );
  if (rawKind === "initial" && configuredCanary)
    throw new PreflightCanaryError(
      "Initial preflight cannot use repair canary selectors",
    );
  return rawKind as PreflightCampaignKind;
}

const assertExpectedSourceSha = (
  source: SourceArtifact,
  expectedSourceSha: string | undefined,
): void => {
  if (expectedSourceSha !== undefined && expectedSourceSha !== source.sourceSha)
    throw new PreflightCanaryError(
      `Preflight canary source SHA is stale: expected ${expectedSourceSha}, got ${source.sourceSha}`,
    );
};

const assertUniqueStateIds = (source: SourceArtifact): void => {
  const stateIds = source.plan.states.map(({ stateId }) => stateId);
  const duplicateStateId = stateIds.find(
    (stateId, index) => stateIds.indexOf(stateId) !== index,
  );
  if (duplicateStateId !== undefined)
    throw new PreflightCanaryError(
      `SOURCE.json contains duplicate state identity: ${duplicateStateId}`,
    );
};

const assertSelectorMatchesState = (
  selector: PreflightCanarySelector,
  state: SourceArtifact["plan"]["states"][number],
): void => {
  const mismatch = [
    selector.role !== undefined && selector.role !== state.axes.role
      ? "role"
      : undefined,
    selector.route !== undefined && selector.route !== state.axes.route
      ? "route"
      : undefined,
    selector.profile !== undefined && selector.profile !== state.profile
      ? "profile"
      : undefined,
  ].find((value) => value !== undefined);
  if (mismatch !== undefined)
    throw new PreflightCanaryError(
      `Preflight canary ${mismatch} does not match ${selector.stateId}`,
    );
};

const readLiveGitIdentity = async (
  runCommand: ManifestCommandRunner,
  repoRoot: string,
): Promise<Readonly<{ status: string; head: string; sourceTree: string }>> => {
  const status = await runCommand(
    ["status", "--porcelain=v1", "--untracked-files=all"],
    repoRoot,
  );
  const head = (
    await runCommand(["rev-parse", "--verify", "HEAD"], repoRoot)
  ).trim();
  const sourceTree = (
    await runCommand(["rev-parse", "--verify", "HEAD^{tree}"], repoRoot)
  ).trim();
  return { status, head, sourceTree };
};

const readLiveGitIdentitySafely = async (
  runCommand: ManifestCommandRunner,
  repoRoot: string,
): Promise<Readonly<{ status: string; head: string; sourceTree: string }>> => {
  try {
    return await readLiveGitIdentity(runCommand, repoRoot);
  } catch (error: unknown) {
    throw new PreflightCanaryError(
      `Cannot verify live Git identity before preflight canary: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
};

export async function assertLivePreflightSourceIdentity(input: {
  readonly source: SourceArtifact;
  readonly repoRoot: string;
  readonly runCommand?: ManifestCommandRunner;
  readonly expectedSourceSha?: string;
}): Promise<PreflightCanaryLiveIdentity> {
  const runCommand = input.runCommand ?? runGitCommand;
  assertExpectedSourceSha(input.source, input.expectedSourceSha);
  const live = await readLiveGitIdentitySafely(runCommand, input.repoRoot);
  if (live.status.trim() !== "")
    throw new PreflightCanaryError(
      "Preflight canary requires a clean worktree before browser execution",
    );
  if (live.head !== input.source.sourceSha)
    throw new PreflightCanaryError(
      `Preflight canary HEAD does not match SOURCE.json: expected ${input.source.sourceSha}, got ${live.head}`,
    );
  if (live.sourceTree !== input.source.sourceTree)
    throw new PreflightCanaryError(
      `Preflight canary tree does not match SOURCE.json: expected ${input.source.sourceTree}, got ${live.sourceTree}`,
    );
  const treeDigest = sha256Hex({
    sourceSha: input.source.sourceSha,
    tree: live.sourceTree,
  });
  if (treeDigest !== input.source.treeDigest)
    throw new PreflightCanaryError(
      "Preflight canary SOURCE.json treeDigest does not match its source/tree identity",
    );
  return { sourceSha: live.head, sourceTree: live.sourceTree, treeDigest };
}

export function resolvePreflightCanarySelection(input: {
  readonly source: SourceArtifact;
  readonly selector: unknown;
  readonly expectedSourceSha?: string;
}): PreflightCanarySelection {
  const selector = preflightCanarySelectorSchema.parse(input.selector);
  assertExpectedSourceSha(input.source, input.expectedSourceSha);
  assertUniqueStateIds(input.source);
  const state = input.source.plan.states.find(
    ({ stateId }) => stateId === selector.stateId,
  );
  if (state === undefined)
    throw new PreflightCanaryError(
      `Unknown preflight canary stateId: ${selector.stateId}`,
    );
  assertSelectorMatchesState(selector, state);
  const route: PreflightRoute = routeForState(input.source, state);
  return { selector, state, route };
}
