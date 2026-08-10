import { readFile } from "node:fs/promises";

import { z } from "zod";

import type { MatrixPreflightSegment } from "../matrix/matrix-finalizer-contract.ts";
import {
  assertSpecializedDeclarations,
  SPECIALIZED_DECLARATION_COUNT,
} from "../matrix/specialized-declarations.ts";
import {
  actionSchema,
  matrixAxesSchema,
  matrixExecutionSchema,
  matrixInapplicableSchema,
  seedProfileSchema,
  sha256DigestSchema,
  sourceShaSchema,
  stableIdentifierSchema,
} from "../source/contracts.ts";
import { freezeDeep, writeManifestFile } from "../source/manifest-source.ts";
import {
  type SourceArtifact,
  specializedDeclarationSchema,
} from "../source/source-artifact.ts";
import { sha256Hex, stableSerialize } from "../support/ids.ts";

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
    specializedDeclarations: z
      .array(specializedDeclarationSchema)
      .length(SPECIALIZED_DECLARATION_COUNT)
      .readonly(),
    preflightDigest: sha256DigestSchema,
  })
  .strict();

export type PreflightArtifact = z.infer<typeof preflightArtifactSchema>;
export type PreflightSegment = z.infer<typeof preflightSegmentSchema>;
export type PreflightControl = z.infer<typeof preflightControlSchema>;

export class PreflightArtifactError extends Error {
  override readonly name = "PreflightArtifactError";
}

const digestBody = (
  artifact: PreflightArtifact,
): Omit<PreflightArtifact, "preflightDigest"> => {
  const { preflightDigest: _preflightDigest, ...body } = artifact;
  return body;
};

const controlsForSegment = (
  segment: PreflightSegment,
): readonly PreflightControl[] =>
  segment.controls.toSorted((left, right) =>
    left.controlKey.localeCompare(right.controlKey),
  );

const sortedSegments = (
  segments: readonly PreflightSegment[],
): readonly PreflightSegment[] =>
  segments
    .map((segment) => ({
      ...segment,
      controls: controlsForSegment(segment),
      ...(segment.specialized === undefined
        ? {}
        : {
            specialized: segment.specialized.toSorted((left, right) =>
              (left.declarationId ?? "").localeCompare(
                right.declarationId ?? "",
              ),
            ),
          }),
    }))
    .toSorted((left, right) =>
      left.state.stateId.localeCompare(right.state.stateId),
    );

const declarationIdsFor = (
  declarations: readonly Readonly<{ readonly declarationId: string }>[],
): readonly string[] => declarations.map(({ declarationId }) => declarationId);

const compareStrings = (left: string, right: string): number =>
  left.localeCompare(right);

export function createPreflightArtifact(input: {
  readonly source: SourceArtifact;
  readonly segments: readonly MatrixPreflightSegment[];
}): PreflightArtifact {
  const declarations = input.source.specializedDeclarations;
  assertSpecializedDeclarations(declarations);
  const segments = sortedSegments(input.segments);
  const expectedStates = input.source.plan.states
    .map(({ stateId }) => stateId)
    .toSorted(compareStrings);
  const actualStates = segments
    .map(({ state }) => state.stateId)
    .toSorted(compareStrings);
  if (
    expectedStates.length !== actualStates.length ||
    new Set(actualStates).size !== actualStates.length ||
    stableSerialize(expectedStates) !== stableSerialize(actualStates)
  ) {
    throw new PreflightArtifactError(
      "PREFLIGHT.json must contain every nominal source segment exactly once",
    );
  }
  const body = {
    artifact: "PREFLIGHT" as const,
    version: 1 as const,
    sourceSha: input.source.sourceSha,
    sourceDigest: input.source.sourceDigest,
    planDigest: input.source.plan.digest,
    segments,
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
  const expected = declarationIdsFor(source.specializedDeclarations).toSorted(
    compareStrings,
  );
  const actual = preflight.specializedDeclarations
    .map(({ declarationId }) => declarationId)
    .toSorted(compareStrings);
  if (stableSerialize(expected) !== stableSerialize(actual))
    throw new PreflightArtifactError(
      "PREFLIGHT.json specialized declaration coverage is incomplete",
    );
  const segmentIds = preflight.segments.flatMap((segment) =>
    (segment.specialized ?? []).map(({ declarationId }) => declarationId ?? ""),
  );
  if (
    segmentIds.length !== expected.length ||
    new Set(segmentIds).size !== segmentIds.length ||
    stableSerialize(segmentIds.toSorted(compareStrings)) !==
      stableSerialize(expected)
  ) {
    throw new PreflightArtifactError(
      "PREFLIGHT.json specialized segment coverage is incomplete",
    );
  }
  const expectedStates = source.plan.states
    .map(({ stateId }) => stateId)
    .toSorted(compareStrings);
  const actualStates = preflight.segments
    .map(({ state }) => state.stateId)
    .toSorted(compareStrings);
  if (stableSerialize(expectedStates) !== stableSerialize(actualStates))
    throw new PreflightArtifactError(
      "PREFLIGHT.json nominal segment coverage does not match SOURCE.json",
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

export async function writePreflightArtifact(
  filePath: string,
  artifact: PreflightArtifact,
): Promise<void> {
  await writeManifestFile(
    filePath,
    `${stableSerialize(parsePreflightArtifact(artifact))}\n`,
  );
}
