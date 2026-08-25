import { z } from "zod";

import { sha256DigestSchema } from "../../../source/contracts.ts";
import { freezeDeep } from "../../../source/manifest-source.ts";
import { sha256Hex } from "../../../support/ids.ts";
import { resourceProofPathSchema } from "../resources/preflight-shard-resource-proof-contract.ts";
import {
  PreflightShardJournalError,
  preflightShardJournalIdentitySchema,
  preflightShardJournalStateSchema,
} from "./preflight-shard-journal-contract.ts";

export const PREFLIGHT_SHARD_STATE_RECEIPT =
  "PREFLIGHT_SHARD_STATE_RECEIPT" as const;
export const PREFLIGHT_SHARD_STATE_RECEIPT_VERSION = 1 as const;

const receiptBodySchema = z
  .object({
    artifact: z.literal(PREFLIGHT_SHARD_STATE_RECEIPT),
    version: z.literal(PREFLIGHT_SHARD_STATE_RECEIPT_VERSION),
    ...preflightShardJournalIdentitySchema.shape,
    ...preflightShardJournalStateSchema.shape,
    stateAttempt: z.number().int().positive(),
    startedRecordDigest: sha256DigestSchema,
    segmentArtifactPath: resourceProofPathSchema,
    segmentArtifactDigest: sha256DigestSchema,
    segmentDigest: sha256DigestSchema,
  })
  .strict();

const preflightShardStateReceiptSchema = receiptBodySchema
  .extend({ receiptDigest: sha256DigestSchema })
  .strict();

export type PreflightShardStateReceipt = z.infer<
  typeof preflightShardStateReceiptSchema
>;

export const preflightShardStateReceiptBody = (
  receipt: PreflightShardStateReceipt,
): Omit<PreflightShardStateReceipt, "receiptDigest"> => {
  const { receiptDigest: _receiptDigest, ...body } = receipt;
  return body;
};

export const parsePreflightShardStateReceipt = (
  value: unknown,
): PreflightShardStateReceipt => {
  const parsed = preflightShardStateReceiptSchema.safeParse(value);
  if (!parsed.success)
    throw new PreflightShardJournalError(
      `Invalid shard state receipt: ${parsed.error.message}`,
    );
  const receipt = parsed.data;
  if (
    sha256Hex(preflightShardStateReceiptBody(receipt)) !== receipt.receiptDigest
  )
    throw new PreflightShardJournalError(
      "Shard state receipt digest does not match contents",
    );
  return freezeDeep(receipt);
};
