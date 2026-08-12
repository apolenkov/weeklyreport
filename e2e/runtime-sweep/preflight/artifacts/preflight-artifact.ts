import { readFile } from "node:fs/promises";

import { z } from "zod";

import type { MatrixPreflightSegment } from "../../matrix/finalization/matrix-finalizer-contract.ts";
import { revealTransitionSchema } from "../../matrix/reveal-transition.ts";
import {
  assertSpecializedDeclarations,
  SPECIALIZED_DECLARATION_COUNT,
} from "../../matrix/specialized/specialized-declarations.ts";
import {
  actionSchema,
  matrixAxesSchema,
  matrixExecutionSchema,
  matrixInapplicableSchema,
  resolverOutcomeKindSchema,
  seedProfileSchema,
  sha256DigestSchema,
  sourceShaSchema,
  stableIdentifierSchema,
} from "../../source/contracts.ts";
import { freezeDeep, writeManifestFile } from "../../source/manifest-source.ts";
import {
  type SourceArtifact,
  specializedDeclarationSchema,
} from "../../source/source-artifact.ts";
import { sha256Hex, stableSerialize } from "../../support/ids.ts";
import { assertPreflightArchivePath } from "../preflight-archive-path.ts";
import {
  compareRevealControlIdentity,
  revealPathSchema,
  revealSurfaceSchema,
} from "../reveal-path.ts";
import {
  assertCompactPreflightRevealData,
  compactPreflightRevealData,
} from "./preflight-artifact-reveal.ts";
import { assertSpecializedPreflightCoverage } from "./preflight-artifact-specialized.ts";

const inventorySchema = z
  .object({
    ariaRole: z.string().min(1),
    accessibleName: z.string(),
    enabled: z.boolean(),
    order: z.number().int().nonnegative(),
    domOrderKey: z.string().min(1),
    href: z.string().nullable(),
  })
  .strict();

export const preflightControlSchema = z
  .object({
    controlKey: z.string().min(1),
    inventory: inventorySchema,
    action: actionSchema.optional(),
    execution: matrixExecutionSchema.optional(),
    inapplicable: matrixInapplicableSchema.optional(),
    revealPathDigest: sha256DigestSchema,
    expectedSurfaceDigest: sha256DigestSchema,
    expectedActionTransitionDigest: sha256DigestSchema.nullable(),
    expectedActionSurfaceDigest: sha256DigestSchema.nullable(),
  })
  .strict()
  .refine(
    ({ action, execution, inapplicable }) =>
      Number(action !== undefined) +
        Number(execution !== undefined) +
        Number(inapplicable !== undefined) ===
      1,
    "A preflight control must declare exactly one action, execution, or inapplicable reason",
  );

export const preflightEntrySchema = z
  .object({
    declarationId: stableIdentifierSchema.optional(),
    resolverOutcome: resolverOutcomeKindSchema.optional(),
    resolverRecoveryOutcome: resolverOutcomeKindSchema.nullable().optional(),
    state: z
      .object({
        stateId: stableIdentifierSchema,
        pairwiseDigest: sha256DigestSchema,
        profile: seedProfileSchema,
        axes: matrixAxesSchema,
      })
      .strict(),
    execution: matrixExecutionSchema.optional(),
    inapplicable: matrixInapplicableSchema.optional(),
  })
  .strict()
  .refine(
    ({ execution, inapplicable }) =>
      Number(execution !== undefined) + Number(inapplicable !== undefined) ===
      1,
    "A specialized preflight entry must declare exactly one execution or inapplicable reason",
  );

export const preflightSegmentSchema = z
  .object({
    state: preflightEntrySchema.shape.state,
    controls: z.array(preflightControlSchema).readonly(),
    specialized: z.array(preflightEntrySchema).readonly().optional(),
  })
  .strict();

export const preflightArtifactSchema = z
  .object({
    artifact: z.literal("PREFLIGHT"),
    version: z.literal(1),
    sourceSha: sourceShaSchema,
    sourceDigest: sha256DigestSchema,
    planDigest: sha256DigestSchema,
    segments: z.array(preflightSegmentSchema).readonly(),
    revealPaths: z.array(revealPathSchema).readonly(),
    revealSurfaces: z.array(revealSurfaceSchema).readonly(),
    revealTransitions: z.array(revealTransitionSchema).readonly(),
    specializedDeclarations: z
      .array(specializedDeclarationSchema)
      .length(SPECIALIZED_DECLARATION_COUNT)
      .readonly(),
    preflightDigest: sha256DigestSchema,
  })
  .strict();

export type PreflightArtifact = z.infer<typeof preflightArtifactSchema>;
export type PreflightSegment = z.infer<typeof preflightSegmentSchema>;
export class PreflightArtifactError extends Error {
  override readonly name = "PreflightArtifactError";
}
const digestBody = ({
  preflightDigest: _preflightDigest,
  ...body
}: PreflightArtifact): Omit<PreflightArtifact, "preflightDigest"> => body;
const controlsForSegment = (
  segment: PreflightSegment,
): PreflightSegment["controls"] =>
  segment.controls.toSorted((left, right) =>
    compareRevealControlIdentity(left, right),
  );

