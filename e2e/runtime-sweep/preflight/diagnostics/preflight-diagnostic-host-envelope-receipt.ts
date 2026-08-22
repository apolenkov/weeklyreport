import { createHash } from "node:crypto";
import { open, readFile, writeFile } from "node:fs/promises";
import * as path from "node:path";

import {
  assertPreflightArchivePath,
  assertPreflightRegularFile,
  ensurePreflightArchiveDirectory,
} from "../preflight-archive-path.ts";
import {
  type DiagnosticHostEnvelopeSnapshot,
  HOST_ENVELOPE_THRESHOLDS,
  type HostEnvelopeBreachStreaks,
  type HostEnvelopeEvaluation,
} from "./preflight-diagnostic-host-envelope.ts";

const HOST_ENVELOPE_RECORD_FILE = "host-pressure.jsonl";
const HOST_ENVELOPE_MANIFEST_FILE = "host-pressure-manifest.json";
const PRIVATE_FILE_MODE = 0o600;

type HostEnvelopeRecordInput = Readonly<{
  readonly snapshot: DiagnosticHostEnvelopeSnapshot;
  readonly status: HostEnvelopeEvaluation["status"];
  readonly reasons: readonly string[];
  readonly breachStreaks: HostEnvelopeBreachStreaks;
}>;

type HostEnvelopeReceiptFinalInput = Readonly<{
  readonly status: HostEnvelopeEvaluation["status"] | "inconclusive";
  readonly reason: string;
}>;

type HostEnvelopeReceiptPaths = Readonly<{
  readonly recordsPath: string;
  readonly manifestPath: string;
}>;

export type DiagnosticHostEnvelopeReceipt = Readonly<{
  readonly record: (input: HostEnvelopeRecordInput) => Promise<void>;
  readonly finalize: (
    input: HostEnvelopeReceiptFinalInput,
  ) => Promise<HostEnvelopeReceiptPaths>;
  readonly closeWithoutManifest: () => Promise<void>;
}>;

export {
  type HealthyPreResourceReceipt,
  readHealthyPreResourceReceipt,
} from "./receipt/preflight-diagnostic-host-envelope-receipt-reader.ts";

const reasonCodes = new Map<string, string>([
  ["raw free memory below baseline", "raw-baseline"],
  ["available memory below baseline", "available-baseline"],
  ["memory pressure free percentage below baseline", "pressure-free-baseline"],
  ["swap used above baseline", "swap-baseline"],
  ["compressed memory above baseline", "compressed-baseline"],
  ["raw free memory below abort threshold", "raw-abort"],
  ["available memory below abort threshold", "available-abort"],
  [
    "memory pressure free percentage below abort threshold",
    "pressure-free-abort",
  ],
  ["swap used above abort threshold", "swap-abort"],
  ["swap growth above abort threshold", "swap-growth-abort"],
  ["compressed memory above abort threshold", "compressed-abort"],
  ["memory pressure state is not normal", "pressure-state"],
  ["missing cumulative counter", "missing-counter"],
  ["cumulative counter reset or wrap", "counter-reset"],
  ["available memory exceeds total memory", "available-over-total"],
  ["invalid pressure free percentage", "invalid-pressure-free"],
  ["invalid host envelope snapshot", "invalid-snapshot"],
]);

const reasonCodeFor = (reason: string): string => {
  const known = reasonCodes.get(reason);
  if (known !== undefined) return known;
  const missingField = /^missing (.+)$/u.exec(reason)?.[1];
  return missingField === undefined ? "other" : `missing:${missingField}`;
};

export const reasonCodesFor = (reasons: readonly string[]): readonly string[] =>
  reasons.map(reasonCodeFor);

interface ReceiptState {
  closed: boolean;
  failed: Error | undefined;
  queue: Promise<void>;
  recordCount: number;
  payloadBytes: number;
}

const errorFor = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));

export const serializeHostEnvelopeRecord = (
  input: HostEnvelopeRecordInput,
): string => {
  const text = `${JSON.stringify({
    t: input.snapshot.timestampWall,
    p: input.snapshot.phase,
    f: input.snapshot.rawFreeBytes,
    a: input.snapshot.availableBytes,
    n: input.snapshot.totalBytes,
    c: input.snapshot.compressedBytes,
    u: input.snapshot.swapUsedBytes,
    v: input.snapshot.swapFreeBytes,
    q: input.snapshot.pressureFreePercent,
    x: input.snapshot.pressureState,
    i: input.snapshot.pageins,
    o: input.snapshot.pageouts,
    si: input.snapshot.swapins,
    so: input.snapshot.swapouts,
    st: input.status,
    r: reasonCodesFor(input.reasons),
    k: [
      input.breachStreaks.rawFreeBytes,
      input.breachStreaks.availableBytes,
      input.breachStreaks.pressureFreePercent,
      input.breachStreaks.compressedBytes,
    ],
  })}\n`;
  if (Buffer.byteLength(text, "utf8") > HOST_ENVELOPE_THRESHOLDS.maxRecordBytes)
    throw new Error("Host envelope record exceeds byte bound");
  return text;
};

