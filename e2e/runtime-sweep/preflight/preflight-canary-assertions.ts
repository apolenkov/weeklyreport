import { z } from "zod";

import { roleSchema, seedProfileSchema } from "../source/contracts.ts";
import type { SourceArtifact } from "../source/source-artifact.ts";
import { stableSerialize } from "../support/ids.ts";
import { parsePreflightCanaryArtifact } from "./preflight-canary-artifact.ts";
import {
  type PreflightCanaryArtifact,
  PreflightCanaryError,
  type PreflightCanarySelection,
} from "./preflight-canary-contract.ts";
import { resolvePreflightCanarySelection } from "./preflight-canary-selection.ts";

const assertSourceIdentity = (
  source: SourceArtifact,
  canary: Extract<PreflightCanaryArtifact, { status: "PASS" }>,
): void => {
  const matches = [
    canary.campaignId === source.campaignId,
    canary.sourceSha === source.sourceSha,
    canary.sourceTree === source.sourceTree,
    canary.treeDigest === source.treeDigest,
    canary.sourceDigest === source.sourceDigest,
    canary.planDigest === source.plan.digest,
  ].every(Boolean);
  if (!matches)
    throw new PreflightCanaryError(
      "Preflight canary does not match the current clean source identity",
    );
};

const assertSegmentState = (
  canary: Extract<PreflightCanaryArtifact, { status: "PASS" }>,
  selection: PreflightCanarySelection,
): void => {
  if (
    stableSerialize(canary.segment.state) !== stableSerialize(selection.state)
  )
    throw new PreflightCanaryError(
      "Preflight canary segment state does not exactly match SOURCE.json",
    );
};

const requestedSelectionMismatch = (
  input: {
    readonly stateId?: string;
    readonly role?: z.infer<typeof roleSchema>;
    readonly route?: string;
    readonly profile?: z.infer<typeof seedProfileSchema>;
  },
  selection: PreflightCanarySelection,
): string | undefined => {
  if (input.stateId !== undefined && selection.state.stateId !== input.stateId)
    return `state: ${input.stateId}`;
  if (input.role !== undefined && selection.route.role !== input.role)
    return "role";
  if (input.route !== undefined && selection.state.axes.route !== input.route)
    return "route";
  if (input.profile !== undefined && selection.state.profile !== input.profile)
    return "profile";
  return undefined;
};

const assertRequestedSelection = (
  input: {
    readonly stateId?: string;
    readonly role?: z.infer<typeof roleSchema>;
    readonly route?: string;
    readonly profile?: z.infer<typeof seedProfileSchema>;
  },
  selection: PreflightCanarySelection,
): void => {
  const mismatch = requestedSelectionMismatch(input, selection);
  if (mismatch !== undefined)
    throw new PreflightCanaryError(
      mismatch.startsWith("state:")
        ? `Preflight canary state does not match required ${mismatch}`
        : `Preflight canary ${mismatch} assertion mismatched`,
    );
};

const routeForSelection = (selection: PreflightCanarySelection) => ({
  role: selection.route.role,
  catalogRoute: selection.route.catalogRoute,
  resolvedRoute: selection.route.resolvedRoute,
  ...(selection.route.kind === undefined ? {} : { kind: selection.route.kind }),
  ...(selection.route.landingRoute === undefined
    ? {}
    : { landingRoute: selection.route.landingRoute }),
  ...(selection.route.expectedOutcome === undefined
    ? {}
    : { expectedOutcome: selection.route.expectedOutcome }),
});

const assertRouteIdentity = (
  canary: Extract<PreflightCanaryArtifact, { status: "PASS" }>,
  selection: PreflightCanarySelection,
): void => {
  if (
    stableSerialize(canary.route) !==
    stableSerialize(routeForSelection(selection))
  )
    throw new PreflightCanaryError(
      "Preflight canary route identity does not match SOURCE.json",
    );
};

export function assertPreflightCanaryPassForSource(input: {
  readonly source: SourceArtifact;
  readonly canary: PreflightCanaryArtifact;
  readonly stateId?: string;
  readonly role?: z.infer<typeof roleSchema>;
  readonly route?: string;
  readonly profile?: z.infer<typeof seedProfileSchema>;
}): PreflightCanarySelection {
  const canary = parsePreflightCanaryArtifact(input.canary);
  if (canary.status !== "PASS")
    throw new PreflightCanaryError(
      `Matching preflight canary is not PASS: ${canary.status}`,
    );
  assertSourceIdentity(input.source, canary);
  const selection = resolvePreflightCanarySelection({
    source: input.source,
    selector: canary.selector,
    expectedSourceSha: input.source.sourceSha,
  });
  assertSegmentState(canary, selection);
  assertRequestedSelection(input, selection);
  assertRouteIdentity(canary, selection);
  return selection;
}
