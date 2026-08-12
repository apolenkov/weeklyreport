import { readFile } from "node:fs/promises";

import { z } from "zod";

import {
  sha256DigestSchema,
  sourceShaSchema,
  sourceTreeSchema,
} from "../../source/contracts.ts";
import { freezeDeep, writeManifestFile } from "../../source/manifest-source.ts";
import type { SourceArtifact } from "../../source/source-artifact.ts";
import { sha256Hex, stableSerialize } from "../../support/ids.ts";
import {
  errorMessage,
  journalStateSchema,
  preflightJournalStateDigest,
  routeIdentityFor,
} from "../journal/preflight-journal-contract.ts";
import {
  assertPreflightArchivePath,
  assertPreflightRegularFile,
  ensurePreflightArchiveRoot,
  PreflightArchivePathError,
} from "../preflight-archive-path.ts";

export const PREFLIGHT_ASSIGNMENT_ARTIFACT = "PREFLIGHT_ASSIGNMENT" as const;
export const PREFLIGHT_ASSIGNMENT_VERSION = 1 as const;

const assignmentStateSchema = z
  .object({
    planIndex: z.number().int().nonnegative(),
    state: journalStateSchema,
    stateDigest: sha256DigestSchema,
    role: z.string().min(1),
    catalogRoute: z.string().min(1),
    resolvedRoute: z.string().min(1),
  })
  .strict();

const assignmentBodySchema = z
  .object({
    artifact: z.literal(PREFLIGHT_ASSIGNMENT_ARTIFACT),
    version: z.literal(PREFLIGHT_ASSIGNMENT_VERSION),
    mode: z.literal("sequential"),
    sourceSha: sourceShaSchema,
    sourceTree: sourceTreeSchema,
    treeDigest: sha256DigestSchema,
    sourceDigest: sha256DigestSchema,
    planDigest: sha256DigestSchema,
    states: z.array(assignmentStateSchema).readonly(),
  })
  .strict();

const assignmentSchema = assignmentBodySchema
  .extend({ assignmentDigest: sha256DigestSchema })
  .strict();

export type PreflightAssignmentState = z.infer<typeof assignmentStateSchema>;
export type PreflightAssignment = z.infer<typeof assignmentSchema>;

export class PreflightAssignmentError extends Error {
  override readonly name = "PreflightAssignmentError";
}

const bodyFor = (
  assignment: PreflightAssignment,
): Omit<PreflightAssignment, "assignmentDigest"> => {
  const { assignmentDigest: _assignmentDigest, ...body } = assignment;
  return body;
};

const stateFor = (
  source: SourceArtifact,
  state: SourceArtifact["plan"]["states"][number],
  planIndex: number,
): PreflightAssignmentState => {
  const route = routeIdentityFor(source, state);
  const journalState = journalStateSchema.parse({
    stateId: state.stateId,
    pairwiseDigest: state.pairwiseDigest,
    profile: state.profile,
    axes: state.axes,
  });
  return {
    planIndex,
    state: journalState,
    stateDigest: preflightJournalStateDigest({
      state: journalState,
      ...route,
    }),
    role: route.role,
    catalogRoute: route.catalogRoute,
    resolvedRoute: route.resolvedRoute,
  };
};

const assignmentIdentityFor = (source: SourceArtifact) => ({
  artifact: PREFLIGHT_ASSIGNMENT_ARTIFACT,
  version: PREFLIGHT_ASSIGNMENT_VERSION,
  mode: "sequential" as const,
  sourceSha: source.sourceSha,
  sourceTree: source.sourceTree,
  treeDigest: source.treeDigest,
  sourceDigest: source.sourceDigest,
  planDigest: source.plan.digest,
});

