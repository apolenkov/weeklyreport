import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { writeManifestFile } from "./manifest-source.ts";
import {
  createRuntimeSourceValidationReceipt,
  parseRuntimeSourceValidationReceipt,
  RuntimeSourceValidationError,
  type RuntimeSourceValidationReceipt,
  serializeRuntimeSourceValidationReceipt,
} from "./runtime-source-validation-contract.ts";
import {
  parseSourceArtifact,
  serializeSourceArtifact,
  type SourceArtifact,
} from "./source-artifact.ts";

type CanonicalRuntimeSource = Readonly<{
  source: SourceArtifact;
  sourceFileSha256: string;
  sourceByteLength: number;
}>;

export type RuntimeSourceValidationReceiptFile = Readonly<{
  receipt: RuntimeSourceValidationReceipt;
  receiptFileSha256: string;
}>;

const digestBytes = (value: string): string =>
  createHash("sha256").update(value, "utf8").digest("hex");

const readText = async (filePath: string, label: string): Promise<string> =>
  readFile(filePath, "utf8").catch((error: unknown) => {
    if (error instanceof Error)
      throw new RuntimeSourceValidationError(
        `Cannot read ${label} at ${filePath}: ${error.message}`,
      );
    throw error;
  });

export async function validateCanonicalRuntimeSource(input: {
  readonly sourcePath: string;
  readonly expectedSource: SourceArtifact;
}): Promise<CanonicalRuntimeSource> {
  const text = await readText(input.sourcePath, "SOURCE.json");
  const source = (() => {
    try {
      return parseSourceArtifact(JSON.parse(text));
    } catch (error: unknown) {
      if (error instanceof RuntimeSourceValidationError) throw error;
      throw new RuntimeSourceValidationError(
        `SOURCE.json is invalid: ${error instanceof Error ? error.message : "invalid JSON"}`,
      );
    }
  })();
  const canonicalText = serializeSourceArtifact(input.expectedSource);
  if (text !== canonicalText)
    throw new RuntimeSourceValidationError(
      "SOURCE.json bytes do not match the canonical source builder output",
    );
  return {
    source,
    sourceFileSha256: digestBytes(text),
    sourceByteLength: Buffer.byteLength(text, "utf8"),
  };
}

export async function readRuntimeSourceValidationReceipt(
  receiptPath: string,
): Promise<RuntimeSourceValidationReceipt> {
  return (await readRuntimeSourceValidationReceiptFile(receiptPath)).receipt;
}

export async function readRuntimeSourceValidationReceiptFile(
  receiptPath: string,
): Promise<RuntimeSourceValidationReceiptFile> {
  const text = await readText(receiptPath, "SOURCE-VALIDATION.json");
  try {
    const receipt = parseRuntimeSourceValidationReceipt(JSON.parse(text));
    if (text !== serializeRuntimeSourceValidationReceipt(receipt))
      throw new RuntimeSourceValidationError(
        "SOURCE-VALIDATION.json bytes are not canonical",
      );
    return { receipt, receiptFileSha256: digestBytes(text) };
  } catch (error: unknown) {
    if (error instanceof RuntimeSourceValidationError) throw error;
    throw new RuntimeSourceValidationError(
      `SOURCE-VALIDATION.json is invalid: ${error instanceof Error ? error.message : "invalid JSON"}`,
    );
  }
}

const assertReceiptMatchesSource = (
  receipt: RuntimeSourceValidationReceipt,
  canonical: CanonicalRuntimeSource,
): void => {
  const { source } = canonical;
  if (
    receipt.campaignId !== source.campaignId ||
    receipt.sourceSha !== source.sourceSha ||
    receipt.sourceTree !== source.sourceTree ||
    receipt.treeDigest !== source.treeDigest ||
    receipt.sourceDigest !== source.sourceDigest ||
    receipt.planDigest !== source.plan.digest ||
    receipt.sourceFileSha256 !== canonical.sourceFileSha256 ||
    receipt.sourceByteLength !== canonical.sourceByteLength
  )
    throw new RuntimeSourceValidationError(
      "SOURCE-VALIDATION.json does not match canonical SOURCE.json",
    );
};

export async function writeRuntimeSourceValidationReceipt(input: {
  readonly sourcePath: string;
  readonly receiptPath: string;
  readonly expectedSource: SourceArtifact;
  readonly validatedAt?: string;
}): Promise<RuntimeSourceValidationReceiptFile> {
  const canonical = await validateCanonicalRuntimeSource(input);
  const receipt = createRuntimeSourceValidationReceipt({
    artifact: "RUNTIME_SOURCE_VALIDATION",
    version: 1,
    status: "PASS",
    validatedAt: input.validatedAt ?? new Date().toISOString(),
    campaignId: canonical.source.campaignId,
    sourceSha: canonical.source.sourceSha,
    sourceTree: canonical.source.sourceTree,
    treeDigest: canonical.source.treeDigest,
    sourceDigest: canonical.source.sourceDigest,
    planDigest: canonical.source.plan.digest,
    sourceFileSha256: canonical.sourceFileSha256,
    sourceByteLength: canonical.sourceByteLength,
  });
  const text = serializeRuntimeSourceValidationReceipt(receipt);
  await writeManifestFile(input.receiptPath, text);
  return { receipt, receiptFileSha256: digestBytes(text) };
}

export async function assertValidatedRuntimeSource(input: {
  readonly sourcePath: string;
  readonly receiptPath: string;
  readonly expectedSource: SourceArtifact;
  readonly expectedReceiptFileSha256: string;
}): Promise<
  Readonly<{
    source: SourceArtifact;
    receipt: RuntimeSourceValidationReceipt;
    receiptFileSha256: string;
  }>
> {
  const canonical = await validateCanonicalRuntimeSource(input);
  const { receipt, receiptFileSha256 } =
    await readRuntimeSourceValidationReceiptFile(input.receiptPath);
  if (receiptFileSha256 !== input.expectedReceiptFileSha256)
    throw new RuntimeSourceValidationError(
      "SOURCE-VALIDATION.json file SHA does not match external authority",
    );
  assertReceiptMatchesSource(receipt, canonical);
  return { source: canonical.source, receipt, receiptFileSha256 };
}
