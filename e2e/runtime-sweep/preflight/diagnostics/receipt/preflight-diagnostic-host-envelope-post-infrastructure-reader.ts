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
  HOST_ENVELOPE_THRESHOLDS,
} from "../preflight-diagnostic-host-envelope.ts";
import {
  POST_INFRASTRUCTURE_RECORD_COUNT,
  readHealthyPostInfrastructureRecords,
} from "./preflight-diagnostic-host-envelope-post-infrastructure-records.ts";

const PRIVATE_FILE_MODE = 0o600;
const PERMISSION_MASK = 0o777;
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const safeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

const parseCanonicalJson = (text: string, label: string): unknown => {
  if (!text.endsWith("\n"))
    throw new Error(`${label} is not newline terminated`);
  const value: unknown = JSON.parse(text);
  if (`${JSON.stringify(value)}\n` !== text)
    throw new Error(`${label} is not canonical JSON`);
  return value;
};
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
  readonly firstSnapshot: DiagnosticHostEnvelopeSnapshot;
  readonly lastSnapshot: DiagnosticHostEnvelopeSnapshot;
  readonly lastCounters: DiagnosticHostEnvelopeCounters;
}>;

const assertPrivateFile = async (filePath: string): Promise<void> => {
  const stat = await lstat(filePath);
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    (stat.mode & PERMISSION_MASK) !== PRIVATE_FILE_MODE
  )
    throw new Error("Host baseline receipt must be a mode 0600 regular file");
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
  const records = readHealthyPostInfrastructureRecords(payload);
  return {
    manifestPath: input.manifestPath,
    recordsPath: manifest.recordsPath,
    recordCount: records.recordCount,
    payloadBytes,
    baselineReceiptDigest: digestFor(manifestBytes, payload),
    firstSnapshot: records.firstSnapshot,
    lastSnapshot: records.lastSnapshot,
    lastCounters: records.lastCounters,
  };
};
