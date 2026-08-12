import { appendFile, mkdir, readFile } from "node:fs/promises";
import * as path from "node:path";

import { freezeDeep } from "../source/manifest-source.ts";
import type { SourceArtifact } from "../source/source-artifact.ts";
import { sha256Hex, stableSerialize } from "../support/ids.ts";
import {
  type PreflightRoute,
  routeForState,
} from "./playwright-preflight-support.ts";
import {
  assertPreflightArchivePath,
  ensurePreflightArchiveDirectory,
  ensurePreflightArchiveRoot,
} from "./preflight-archive-path.ts";
import {
  errorMessage,
  parsePreflightJournalRecord,
  PREFLIGHT_JOURNAL_ARTIFACT,
  PREFLIGHT_JOURNAL_VERSION,
  PreflightJournalError,
  preflightJournalIdentityFor,
  type PreflightJournalRecord,
  preflightJournalRecordSchema,
  type PreflightJournalStatus,
  stateIndexFor,
} from "./preflight-journal-contract.ts";
import { validatePreflightJournal } from "./preflight-journal-validation.ts";

type JournalEvent = "started" | "terminal";

// The runner serializes state transitions and owns one writer per journal.
// Concurrent appenders must coordinate outside this pure read-validate-append boundary.

const missingFile = (error: unknown): boolean =>
  error instanceof Error && "code" in error && error.code === "ENOENT";

export function parsePreflightJournalText(
  text: string,
): readonly PreflightJournalRecord[] {
  if (text.length === 0) return [];
  if (!text.endsWith("\n"))
    throw new PreflightJournalError(
      "Preflight journal has a truncated final record (missing newline)",
    );
  const lines = text.split("\n").slice(0, -1);
  if (lines.some((line) => line.trim() === ""))
    throw new PreflightJournalError(
      "Preflight journal contains a blank record",
    );
  return lines.map((line, index) => {
    try {
      return parsePreflightJournalRecord(JSON.parse(line));
    } catch (error: unknown) {
      throw new PreflightJournalError(
        `Cannot parse preflight journal record ${index + 1}: ${errorMessage(error)}`,
      );
    }
  });
}

export async function readPreflightJournal(
  filePath: string,
  archiveRoot?: string,
): Promise<readonly PreflightJournalRecord[]> {
  try {
    if (archiveRoot !== undefined)
      await assertPreflightArchivePath(archiveRoot, filePath);
    return parsePreflightJournalText(await readFile(filePath, "utf8"));
  } catch (error: unknown) {
    if (error instanceof PreflightJournalError) throw error;
    if (missingFile(error)) return [];
    throw new PreflightJournalError(
      `Cannot read preflight journal: ${errorMessage(error)}`,
    );
  }
}

const recordFor = (input: {
  readonly source: SourceArtifact;
  readonly assignmentDigest: string;
  readonly state: SourceArtifact["plan"]["states"][number];
  readonly route: PreflightRoute;
  readonly planIndex: number;
  readonly sequence: number;
  readonly attempt: number;
  readonly event: JournalEvent;
  readonly status: PreflightJournalStatus;
  readonly previousRecordDigest: string | null;
  readonly segmentDigest: string | null;
  readonly artifactPath: string | null;
  readonly artifactDigest: string | null;
}): PreflightJournalRecord => {
  const identity = preflightJournalIdentityFor(
    input.source,
    input.assignmentDigest,
    input.state,
  );
  if (
    input.route.role !== identity.role ||
    input.route.catalogRoute !== identity.catalogRoute ||
    input.route.resolvedRoute !== identity.resolvedRoute
  )
    throw new PreflightJournalError(
      `Journal route does not match state ${input.state.stateId}`,
    );
  const body = {
    ...identity,
    artifact: PREFLIGHT_JOURNAL_ARTIFACT,
    version: PREFLIGHT_JOURNAL_VERSION,
    sequence: input.sequence,
    attempt: input.attempt,
    event: input.event,
    status: input.status,
    planIndex: input.planIndex,
    segmentDigest: input.segmentDigest,
    artifactPath: input.artifactPath,
    artifactDigest: input.artifactDigest,
    previousRecordDigest: input.previousRecordDigest,
  } as const;
  return preflightJournalRecordSchema.parse({
    ...body,
    recordDigest: sha256Hex(body),
  });
};

