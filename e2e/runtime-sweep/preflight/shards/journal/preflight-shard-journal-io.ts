import { appendFile, readFile } from "node:fs/promises";
import * as path from "node:path";

import { stableSerialize } from "../../../support/ids.ts";
import {
  assertPreflightArchivePath,
  assertPreflightRegularFile,
  ensurePreflightArchiveDirectory,
} from "../../preflight-archive-path.ts";
import type { PreflightShardState } from "../preflight-shard-assignment.ts";
import type { PreflightShardJournalContext } from "./preflight-shard-journal-context.ts";
import {
  parsePreflightShardJournalRecord,
  PreflightShardJournalError,
  type PreflightShardJournalRecord,
  type PreflightShardJournalStatus,
} from "./preflight-shard-journal-contract.ts";
import {
  createPreflightShardJournalStarted,
  createPreflightShardJournalTerminal,
} from "./preflight-shard-journal-record.ts";
import { validatePreflightShardJournal } from "./preflight-shard-journal-validation.ts";
import { readPreflightShardStateReceipt } from "./preflight-shard-state-receipt.ts";

const missingFile = (error: unknown): boolean =>
  error instanceof Error && "code" in error && error.code === "ENOENT";

export const parsePreflightShardJournalText = (
  text: string,
): readonly PreflightShardJournalRecord[] => {
  if (text.length === 0) return [];
  if (!text.endsWith("\n"))
    throw new PreflightShardJournalError(
      "Preflight shard journal has a truncated final record",
    );
  const lines = text.split("\n").slice(0, -1);
  if (lines.some((line) => line.trim() === ""))
    throw new PreflightShardJournalError(
      "Preflight shard journal contains a blank record",
    );
  return lines.map((line, index) => {
    try {
      const record = parsePreflightShardJournalRecord(JSON.parse(line));
      if (stableSerialize(record) !== line)
        throw new PreflightShardJournalError(
          "Preflight shard journal record bytes are not canonical",
        );
      return record;
    } catch (error: unknown) {
      throw new PreflightShardJournalError(
        `Cannot parse shard journal record ${index + 1}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  });
};

export const preflightShardJournalPathFor = (
  context: PreflightShardJournalContext,
): string =>
  path.join(
    context.resourceProof.resources.archiveRoot,
    "shards",
    context.shard.logicalShardId,
    "attempts",
    context.resourceProof.shardAttemptId,
    "PREFLIGHT_SHARD.journal.jsonl",
  );

const assertJournalPath = (
  context: PreflightShardJournalContext,
  archiveRoot: string,
  filePath: string,
): void => {
  if (archiveRoot !== context.resourceProof.resources.archiveRoot)
    throw new PreflightShardJournalError(
      "Shard journal archive root does not match the resource proof",
    );
  if (filePath !== preflightShardJournalPathFor(context))
    throw new PreflightShardJournalError(
      "Shard journal path does not match the resource proof attempt",
    );
};

export const readPreflightShardJournal = async (input: {
  readonly context: PreflightShardJournalContext;
  readonly archiveRoot: string;
  readonly filePath: string;
}): Promise<readonly PreflightShardJournalRecord[]> => {
  assertJournalPath(input.context, input.archiveRoot, input.filePath);
  try {
    await assertPreflightArchivePath(input.archiveRoot, input.filePath);
    const records = parsePreflightShardJournalText(
      await readFile(input.filePath, "utf8"),
    );
    validatePreflightShardJournal({ context: input.context, records });
    return records;
  } catch (error: unknown) {
    if (missingFile(error)) return [];
    if (error instanceof PreflightShardJournalError) throw error;
    throw new PreflightShardJournalError(
      `Cannot read preflight shard journal: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

const appendRecord = async (input: {
  readonly context: PreflightShardJournalContext;
  readonly archiveRoot: string;
  readonly filePath: string;
  readonly records: readonly PreflightShardJournalRecord[];
  readonly record: PreflightShardJournalRecord;
}): Promise<PreflightShardJournalRecord> => {
  await ensurePreflightArchiveDirectory(
    input.archiveRoot,
    path.dirname(input.filePath),
  );
  await assertPreflightArchivePath(input.archiveRoot, input.filePath);
  await appendFile(
    input.filePath,
    `${stableSerialize(input.record)}\n`,
    "utf8",
  );
  await assertPreflightRegularFile(input.filePath);
  const persisted = await readPreflightShardJournal(input);
  if (
    persisted.length !== input.records.length + 1 ||
    persisted.at(-1)?.recordDigest !== input.record.recordDigest
  )
    throw new PreflightShardJournalError(
      "Shard journal append did not preserve the expected record chain",
    );
  return input.record;
};

const assignedState = (
  context: PreflightShardJournalContext,
  stateId: string,
): PreflightShardState => {
  const state = context.shard.states.find(
    ({ state: candidate }) => candidate.stateId === stateId,
  );
  if (state === undefined)
    throw new PreflightShardJournalError(
      `Shard journal references unassigned state ${stateId}`,
    );
  return state;
};

export const appendPreflightShardJournalStarted = async (input: {
  readonly context: PreflightShardJournalContext;
  readonly archiveRoot: string;
  readonly filePath: string;
  readonly state: PreflightShardState;
}): Promise<PreflightShardJournalRecord> => {
  const records = await readPreflightShardJournal(input);
  const validation = validatePreflightShardJournal({
    context: input.context,
    records,
  });
  const next = input.context.shard.states.find(
    ({ state }) =>
      validation.attemptsByState.get(state.stateId)?.status !== "PASS",
  );
  if (next === undefined)
    throw new PreflightShardJournalError("Every assigned shard state has PASS");
  if (stableSerialize(next) !== stableSerialize(input.state))
    throw new PreflightShardJournalError(
      `Shard journal must resume exact state ${next.state.stateId}`,
    );
  const prior = validation.attemptsByState.get(next.state.stateId);
  if (prior?.status === "STARTED")
    throw new PreflightShardJournalError(
      `Interrupted state ${next.state.stateId} must be terminalized before retry`,
    );
  const previousRecord = records.at(-1);
  const record = createPreflightShardJournalStarted(
    previousRecord === undefined
      ? {
          context: input.context,
          state: next,
          attempt: (prior?.attempt ?? 0) + 1,
        }
      : {
          context: input.context,
          state: next,
          attempt: (prior?.attempt ?? 0) + 1,
          previousRecord,
        },
  );
  validatePreflightShardJournal({
    context: input.context,
    records: [...records, record],
  });
  return appendRecord({ ...input, records, record });
};

type TerminalStatus = Exclude<PreflightShardJournalStatus, "STARTED">;

interface TerminalAppendInput {
  readonly context: PreflightShardJournalContext;
  readonly archiveRoot: string;
  readonly filePath: string;
  readonly status: TerminalStatus;
  readonly receiptPath?: string;
  readonly failureSummary?: string;
}

const revalidateTerminalReceipt = async (input: {
  readonly append: TerminalAppendInput;
  readonly state: PreflightShardState;
  readonly started: PreflightShardJournalRecord;
}) => {
  if (input.append.status !== "PASS") {
    if (input.append.receiptPath !== undefined)
      throw new PreflightShardJournalError(
        "FAIL and AMBIGUOUS cannot carry a state receipt",
      );
    return undefined;
  }
  if (input.append.receiptPath === undefined)
    throw new PreflightShardJournalError(
      "Shard PASS requires a revalidated state receipt",
    );
  return readPreflightShardStateReceipt({
    context: input.append.context,
    archiveRoot: input.append.archiveRoot,
    filePath: input.append.receiptPath,
    state: input.state,
    started: input.started,
  });
};

const terminalRecordFor = (input: {
  readonly append: TerminalAppendInput;
  readonly started: PreflightShardJournalRecord;
  readonly revalidated: Awaited<ReturnType<typeof revalidateTerminalReceipt>>;
}): PreflightShardJournalRecord => {
  if (input.revalidated === undefined)
    return createPreflightShardJournalTerminal({
      context: input.append.context,
      started: input.started,
      status: input.append.status,
      ...(input.append.failureSummary === undefined
        ? {}
        : { failureSummary: input.append.failureSummary }),
    });
  const receiptPath = input.append.receiptPath;
  if (receiptPath === undefined)
    throw new PreflightShardJournalError(
      "Revalidated shard receipt has no canonical path",
    );
  return createPreflightShardJournalTerminal({
    context: input.append.context,
    started: input.started,
    status: input.append.status,
    receipt: {
      path: receiptPath,
      receiptDigest: input.revalidated.receipt.receiptDigest,
      segmentDigest: input.revalidated.receipt.segmentDigest,
    },
  });
};

export const appendPreflightShardJournalTerminal = async (
  input: TerminalAppendInput,
): Promise<PreflightShardJournalRecord> => {
  const records = await readPreflightShardJournal(input);
  const started = records.at(-1);
  if (started?.event !== "started" || started.status !== "STARTED")
    throw new PreflightShardJournalError(
      "Shard terminal append requires the latest STARTED record",
    );
  const state = assignedState(input.context, started.state.stateId);
  const revalidated = await revalidateTerminalReceipt({
    append: input,
    state,
    started,
  });
  const record = terminalRecordFor({ append: input, started, revalidated });
  validatePreflightShardJournal({
    context: input.context,
    records: [...records, record],
  });
  return appendRecord({ ...input, records, record });
};

export const terminalizeInterruptedPreflightShardState = async (input: {
  readonly context: PreflightShardJournalContext;
  readonly archiveRoot: string;
  readonly filePath: string;
}): Promise<PreflightShardJournalRecord> =>
  appendPreflightShardJournalTerminal({
    ...input,
    status: "AMBIGUOUS",
    failureSummary: "Interrupted before terminal evidence was recorded",
  });