const assertStateOrdering = (assignment: PreflightAssignment): void => {
  const stateIds = assignment.states.map(({ state }) => state.stateId);
  const duplicate = stateIds.find(
    (stateId, index) => stateIds.indexOf(stateId) !== index,
  );
  if (duplicate !== undefined)
    throw new PreflightAssignmentError(
      `PREFLIGHT_ASSIGNMENT contains duplicate state ${duplicate}`,
    );
  assignment.states.forEach((state, index) => {
    if (state.planIndex !== index)
      throw new PreflightAssignmentError(
        `PREFLIGHT_ASSIGNMENT state ${state.state.stateId} is reordered`,
      );
  });
};

export function parsePreflightAssignment(value: unknown): PreflightAssignment {
  const assignment = assignmentSchema.parse(value);
  if (sha256Hex(bodyFor(assignment)) !== assignment.assignmentDigest)
    throw new PreflightAssignmentError(
      "PREFLIGHT_ASSIGNMENT digest does not match its contents",
    );
  assertStateOrdering(assignment);
  return freezeDeep(assignment);
}

export function createPreflightAssignment(
  source: SourceArtifact,
): PreflightAssignment {
  const body = {
    ...assignmentIdentityFor(source),
    states: source.plan.states.map((state, planIndex) =>
      stateFor(source, state, planIndex),
    ),
  } as const;
  return parsePreflightAssignment({
    ...body,
    assignmentDigest: sha256Hex(body),
  });
}

export const serializePreflightAssignment = (
  assignment: PreflightAssignment,
): string => `${stableSerialize(parsePreflightAssignment(assignment))}\n`;

export function assertPreflightAssignmentMatchesSource(
  source: SourceArtifact,
  assignment: PreflightAssignment,
): void {
  const expected = createPreflightAssignment(source);
  if (stableSerialize(expected) !== stableSerialize(assignment))
    throw new PreflightAssignmentError(
      "PREFLIGHT_ASSIGNMENT does not match the current SOURCE.json plan",
    );
}

export async function readPreflightAssignment(
  filePath: string,
): Promise<PreflightAssignment> {
  try {
    await assertPreflightRegularFile(filePath);
    return parsePreflightAssignment(
      JSON.parse(await readFile(filePath, "utf8")) as unknown,
    );
  } catch (error: unknown) {
    if (error instanceof PreflightAssignmentError) throw error;
    if (error instanceof PreflightArchivePathError) throw error;
    throw new PreflightAssignmentError(
      `Cannot read PREFLIGHT_ASSIGNMENT.json: ${errorMessage(error)}`,
    );
  }
}

export async function writePreflightAssignment(input: {
  readonly archiveRoot: string;
  readonly filePath: string;
  readonly assignment: PreflightAssignment;
}): Promise<void> {
  const archiveRoot = await ensurePreflightArchiveRoot(input.archiveRoot);
  await assertPreflightArchivePath(archiveRoot, input.filePath);
  await writeManifestFile(
    input.filePath,
    serializePreflightAssignment(input.assignment),
  );
  await assertPreflightRegularFile(input.filePath);
}

export async function readOrCreatePreflightAssignment(input: {
  readonly archiveRoot: string;
  readonly filePath: string;
  readonly source: SourceArtifact;
}): Promise<PreflightAssignment> {
  const archiveRoot = await ensurePreflightArchiveRoot(input.archiveRoot);
  try {
    await assertPreflightArchivePath(archiveRoot, input.filePath);
    const assignment = await readPreflightAssignment(input.filePath);
    assertPreflightAssignmentMatchesSource(input.source, assignment);
    return assignment;
  } catch (error: unknown) {
    if (!(error instanceof PreflightArchivePathError)) throw error;
    const assignment = createPreflightAssignment(input.source);
    await writePreflightAssignment({
      archiveRoot,
      filePath: input.filePath,
      assignment,
    });
    return assignment;
  }
}

export const preflightAssignmentStateFor = (
  assignment: PreflightAssignment,
  stateId: string,
): PreflightAssignmentState => {
  const state = assignment.states.find(
    ({ state }) => state.stateId === stateId,
  );
  if (state === undefined)
    throw new PreflightAssignmentError(
      `PREFLIGHT_ASSIGNMENT has no state ${stateId}`,
    );
  return state;
};
