import { z } from "zod";

import { sha256Hex, stableSerialize } from "../support/ids.ts";
import { sha256DigestSchema, sourceTreeSchema } from "./contracts.ts";
import { freezeDeep } from "./manifest-source.ts";

const canonicalIsoTimestampSchema = z.string().refine((value) => {
  const timestamp = new Date(value);
  return (
    !Number.isNaN(timestamp.valueOf()) && timestamp.toISOString() === value
  );
}, "validatedAt must be a canonical UTC ISO timestamp");

export const runtimeSourceValidationReceiptSchema = z
  .object({
    artifact: z.literal("RUNTIME_SOURCE_VALIDATION"),
    version: z.literal(1),
    status: z.literal("PASS"),
    validatedAt: canonicalIsoTimestampSchema,
    campaignId: z.string().trim().min(1),
    sourceSha: sourceTreeSchema,
    sourceTree: sourceTreeSchema,
    treeDigest: sha256DigestSchema,
    sourceDigest: sha256DigestSchema,
    planDigest: sha256DigestSchema,
    sourceFileSha256: sha256DigestSchema,
    sourceByteLength: z.number().int().positive(),
    receiptDigest: sha256DigestSchema,
  })
  .strict();

export type RuntimeSourceValidationReceipt = z.infer<
  typeof runtimeSourceValidationReceiptSchema
>;

export class RuntimeSourceValidationError extends Error {
  override readonly name = "RuntimeSourceValidationError";
}

const receiptBody = (
  receipt: RuntimeSourceValidationReceipt,
): Omit<RuntimeSourceValidationReceipt, "receiptDigest"> => {
  const { receiptDigest: _receiptDigest, ...body } = receipt;
  return body;
};

export function parseRuntimeSourceValidationReceipt(
  value: unknown,
): RuntimeSourceValidationReceipt {
  const receipt = runtimeSourceValidationReceiptSchema.parse(value);
  if (sha256Hex(receiptBody(receipt)) !== receipt.receiptDigest)
    throw new RuntimeSourceValidationError(
      "SOURCE-VALIDATION.json digest does not match contents",
    );
  return freezeDeep(receipt);
}

export const serializeRuntimeSourceValidationReceipt = (
  receipt: RuntimeSourceValidationReceipt,
): string =>
  `${stableSerialize(parseRuntimeSourceValidationReceipt(receipt))}\n`;

export const createRuntimeSourceValidationReceipt = (
  body: Omit<RuntimeSourceValidationReceipt, "receiptDigest">,
): RuntimeSourceValidationReceipt =>
  parseRuntimeSourceValidationReceipt({
    ...body,
    receiptDigest: sha256Hex(body),
  });