const recordsForAppend = async (input: {
  readonly filePath: string;
  readonly source: SourceArtifact;
  readonly assignmentDigest: string;
  readonly archiveRoot?: string;
}): Promise<readonly PreflightJournalRecord[]> => {
  const records = await readPreflightJournal(input.filePath, input.archiveRoot);
  validatePreflightJournal({
    source: input.source,
    assignmentDigest: input.assignmentDigest,
    records,
  });
  return records;
};

const appendRecord = async (
  filePath: string,
  record: PreflightJournalRecord,
  archiveRoot?: string,
): Promise<PreflightJournalRecord> => {
  if (archiveRoot === undefined)
    await mkdir(path.dirname(filePath), { recursive: true });
  else {
    if (path.resolve(archiveRoot) === path.dirname(filePath))
      await ensurePreflightArchiveRoot(archiveRoot);
    else
      await ensurePreflightArchiveDirectory(
        archiveRoot,
        path.dirname(filePath),
      );
    await assertPreflightArchivePath(archiveRoot, filePath);
  }
  await appendFile(filePath, `${stableSerialize(record)}\n`, "utf8");
  return freezeDeep(record);
};

export async function appendPreflightJournalStarted(input: {
  readonly filePath: string;
  readonly source: SourceArtifact;
  readonly assignmentDigest: string;
  readonly archiveRoot?: string;
  readonly state: SourceArtifact["plan"]["states"][number];
  readonly route?: PreflightRoute;
}): Promise<PreflightJournalRecord> {
  const records = await recordsForAppend(input);
  const validation = validatePreflightJournal({
    source: input.source,
    assignmentDigest: input.assignmentDigest,
    records,
  });
  const prior = validation.stateAttempts.get(input.state.stateId);
  const attempt = prior === undefined ? 1 : prior.attempt + 1;
  const route = input.route ?? routeForState(input.source, input.state);
  const record = recordFor({
    source: input.source,
    assignmentDigest: input.assignmentDigest,
    state: input.state,
    route,
    planIndex: stateIndexFor(input.source, input.state.stateId),
    sequence: records.length + 1,
    attempt,
    event: "started",
    status: "STARTED",
    previousRecordDigest: records.at(-1)?.recordDigest ?? null,
    segmentDigest: null,
    artifactPath: null,
    artifactDigest: null,
  });
  validatePreflightJournal({
    source: input.source,
    assignmentDigest: input.assignmentDigest,
    records: [...records, record],
  });
  return appendRecord(input.filePath, record, input.archiveRoot);
}

export async function appendPreflightJournalTerminal(input: {
  readonly filePath: string;
  readonly source: SourceArtifact;
  readonly assignmentDigest: string;
  readonly archiveRoot?: string;
  readonly state: SourceArtifact["plan"]["states"][number];
  readonly route?: PreflightRoute;
  readonly status: Exclude<PreflightJournalStatus, "STARTED">;
  readonly segmentDigest?: string;
  readonly artifactPath?: string;
  readonly artifactDigest?: string;
}): Promise<PreflightJournalRecord> {
  const records = await recordsForAppend(input);
  const validation = validatePreflightJournal({
    source: input.source,
    assignmentDigest: input.assignmentDigest,
    records,
  });
  const prior = validation.stateAttempts.get(input.state.stateId);
  if (prior?.status !== "STARTED")
    throw new PreflightJournalError(
      `Cannot append terminal record for ${input.state.stateId} without a started attempt`,
    );
  const segmentDigest = input.segmentDigest ?? null;
  const artifactPath = input.artifactPath ?? null;
  const artifactDigest = input.artifactDigest ?? null;
  if (input.archiveRoot !== undefined && artifactPath !== null)
    await assertPreflightArchivePath(input.archiveRoot, artifactPath);
  const pass = input.status === "PASS";
  if (
    pass &&
    (segmentDigest === null || artifactPath === null || artifactDigest === null)
  )
    throw new PreflightJournalError(
      "A terminal PASS requires segmentDigest, artifactPath, and artifactDigest",
    );
  const route = input.route ?? routeForState(input.source, input.state);
  const record = recordFor({
    source: input.source,
    assignmentDigest: input.assignmentDigest,
    state: input.state,
    route,
    planIndex: stateIndexFor(input.source, input.state.stateId),
    sequence: records.length + 1,
    attempt: prior.attempt,
    event: "terminal",
    status: input.status,
    previousRecordDigest: records.at(-1)?.recordDigest ?? null,
    segmentDigest,
    artifactPath,
    artifactDigest,
  });
  validatePreflightJournal({
    source: input.source,
    assignmentDigest: input.assignmentDigest,
    records: [...records, record],
  });
  return appendRecord(input.filePath, record, input.archiveRoot);
}
