import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import * as path from "node:path";

import {
  assertPreflightArchivePath,
  assertPreflightRegularFile,
} from "../../preflight-archive-path.ts";
import {
  type DiagnosticHostEnvelopeCounters,
  type DiagnosticHostEnvelopeSnapshot,
  EMPTY_HOST_ENVELOPE_BREACH_STREAKS,
  HOST_ENVELOPE_THRESHOLDS,
} from "../preflight-diagnostic-host-envelope.ts";
import { evaluateHostEnvelopeSample } from "../preflight-diagnostic-host-envelope-evaluator.ts";

const PRIVATE_FILE_MODE = 0o600;
const PERMISSION_MASK = 0o777;
const RECORD_KEYS = [
  "t",
  "p",
  "f",
  "a",
  "n",
  "c",
  "u",
  "v",
  "q",
  "x",
  "i",
  "o",
  "si",
  "so",
  "st",
  "r",
  "k",
] as const;
const MANIFEST_KEYS = [
  "artifact",
  "version",
  "sourceSha",
  "sourceTree",
  "campaignId",
  "recordCount",
  "payloadBytes",
  "payloadDigest",
  "recordsPath",
  "status",
  "reason",
] as const;
const POST_INFRASTRUCTURE_RECORD_COUNT = 60;
const MAX_PRESSURE_FREE_PERCENT = 100;
const REQUIRED_BREACH_STREAK_COUNT = 4;

export type PostInfrastructureReceiptInput = Readonly<{
  readonly archiveRoot: string;
  readonly manifestPath: string;
  readonly sourceSha: string;
  readonly sourceTree: string;
  readonly campaignId: string;
}>;

export type HealthyPostInfrastructureReceipt = Readonly<{
  readonly manifestPath: string;
  readonly recordsPath: string;
  readonly recordCount: typeof POST_INFRASTRUCTURE_RECORD_COUNT;
  readonly payloadBytes: number;
  readonly baselineReceiptDigest: string;
  readonly lastSnapshot: DiagnosticHostEnvelopeSnapshot;
  readonly lastCounters: DiagnosticHostEnvelopeCounters;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const finiteNonNegative = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

const finitePercent = (value: unknown): value is number =>
  finiteNonNegative(value) && value <= MAX_PRESSURE_FREE_PERCENT;

const safeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

const assertPrivateFile = async (filePath: string): Promise<void> => {
  const stat = await lstat(filePath);
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    (stat.mode & PERMISSION_MASK) !== PRIVATE_FILE_MODE
  )
    throw new Error("Host baseline receipt must be a mode 0600 regular file");
};

const parseCanonicalJson = (text: string, label: string): unknown => {
  if (!text.endsWith("\n"))
    throw new Error(`${label} is not newline terminated`);
  const value: unknown = JSON.parse(text);
  if (`${JSON.stringify(value)}\n` !== text)
    throw new Error(`${label} is not canonical JSON`);
  return value;
};

const digestFor = (manifestBytes: Buffer, payload: Buffer): string =>
  createHash("sha256").update(manifestBytes).update(payload).digest("hex");

const manifestFor = (
  value: unknown,
  input: PostInfrastructureReceiptInput,
): {
  readonly recordsPath: string;
  readonly recordCount: typeof POST_INFRASTRUCTURE_RECORD_COUNT;
} => {
  if (!isRecord(value))
    throw new Error("Host baseline manifest is not an object");
  if (Object.keys(value).join("\0") !== MANIFEST_KEYS.join("\0"))
    throw new Error("Host baseline manifest keys are not canonical");
  const recordsPath = value.recordsPath;
  if (typeof recordsPath !== "string" || !path.isAbsolute(recordsPath))
    throw new Error("Host baseline manifest has no absolute records path");
  if (
    value.artifact !== "DIAGNOSTIC_HOST_ENVELOPE" ||
    value.version !== 1 ||
    value.sourceSha !== input.sourceSha ||
    value.sourceTree !== input.sourceTree ||
    value.campaignId !== input.campaignId ||
    value.status !== "healthy" ||
    value.recordCount !== POST_INFRASTRUCTURE_RECORD_COUNT
  )
    throw new Error("Host baseline manifest identity is invalid");
  return { recordsPath, recordCount: POST_INFRASTRUCTURE_RECORD_COUNT };
};

const bytesFor = (value: unknown, label: string): number => {
  if (!finiteNonNegative(value) || !Number.isSafeInteger(value))
    throw new Error(`Host baseline record has invalid ${label}`);
  return value;
};

const snapshotFor = (value: unknown): DiagnosticHostEnvelopeSnapshot => {
  if (!isRecord(value))
    throw new Error("Host baseline record is not an object");
  if (Object.keys(value).join("\0") !== RECORD_KEYS.join("\0"))
    throw new Error("Host baseline record keys are not canonical");
  if (value.p !== "post-infrastructure" || value.st !== "healthy")
    throw new Error(
      "Host baseline record is not a healthy post-infrastructure sample",
    );
  const rawFreeBytes = bytesFor(value.f, "raw free bytes");
  const availableBytes = bytesFor(value.a, "available bytes");
  const totalBytes = bytesFor(value.n, "total bytes");
  const compressedBytes = bytesFor(value.c, "compressed bytes");
  const swapUsedBytes = bytesFor(value.u, "swap used bytes");
  const swapFreeBytes = bytesFor(value.v, "swap free bytes");
  if (!finitePercent(value.q) || value.x !== "normal")
    throw new Error("Host baseline record pressure is not healthy");
  if (!Array.isArray(value.r) || value.r.length > 0)
    throw new Error("Host baseline record reasons are invalid");
  if (
    !Array.isArray(value.k) ||
    value.k.length !== REQUIRED_BREACH_STREAK_COUNT ||
    value.k.some((streak) => !safeInteger(streak) || streak !== 0)
  )
    throw new Error("Host baseline record breach streaks are invalid");
  return {
    timestampWall: bytesFor(value.t, "timestamp"),
    phase: "post-infrastructure",
    rawFreeBytes,
    availableBytes,
    totalBytes,
    compressedBytes,
    swapUsedBytes,
    swapFreeBytes,
    pressureFreePercent: value.q,
    pressureState: "normal",
    pageins: bytesFor(value.i, "pageins"),
    pageouts: bytesFor(value.o, "pageouts"),
    swapins: bytesFor(value.si, "swapins"),
    swapouts: bytesFor(value.so, "swapouts"),
  };
};

