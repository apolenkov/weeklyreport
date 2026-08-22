import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";

import {
  assertPreflightArchivePath,
  assertPreflightRegularFile,
} from "../../preflight-archive-path.ts";
import { HOST_ENVELOPE_THRESHOLDS } from "../preflight-diagnostic-host-envelope.ts";

export type HealthyReceiptInput = Readonly<{
  readonly archiveRoot: string;
  readonly manifestPath: string;
  readonly sourceSha: string;
  readonly sourceTree: string;
  readonly campaignId: string;
  readonly expectedRecordCount: number;
}>;

export type HealthyPreResourceReceipt = Readonly<{
  readonly manifestPath: string;
  readonly recordsPath: string;
  readonly recordCount: number;
  readonly payloadBytes: number;
}>;

const parseReceiptManifest = (
  manifestText: string,
): Record<string, unknown> => {
  if (
    Buffer.byteLength(manifestText, "utf8") >
    HOST_ENVELOPE_THRESHOLDS.maxManifestBytes
  )
    throw new Error("Host envelope manifest exceeds byte bound");
  const value: unknown = JSON.parse(manifestText);
  if (typeof value !== "object" || value === null)
    throw new Error("Host envelope manifest is not an object");
  return value as Record<string, unknown>;
};

const assertHealthyManifest = (
  manifest: Record<string, unknown>,
  input: HealthyReceiptInput,
): string => {
  const recordsPath = manifest.recordsPath;
  if (typeof recordsPath !== "string")
    throw new Error("Host envelope manifest has no records path");
  if (
    manifest.artifact !== "DIAGNOSTIC_HOST_ENVELOPE" ||
    manifest.version !== 1 ||
    manifest.sourceSha !== input.sourceSha ||
    manifest.sourceTree !== input.sourceTree ||
    manifest.campaignId !== input.campaignId ||
    manifest.status !== "healthy" ||
    manifest.recordCount !== input.expectedRecordCount
  )
    throw new Error("Host envelope pre-resource manifest identity is invalid");
  return recordsPath;
};

const readBoundedReceiptPayload = async (input: {
  readonly recordsPath: string;
  readonly manifest: Record<string, unknown>;
  readonly manifestBytes: number;
}): Promise<Buffer> => {
  const recordsStat = await stat(input.recordsPath);
  const payloadBytes = input.manifest.payloadBytes;
  const maxPayloadBytes =
    HOST_ENVELOPE_THRESHOLDS.maxRecords *
    HOST_ENVELOPE_THRESHOLDS.maxRecordBytes;
  if (
    typeof payloadBytes !== "number" ||
    !Number.isSafeInteger(payloadBytes) ||
    payloadBytes < 0 ||
    payloadBytes > maxPayloadBytes ||
    recordsStat.size !== payloadBytes ||
    recordsStat.size + input.manifestBytes >
      HOST_ENVELOPE_THRESHOLDS.maxAggregateBytes
  )
    throw new Error("Host envelope pre-resource payload exceeds byte bound");
  const payload = await readFile(input.recordsPath);
  const payloadDigest = createHash("sha256").update(payload).digest("hex");
  if (
    input.manifest.payloadBytes !== payload.byteLength ||
    input.manifest.payloadDigest !== payloadDigest
  )
    throw new Error(
      "Host envelope pre-resource payload does not match manifest",
    );
  return payload;
};

const assertHealthyReceiptRecord = (recordText: string): void => {
  if (
    Buffer.byteLength(`${recordText}\n`, "utf8") >
    HOST_ENVELOPE_THRESHOLDS.maxRecordBytes
  )
    throw new Error("Host envelope pre-resource record exceeds byte bound");
  const value: unknown = JSON.parse(recordText);
  if (
    typeof value !== "object" ||
    value === null ||
    (value as Record<string, unknown>).p !== "pre-resource" ||
    (value as Record<string, unknown>).st !== "healthy"
  )
    throw new Error("Host envelope pre-resource record is not healthy");
};

export const readHealthyPreResourceReceipt = async (
  input: HealthyReceiptInput,
): Promise<HealthyPreResourceReceipt> => {
  await assertPreflightArchivePath(input.archiveRoot, input.manifestPath);
  await assertPreflightRegularFile(input.manifestPath);
  const manifestText = await readFile(input.manifestPath, "utf8");
  const manifest = parseReceiptManifest(manifestText);
  const recordsPath = assertHealthyManifest(manifest, input);
  await assertPreflightArchivePath(input.archiveRoot, recordsPath);
  await assertPreflightRegularFile(recordsPath);
  const payload = await readBoundedReceiptPayload({
    recordsPath,
    manifest,
    manifestBytes: Buffer.byteLength(manifestText, "utf8"),
  });
  const records =
    payload.byteLength === 0
      ? []
      : payload.toString("utf8").trimEnd().split("\n");
  if (records.length !== input.expectedRecordCount)
    throw new Error("Host envelope pre-resource record count is invalid");
  records.forEach(assertHealthyReceiptRecord);
  return {
    manifestPath: input.manifestPath,
    recordsPath,
    recordCount: input.expectedRecordCount,
    payloadBytes: payload.byteLength,
  };
};