const sortedSegments = (
  segments: readonly PreflightSegment[],
): readonly PreflightSegment[] =>
  segments.map((segment) => ({
    ...segment,
    controls: controlsForSegment(segment),
    ...(segment.specialized === undefined
      ? {}
      : {
          specialized: segment.specialized.toSorted((left, right) =>
            (left.declarationId ?? "").localeCompare(right.declarationId ?? ""),
          ),
        }),
  }));

const segmentsInSourceOrder = (input: {
  readonly source: SourceArtifact;
  readonly segments: readonly MatrixPreflightSegment[];
}): readonly MatrixPreflightSegment[] => {
  const byStateId = new Map<string, MatrixPreflightSegment>();
  const duplicates = new Set<string>();
  input.segments.forEach((segment) => {
    const stateId = segment.state.stateId;
    if (byStateId.has(stateId)) duplicates.add(stateId);
    byStateId.set(stateId, segment);
  });
  const expected = input.source.plan.states.map(({ stateId }) => stateId);
  const expectedSet = new Set(expected);
  const extra = [...byStateId.keys()].filter(
    (stateId) => !expectedSet.has(stateId),
  );
  const missing = expected.filter((stateId) => !byStateId.has(stateId));
  if (duplicates.size > 0 || extra.length > 0 || missing.length > 0)
    throw new PreflightArtifactError(
      [
        ...[...duplicates].map((stateId) => `duplicate state ${stateId}`),
        ...extra.map((stateId) => `foreign state ${stateId}`),
        ...missing.map((stateId) => `missing state ${stateId}`),
      ].join("; "),
    );
  return expected.map((stateId) => {
    const segment = byStateId.get(stateId);
    if (segment === undefined)
      throw new PreflightArtifactError(`Missing source state ${stateId}`);
    return segment;
  });
};

export function createPreflightArtifact(input: {
  readonly source: SourceArtifact;
  readonly segments: readonly MatrixPreflightSegment[];
}): PreflightArtifact {
  const declarations = input.source.specializedDeclarations;
  assertSpecializedDeclarations(declarations);
  const compact = compactPreflightRevealData(segmentsInSourceOrder(input));
  const segments = sortedSegments(compact.segments);
  const body = {
    artifact: "PREFLIGHT" as const,
    version: 1 as const,
    sourceSha: input.source.sourceSha,
    sourceDigest: input.source.sourceDigest,
    planDigest: input.source.plan.digest,
    segments,
    revealPaths: compact.revealPaths,
    revealSurfaces: compact.revealSurfaces,
    revealTransitions: compact.revealTransitions,
    specializedDeclarations: declarations,
  };
  return parsePreflightArtifact({
    ...body,
    preflightDigest: sha256Hex(body),
  });
}

export function parsePreflightArtifact(value: unknown): PreflightArtifact {
  const parsed = preflightArtifactSchema.parse(value);
  assertSpecializedDeclarations(parsed.specializedDeclarations);
  try {
    assertCompactPreflightRevealData(parsed);
  } catch (error: unknown) {
    throw new PreflightArtifactError(
      `Invalid reveal preparation: ${
        error instanceof Error ? error.message : "invalid reveal metadata"
      }`,
    );
  }
  if (sha256Hex(digestBody(parsed)) !== parsed.preflightDigest)
    throw new PreflightArtifactError(
      "PREFLIGHT.json digest does not match contents",
    );
  if (
    new Set(
      parsed.specializedDeclarations.map(({ declarationId }) => declarationId),
    ).size !== parsed.specializedDeclarations.length
  ) {
    throw new PreflightArtifactError(
      "PREFLIGHT.json contains duplicate specialized declarations",
    );
  }
  return freezeDeep(parsed);
}

export function assertPreflightMatchesSource(
  source: SourceArtifact,
  preflight: PreflightArtifact,
): void {
  if (
    preflight.sourceSha !== source.sourceSha ||
    preflight.sourceDigest !== source.sourceDigest ||
    preflight.planDigest !== source.plan.digest
  ) {
    throw new PreflightArtifactError(
      "PREFLIGHT.json does not match SOURCE.json",
    );
  }
  assertSpecializedPreflightCoverage(source, preflight, (message) => {
    throw new PreflightArtifactError(message);
  });
  const expectedStates = source.plan.states.map(({ stateId }) => stateId);
  const actualStates = preflight.segments.map(({ state }) => state.stateId);
  if (stableSerialize(expectedStates) !== stableSerialize(actualStates))
    throw new PreflightArtifactError(
      "PREFLIGHT.json nominal segment order or coverage does not match SOURCE.json",
    );
}

export async function readPreflightArtifact(
  filePath: string,
): Promise<PreflightArtifact> {
  try {
    return parsePreflightArtifact(JSON.parse(await readFile(filePath, "utf8")));
  } catch (error: unknown) {
    if (error instanceof PreflightArtifactError) throw error;
    throw new PreflightArtifactError(
      `Cannot read PREFLIGHT.json: ${error instanceof Error ? error.message : "invalid JSON"}`,
    );
  }
}

export const writePreflightArtifact = async (
  filePath: string,
  artifact: PreflightArtifact,
  archiveRoot?: string,
): Promise<void> => {
  if (archiveRoot !== undefined)
    await assertPreflightArchivePath(archiveRoot, filePath);
  await writeManifestFile(
    filePath,
    `${stableSerialize(parsePreflightArtifact(artifact))}\n`,
  );
};