const recordsFor = (
  payload: Buffer,
): readonly DiagnosticHostEnvelopeSnapshot[] => {
  const lines = payload.toString("utf8").split("\n");
  if (lines.at(-1) !== "")
    throw new Error("Host baseline payload is not newline terminated");
  lines.pop();
  if (lines.length !== POST_INFRASTRUCTURE_RECORD_COUNT)
    throw new Error("Host baseline record count is not exactly 60");
  return lines.map((line, index) => {
    if (
      Buffer.byteLength(`${line}\n`, "utf8") >
      HOST_ENVELOPE_THRESHOLDS.maxRecordBytes
    )
      throw new Error(
        `Host baseline record ${String(index + 1)} exceeds byte bound`,
      );
    return snapshotFor(
      parseCanonicalJson(
        `${line}\n`,
        `Host baseline record ${String(index + 1)}`,
      ),
    );
  });
};

export const readHealthyPostInfrastructureReceipt = async (
  input: PostInfrastructureReceiptInput,
): Promise<HealthyPostInfrastructureReceipt> => {
  await assertPreflightArchivePath(input.archiveRoot, input.manifestPath);
  await assertPrivateFile(input.manifestPath);
  if (
    (await lstat(input.manifestPath)).size >
    HOST_ENVELOPE_THRESHOLDS.maxManifestBytes
  )
    throw new Error("Host baseline manifest exceeds byte bound");
  const manifestBytes = await readFile(input.manifestPath);
  const manifest = manifestFor(
    parseCanonicalJson(
      manifestBytes.toString("utf8"),
      "Host baseline manifest",
    ),
    input,
  );
  await assertPreflightArchivePath(input.archiveRoot, manifest.recordsPath);
  await assertPreflightRegularFile(manifest.recordsPath);
  await assertPrivateFile(manifest.recordsPath);
  const recordsStat = await lstat(manifest.recordsPath);
  const payload = await readFile(manifest.recordsPath);
  const payloadBytes = (
    JSON.parse(manifestBytes.toString("utf8")) as Record<string, unknown>
  ).payloadBytes;
  const payloadDigest = (
    JSON.parse(manifestBytes.toString("utf8")) as Record<string, unknown>
  ).payloadDigest;
  if (
    !safeInteger(payloadBytes) ||
    recordsStat.size !== payloadBytes ||
    payload.byteLength !== payloadBytes ||
    payload.byteLength >
      HOST_ENVELOPE_THRESHOLDS.maxRecords *
        HOST_ENVELOPE_THRESHOLDS.maxRecordBytes ||
    payload.byteLength + manifestBytes.byteLength >
      HOST_ENVELOPE_THRESHOLDS.maxAggregateBytes ||
    payloadDigest !== createHash("sha256").update(payload).digest("hex")
  )
    throw new Error("Host baseline payload does not match manifest");
  const snapshots = recordsFor(payload);
  // eslint-disable-next-line no-restricted-syntax -- counters advance across the ordered receipt
  let priorCounters: DiagnosticHostEnvelopeCounters | undefined;
  // eslint-disable-next-line no-restricted-syntax -- the last sample is needed as the next baseline anchor
  let lastSnapshot: DiagnosticHostEnvelopeSnapshot | undefined;
  for (const [index, snapshot] of snapshots.entries()) {
    if (
      lastSnapshot !== undefined &&
      snapshot.timestampWall <= lastSnapshot.timestampWall
    )
      throw new Error(
        `Host baseline timestamp did not advance at sample ${String(index + 1)}`,
      );
    const evaluation = evaluateHostEnvelopeSample({
      snapshot,
      mode: "baseline",
      baselineSwapUsedBytes: snapshot.swapUsedBytes ?? 0,
      priorCounters,
      breachStreaks: EMPTY_HOST_ENVELOPE_BREACH_STREAKS,
    });
    if (
      evaluation.status !== "healthy" ||
      evaluation.nextCounters === undefined
    )
      throw new Error(
        `Host baseline sample ${String(index + 1)} is not healthy`,
      );
    priorCounters = evaluation.nextCounters;
    lastSnapshot = snapshot;
  }
  if (lastSnapshot === undefined || priorCounters === undefined)
    throw new Error("Host baseline has no samples");
  return {
    manifestPath: input.manifestPath,
    recordsPath: manifest.recordsPath,
    recordCount: POST_INFRASTRUCTURE_RECORD_COUNT,
    payloadBytes,
    baselineReceiptDigest: digestFor(manifestBytes, payload),
    lastSnapshot,
    lastCounters: priorCounters,
  };
};
