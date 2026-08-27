import { sha256Hex } from "../../support/ids.ts";
import { assertCompactPreflightRevealData } from "../artifacts/preflight-artifact-reveal.ts";
import {
  type PreflightCanaryArtifact,
  PreflightCanaryError,
} from "./preflight-canary-contract.ts";

export const assertPreflightCanaryPassContents = (
  parsed: Extract<PreflightCanaryArtifact, { status: "PASS" }>,
): void => {
  if (parsed.segment.state.stateId !== parsed.selector.stateId)
    throw new PreflightCanaryError(
      "PREFLIGHT_CANARY.json segment does not match its selector",
    );
  if (
    parsed.segmentDigest !==
    sha256Hex({
      segment: parsed.segment,
      revealPaths: parsed.revealPaths,
      revealSurfaces: parsed.revealSurfaces,
      revealTransitions: parsed.revealTransitions,
    })
  )
    throw new PreflightCanaryError(
      "PREFLIGHT_CANARY.json segment digest does not match contents",
    );
  try {
    assertCompactPreflightRevealData({
      segments: [parsed.segment],
      revealPaths: parsed.revealPaths,
      revealSurfaces: parsed.revealSurfaces,
      revealTransitions: parsed.revealTransitions,
    });
  } catch (error: unknown) {
    throw new PreflightCanaryError(
      `PREFLIGHT_CANARY.json reveal data is invalid: ${
        error instanceof Error ? error.message : "invalid reveal metadata"
      }`,
    );
  }
};

export const assertPreflightCanaryBudgetFailureContents = (
  parsed: Extract<PreflightCanaryArtifact, { status: "FAIL_NOT_PROVEN" }>,
): void => {
  if (
    parsed.frontierDigest !== sha256Hex(parsed.frontier) ||
    parsed.functionalRemainingMs >= parsed.requiredChildWindowMs
  )
    throw new PreflightCanaryError(
      "PREFLIGHT_CANARY.json budget failure bindings do not match contents",
    );
  const hasCheckpointDigest = parsed.lastCheckpointDigest !== null;
  const hasCheckpointSequence = parsed.lastCheckpointSequence !== null;
  const hasSampleSequence = parsed.lastSampleSequence !== null;
  if (
    hasCheckpointDigest !== hasCheckpointSequence ||
    hasCheckpointDigest !== hasSampleSequence
  )
    throw new PreflightCanaryError(
      "PREFLIGHT_CANARY.json checkpoint and sample bindings must be complete",
    );
  if (
    (parsed.nextChildOrdinal === 0 && hasCheckpointDigest) ||
    (parsed.nextChildOrdinal > 0 && !hasCheckpointDigest)
  )
    throw new PreflightCanaryError(
      "PREFLIGHT_CANARY.json checkpoint bindings do not match child ordinal",
    );
  if (
    hasCheckpointSequence &&
    parsed.lastCheckpointSequence !== parsed.nextChildOrdinal
  )
    throw new PreflightCanaryError(
      "PREFLIGHT_CANARY.json checkpoint sequence does not match child ordinal",
    );
};