const writeRecord = async (input: {
  readonly state: ReceiptState;
  readonly fileHandle: Awaited<ReturnType<typeof open>>;
  readonly record: HostEnvelopeRecordInput;
}): Promise<void> => {
  const { state, fileHandle } = input;
  if (state.closed) throw new Error("Host envelope receipt is closed");
  if (state.failed !== undefined) throw state.failed;
  if (state.recordCount >= HOST_ENVELOPE_THRESHOLDS.maxRecords)
    throw new Error("Host envelope receipt exceeds record bound");
  const text = serializeHostEnvelopeRecord(input.record);
  const bytes = Buffer.byteLength(text, "utf8");
  const maxPayloadBytes =
    HOST_ENVELOPE_THRESHOLDS.maxRecords *
    HOST_ENVELOPE_THRESHOLDS.maxRecordBytes;
  if (state.payloadBytes + bytes > maxPayloadBytes)
    throw new Error("Host envelope receipt exceeds payload bound");
  await fileHandle.write(text, undefined, "utf8");
  state.payloadBytes += bytes;
  state.recordCount += 1;
};

const closeReceiptFile = async (input: {
  readonly state: ReceiptState;
  readonly fileHandle: Awaited<ReturnType<typeof open>>;
}): Promise<void> => {
  if (input.state.closed) return;
  input.state.closed = true;
  await input.fileHandle.sync();
  await input.fileHandle.close();
};

const finalizeReceipt = async (input: {
  readonly state: ReceiptState;
  readonly fileHandle: Awaited<ReturnType<typeof open>>;
  readonly recordsPath: string;
  readonly manifestPath: string;
  readonly sourceSha: string;
  readonly sourceTree: string;
  readonly campaignId: string;
  readonly final: HostEnvelopeReceiptFinalInput;
}): Promise<HostEnvelopeReceiptPaths> => {
  const { state, fileHandle } = input;
  await state.queue;
  if (state.failed !== undefined) {
    await closeReceiptFile({ state, fileHandle });
    throw state.failed;
  }
  if (state.closed) throw new Error("Host envelope receipt is closed");
  await closeReceiptFile({ state, fileHandle });
  await assertPreflightRegularFile(input.recordsPath);
  const payload = await readFile(input.recordsPath);
  if (payload.byteLength !== state.payloadBytes)
    throw new Error("Host envelope payload size changed before manifest");
  const manifestText = `${JSON.stringify({
    artifact: "DIAGNOSTIC_HOST_ENVELOPE",
    version: 1,
    sourceSha: input.sourceSha,
    sourceTree: input.sourceTree,
    campaignId: input.campaignId,
    recordCount: state.recordCount,
    payloadBytes: state.payloadBytes,
    payloadDigest: createHash("sha256").update(payload).digest("hex"),
    recordsPath: input.recordsPath,
    status: input.final.status,
    reason: input.final.reason,
  })}\n`;
  const manifestBytes = Buffer.byteLength(manifestText, "utf8");
  if (manifestBytes > HOST_ENVELOPE_THRESHOLDS.maxManifestBytes)
    throw new Error("Host envelope manifest exceeds byte bound");
  if (
    state.payloadBytes + manifestBytes >
    HOST_ENVELOPE_THRESHOLDS.maxAggregateBytes
  )
    throw new Error("Host envelope aggregate exceeds byte bound");
  await writeFile(input.manifestPath, manifestText, {
    encoding: "utf8",
    flag: "wx",
    mode: PRIVATE_FILE_MODE,
  });
  await assertPreflightRegularFile(input.manifestPath);
  return { recordsPath: input.recordsPath, manifestPath: input.manifestPath };
};

export const createDiagnosticHostEnvelopeReceipt = async (input: {
  readonly archiveRoot: string;
  readonly outputRoot: string;
  readonly sourceSha: string;
  readonly sourceTree: string;
  readonly campaignId: string;
}): Promise<DiagnosticHostEnvelopeReceipt> => {
  await ensurePreflightArchiveDirectory(input.archiveRoot, input.outputRoot);
  const recordsPath = path.join(input.outputRoot, HOST_ENVELOPE_RECORD_FILE);
  const manifestPath = path.join(input.outputRoot, HOST_ENVELOPE_MANIFEST_FILE);
  await assertPreflightArchivePath(input.archiveRoot, recordsPath);
  await assertPreflightArchivePath(input.archiveRoot, manifestPath);
  const fileHandle = await open(recordsPath, "wx", PRIVATE_FILE_MODE);
  const state: ReceiptState = {
    closed: false,
    failed: undefined,
    queue: Promise.resolve(),
    recordCount: 0,
    payloadBytes: 0,
  };
  const record = (recordInput: HostEnvelopeRecordInput): Promise<void> => {
    const next = state.queue.then(() =>
      writeRecord({ state, fileHandle, record: recordInput }),
    );
    state.queue = next.catch((error: unknown) => {
      state.failed = errorFor(error);
    });
    return next;
  };
  const closeWithoutManifest = async (): Promise<void> => {
    await state.queue;
    await closeReceiptFile({ state, fileHandle });
  };
  const finalize = (final: HostEnvelopeReceiptFinalInput) =>
    finalizeReceipt({
      state,
      fileHandle,
      recordsPath,
      manifestPath,
      sourceSha: input.sourceSha,
      sourceTree: input.sourceTree,
      campaignId: input.campaignId,
      final,
    });
  return { record, finalize, closeWithoutManifest };
};
