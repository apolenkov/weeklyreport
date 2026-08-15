import { readFile } from "node:fs/promises";

import { freezeDeep, writeManifestFile } from "../../source/manifest-source.ts";
import type { SourceArtifact } from "../../source/source-artifact.ts";
import { sha256Hex, stableSerialize } from "../../support/ids.ts";
import {
  assertCompactPreflightRevealData,
  compactPreflightRevealData,
  type CompactPreflightSegment,
} from "../artifacts/preflight-artifact-reveal.ts";
import {
  type CanaryFailurePhase,
  PREFLIGHT_CANARY_VIEWPORT,
  type PreflightCanaryArtifact,
  preflightCanaryArtifactSchema,
  PreflightCanaryError,
  type PreflightCanarySelection,
  type PreflightCanarySelector,
} from "./preflight-canary-contract.ts";

const digestBody = (
  artifact: PreflightCanaryArtifact,
): Omit<PreflightCanaryArtifact, "canaryDigest"> => {
  const { canaryDigest: _canaryDigest, ...body } = artifact;
  return body;
};

const errorFor = (
  error: unknown,
): Readonly<{ name: string; message: string }> =>
  error instanceof Error
    ? {
        name: error.name || "Error",
        message: error.message || "Preflight canary failed",
      }
    : { name: "Error", message: String(error) };

const currentTimestamp = (): string => new Date().toISOString();

const compactSegmentFor = (
  segment: Parameters<typeof compactPreflightRevealData>[0][number],
): Readonly<{
  readonly segment: CompactPreflightSegment;
  readonly revealPaths: ReturnType<
    typeof compactPreflightRevealData
  >["revealPaths"];
  readonly revealSurfaces: ReturnType<
    typeof compactPreflightRevealData
  >["revealSurfaces"];
  readonly revealTransitions: ReturnType<
    typeof compactPreflightRevealData
  >["revealTransitions"];
}> => {
  const compact = compactPreflightRevealData([segment]);
  const compactSegment = compact.segments[0];
  if (compactSegment === undefined)
    throw new PreflightCanaryError("Cannot compact an empty preflight segment");
  return {
    segment: compactSegment,
    revealPaths: compact.revealPaths,
    revealSurfaces: compact.revealSurfaces,
    revealTransitions: compact.revealTransitions,
  };
};

const segmentDigestFor = (
  segment: Parameters<typeof compactPreflightRevealData>[0][number],
): string => sha256Hex(compactSegmentFor(segment));

const identityFor = (
  source: SourceArtifact,
  selector: PreflightCanarySelector,
  capturedAt: string,
) => ({
  artifact: "PREFLIGHT_CANARY" as const,
  version: 1 as const,
  campaignId: source.campaignId,
  sourceSha: source.sourceSha,
  sourceTree: source.sourceTree,
  treeDigest: source.treeDigest,
  sourceDigest: source.sourceDigest,
  planDigest: source.plan.digest,
  selector,
  viewport: PREFLIGHT_CANARY_VIEWPORT,
  capturedAt,
});

const assertArtifactDigest = (parsed: PreflightCanaryArtifact): void => {
  if (sha256Hex(digestBody(parsed)) !== parsed.canaryDigest)
    throw new PreflightCanaryError(
      "PREFLIGHT_CANARY.json digest does not match contents",
    );
};

const assertArtifactViewport = (parsed: PreflightCanaryArtifact): void => {
  if (
    stableSerialize(parsed.viewport) !==
    stableSerialize(PREFLIGHT_CANARY_VIEWPORT)
  )
    throw new PreflightCanaryError(
      "PREFLIGHT_CANARY.json is not pinned to Chromium 1440x900",
    );
};

const assertPassContents = (
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

export function parsePreflightCanaryArtifact(
  value: unknown,
): PreflightCanaryArtifact {
  const parsed = preflightCanaryArtifactSchema.parse(value);
  assertArtifactDigest(parsed);
  assertArtifactViewport(parsed);
  if (parsed.status === "PASS") assertPassContents(parsed);
  return freezeDeep(parsed);
}

export async function readPreflightCanaryArtifact(
  filePath: string,
): Promise<PreflightCanaryArtifact> {
  try {
    return parsePreflightCanaryArtifact(
      JSON.parse(await readFile(filePath, "utf8")),
    );
  } catch (error: unknown) {
    if (error instanceof PreflightCanaryError) throw error;
    throw new PreflightCanaryError(
      `Cannot read PREFLIGHT_CANARY.json: ${
        error instanceof Error ? error.message : "invalid JSON"
      }`,
    );
  }
}

export const writePreflightCanaryArtifact = (
  filePath: string,
  artifact: PreflightCanaryArtifact,
): Promise<void> =>
  writeManifestFile(
    filePath,
    `${stableSerialize(parsePreflightCanaryArtifact(artifact))}\n`,
  );

type MatrixPreflightSegment = Parameters<
  typeof compactPreflightRevealData
>[0][number];

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

const bodyWithCanaryDigest = <T extends object>(
  body: T,
): T & {
  readonly canaryDigest: string;
} => ({
  ...body,
  canaryDigest: sha256Hex(body),
});

export function createPreflightCanaryPass(input: {
  readonly source: SourceArtifact;
  readonly selection: PreflightCanarySelection;
  readonly segment: MatrixPreflightSegment;
  readonly capturedAt?: string;
}): PreflightCanaryArtifact {
  const compact = compactSegmentFor(input.segment);
  return parsePreflightCanaryArtifact(
    bodyWithCanaryDigest({
      ...identityFor(
        input.source,
        input.selection.selector,
        input.capturedAt ?? currentTimestamp(),
      ),
      status: "PASS" as const,
      route: routeForSelection(input.selection),
      segment: compact.segment,
      revealPaths: compact.revealPaths,
      revealSurfaces: compact.revealSurfaces,
      revealTransitions: compact.revealTransitions,
      segmentDigest: segmentDigestFor(input.segment),
    }),
  );
}

export function createPreflightCanaryFailure(input: {
  readonly source: SourceArtifact;
  readonly selection: PreflightCanarySelection;
  readonly phase?: CanaryFailurePhase;
  readonly error: unknown;
  readonly capturedAt?: string;
}): PreflightCanaryArtifact {
  return parsePreflightCanaryArtifact(
    bodyWithCanaryDigest({
      ...identityFor(
        input.source,
        input.selection.selector,
        input.capturedAt ?? currentTimestamp(),
      ),
      status: "FAIL" as const,
      route: routeForSelection(input.selection),
      phase: input.phase ?? "unknown",
      error: errorFor(input.error),
    }),
  );
}
