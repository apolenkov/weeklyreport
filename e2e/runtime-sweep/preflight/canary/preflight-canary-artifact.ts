import { link, readFile, unlink } from "node:fs/promises";
import * as path from "node:path";

import {
  freezeDeep,
  ManifestWriteError,
  writeManifestFile,
} from "../../source/manifest-source.ts";
import type { SourceArtifact } from "../../source/source-artifact.ts";
import { sha256Hex, stableSerialize } from "../../support/ids.ts";
import {
  compactPreflightRevealData,
  type CompactPreflightSegment,
} from "../artifacts/preflight-artifact-reveal.ts";
import {
  type PublicationCommitGuard,
  publishDeadlineBound,
} from "../launch/preflight-deadline-publication.ts";
import type { RevealExecutionGrant } from "../reveal/continuation/contracts/preflight-reveal-continuation-schemas.ts";
import {
  type CanaryFailurePhase,
  PREFLIGHT_CANARY_VIEWPORT,
  type PreflightCanaryArtifact,
  preflightCanaryArtifactSchema,
  type PreflightCanaryBudgetFailure,
  PreflightCanaryError,
  type PreflightCanarySelection,
  type PreflightCanarySelector,
} from "./preflight-canary-contract.ts";
import {
  assertPreflightCanaryBudgetFailureContents,
  assertPreflightCanaryPassContents,
} from "./preflight-canary-validation.ts";

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
const canaryTemporaryCounter = { value: 0 };

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

export function parsePreflightCanaryArtifact(
  value: unknown,
): PreflightCanaryArtifact {
  const parsed = preflightCanaryArtifactSchema.parse(value);
  assertArtifactDigest(parsed);
  assertArtifactViewport(parsed);
  if (parsed.status === "PASS") assertPreflightCanaryPassContents(parsed);
  if (parsed.status === "FAIL_NOT_PROVEN")
    assertPreflightCanaryBudgetFailureContents(parsed);
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

export const writePreflightCanaryArtifact = async (
  filePath: string,
  artifact: PreflightCanaryArtifact,
  commitGuard?: PublicationCommitGuard,
): Promise<void> => {
  canaryTemporaryCounter.value += 1;
  const temporaryPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${String(process.pid)}.${String(canaryTemporaryCounter.value)}.tmp`,
  );
  await writeManifestFile(
    temporaryPath,
    `${stableSerialize(parsePreflightCanaryArtifact(artifact))}\n`,
  );
  try {
    await publishDeadlineBound({
      ...(commitGuard === undefined ? {} : { guard: commitGuard }),
      publish: async (markOwned) => {
        await link(temporaryPath, filePath);
        markOwned();
        await unlink(temporaryPath);
      },
      rollback: () => unlink(filePath),
    });
  } catch (error: unknown) {
    await unlink(temporaryPath).catch(() => undefined);
    if (error instanceof Error && "code" in error && error.code === "EEXIST")
      throw new ManifestWriteError(
        `Cannot create immutable campaign manifest at ${filePath}: ${error.message}`,
      );
    throw error;
  }
};

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

export function createPreflightCanaryBudgetFailure(input: {
  readonly source: SourceArtifact;
  readonly selection: PreflightCanarySelection;
  readonly attemptId: string;
  readonly nextChildOrdinal: number;
  readonly lastCheckpointDigest: string | null;
  readonly lastCheckpointSequence: number | null;
  readonly lastSampleSequence: number | null;
  readonly grantDigest: string;
  readonly frontier: PreflightCanaryBudgetFailure["frontier"];
  readonly reducerStateDigest: string;
  readonly chain: RevealExecutionGrant["chain"];
  readonly functionalRemainingMs: number;
  readonly requiredChildWindowMs: number;
  readonly error: unknown;
  readonly capturedAt?: string;
}): PreflightCanaryBudgetFailure {
  const artifact = parsePreflightCanaryArtifact(
    bodyWithCanaryDigest({
      ...identityFor(
        input.source,
        input.selection.selector,
        input.capturedAt ?? currentTimestamp(),
      ),
      status: "FAIL_NOT_PROVEN" as const,
      route: routeForSelection(input.selection),
      phase: "continuation" as const,
      error: errorFor(input.error),
      attemptId: input.attemptId,
      nextChildOrdinal: input.nextChildOrdinal,
      lastCheckpointDigest: input.lastCheckpointDigest,
      lastCheckpointSequence: input.lastCheckpointSequence,
      lastSampleSequence: input.lastSampleSequence,
      grantDigest: input.grantDigest,
      frontierDigest: sha256Hex(input.frontier),
      frontier: input.frontier,
      reducerStateDigest: input.reducerStateDigest,
      chain: input.chain,
      functionalRemainingMs: input.functionalRemainingMs,
      requiredChildWindowMs: input.requiredChildWindowMs,
      reason: "INSUFFICIENT_REMAINING_BUDGET" as const,
    }),
  );
  if (artifact.status !== "FAIL_NOT_PROVEN")
    throw new PreflightCanaryError(
      "Budget failure factory produced a non-diagnostic canary",
    );
  return artifact;
}
