import { readFile } from "node:fs/promises";

import { z } from "zod";

import type { MatrixPreflightSegment } from "../matrix/matrix-finalizer-contract.ts";
import { revealTransitionSchema } from "../matrix/reveal-transition.ts";
import { writeManifestFile } from "../source/manifest-source.ts";
import type { SourceArtifact } from "../source/source-artifact.ts";
import { sha256Hex, stableSerialize } from "../support/ids.ts";
import type { PreflightRoute } from "./playwright-preflight-support.ts";
import {
  assertPreflightArchivePath,
  assertPreflightRegularFile,
} from "./preflight-archive-path.ts";
import {
  type PreflightSegment,
  preflightSegmentSchema,
} from "./preflight-artifact.ts";
import {
  compactPreflightRevealData,
  inflatePreflightRevealData,
} from "./preflight-artifact-reveal.ts";
import {
  errorMessage,
  journalIdentitySchema,
  journalStateIdentitySchema,
  PreflightJournalError,
  preflightJournalIdentityFor,
  type PreflightJournalState,
  preflightJournalStateDigest,
  routeIdentityFor,
} from "./preflight-journal-contract.ts";
import { revealPathSchema, revealSurfaceSchema } from "./reveal-path.ts";

export type PreflightSegmentArtifact = Readonly<{
  readonly artifact: "PREFLIGHT_SEGMENT";
  readonly version: 1;
  readonly sourceSha: string;
  readonly sourceTree: string;
  readonly treeDigest: string;
  readonly sourceDigest: string;
  readonly planDigest: string;
  readonly assignmentDigest: string;
  readonly state: PreflightJournalState;
  readonly stateDigest: string;
  readonly role: string;
  readonly catalogRoute: string;
  readonly resolvedRoute: string;
  readonly segment: PreflightSegment;
  readonly revealPaths: ReturnType<
    typeof compactPreflightRevealData
  >["revealPaths"];
  readonly revealSurfaces: ReturnType<
    typeof compactPreflightRevealData
  >["revealSurfaces"];
  readonly revealTransitions: ReturnType<
    typeof compactPreflightRevealData
  >["revealTransitions"];
  readonly segmentDigest: string;
  readonly artifactDigest: string;
}>;

const segmentArtifactBodySchema = z
  .object({
    artifact: z.literal("PREFLIGHT_SEGMENT"),
    version: z.literal(1),
    ...journalIdentitySchema.shape,
    ...journalStateIdentitySchema.shape,
    segment: preflightSegmentSchema,
    revealPaths: z.array(revealPathSchema).readonly(),
    revealSurfaces: z.array(revealSurfaceSchema).readonly(),
    revealTransitions: z.array(revealTransitionSchema).readonly(),
    segmentDigest: z.string().regex(/^[0-9a-f]{64}$/u),
  })
  .strict();
const segmentArtifactSchema = segmentArtifactBodySchema
  .extend({ artifactDigest: z.string().regex(/^[0-9a-f]{64}$/u) })
  .strict();

const segmentArtifactBody = (
  artifact: PreflightSegmentArtifact,
): Omit<PreflightSegmentArtifact, "artifactDigest"> => {
  const { artifactDigest: _artifactDigest, ...body } = artifact;
  return body;
};

const segmentPayloadFor = (input: {
  readonly source: SourceArtifact;
  readonly assignmentDigest: string;
  readonly state: SourceArtifact["plan"]["states"][number];
  readonly route: PreflightRoute;
  readonly segment: MatrixPreflightSegment;
}): Omit<PreflightSegmentArtifact, "artifactDigest"> => {
  const compact = compactPreflightRevealData([input.segment]);
  const compactSegment = compact.segments[0];
  if (compactSegment === undefined)
    throw new PreflightJournalError(
      "Cannot persist an empty preflight segment",
    );
  const identity = preflightJournalIdentityFor(
    input.source,
    input.assignmentDigest,
    input.state,
  );
  const route = routeIdentityFor(input.source, input.state);
  if (
    input.route.role !== route.role ||
    input.route.catalogRoute !== route.catalogRoute ||
    input.route.resolvedRoute !== route.resolvedRoute
  )
    throw new PreflightJournalError(
      `Preflight segment route does not match state ${input.state.stateId}`,
    );
  return {
    ...identity,
    artifact: "PREFLIGHT_SEGMENT",
    version: 1,
    segment: compactSegment,
    revealPaths: compact.revealPaths,
    revealSurfaces: compact.revealSurfaces,
    revealTransitions: compact.revealTransitions,
    segmentDigest: sha256Hex(compactSegment),
  };
};

export function createPreflightSegmentArtifact(input: {
  readonly source: SourceArtifact;
  readonly assignmentDigest: string;
  readonly state: SourceArtifact["plan"]["states"][number];
  readonly route: PreflightRoute;
  readonly segment: MatrixPreflightSegment;
}): PreflightSegmentArtifact {
  const body = segmentPayloadFor(input);
  return parsePreflightSegmentArtifact({
    ...body,
    artifactDigest: sha256Hex(body),
  });
}

export function parsePreflightSegmentArtifact(
  value: unknown,
): PreflightSegmentArtifact {
  const parsed = segmentArtifactSchema.parse(value) as PreflightSegmentArtifact;
  if (sha256Hex(segmentArtifactBody(parsed)) !== parsed.artifactDigest)
    throw new PreflightJournalError(
      "Preflight segment artifact digest does not match contents",
    );
  if (sha256Hex(parsed.segment) !== parsed.segmentDigest)
    throw new PreflightJournalError(
      "Preflight segment digest does not match contents",
    );
  try {
    inflatePreflightRevealData({
      segments: [parsed.segment],
      revealPaths: parsed.revealPaths,
      revealSurfaces: parsed.revealSurfaces,
      revealTransitions: parsed.revealTransitions,
    });
  } catch (error: unknown) {
    throw new PreflightJournalError(
      `Preflight segment reveal data is invalid: ${errorMessage(error)}`,
    );
  }
  if (preflightJournalStateDigest(parsed) !== parsed.stateDigest)
    throw new PreflightJournalError(
      "Preflight segment state digest does not match contents",
    );
  return parsed;
}

export async function writePreflightSegmentArtifact(input: {
  readonly filePath: string;
  readonly artifact: PreflightSegmentArtifact;
  readonly archiveRoot?: string;
}): Promise<void> {
  if (input.archiveRoot !== undefined)
    await assertPreflightArchivePath(input.archiveRoot, input.filePath);
  await writeManifestFile(
    input.filePath,
    `${stableSerialize(parsePreflightSegmentArtifact(input.artifact))}\n`,
  );
  await assertPreflightRegularFile(input.filePath);
}

export async function readPreflightSegmentArtifact(
  filePath: string,
): Promise<PreflightSegmentArtifact> {
  try {
    await assertPreflightRegularFile(filePath);
    return parsePreflightSegmentArtifact(
      JSON.parse(await readFile(filePath, "utf8")),
    );
  } catch (error: unknown) {
    if (error instanceof PreflightJournalError) throw error;
    throw new PreflightJournalError(
      `Cannot read preflight segment artifact: ${errorMessage(error)}`,
    );
  }
}

export function preflightSegmentForArtifact(
  artifact: PreflightSegmentArtifact,
): MatrixPreflightSegment {
  const segment = inflatePreflightRevealData({
    segments: [artifact.segment],
    revealPaths: artifact.revealPaths,
    revealSurfaces: artifact.revealSurfaces,
    revealTransitions: artifact.revealTransitions,
  })[0];
  if (segment === undefined)
    throw new PreflightJournalError("Preflight segment artifact is empty");
  return segment;
}
