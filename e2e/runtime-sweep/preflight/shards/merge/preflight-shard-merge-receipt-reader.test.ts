import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { sha256Hex } from "../../../support/ids.ts";
import { mergePreflightShards } from "./preflight-shard-merge.ts";
import { preflightShardMergeReceiptBody } from "./preflight-shard-merge-contract.ts";
import { readPreflightShardMergeReceipt } from "./preflight-shard-merge-receipt-reader.ts";
import {
  createPersistedMergeFixture,
  type PersistedMergeFixture,
} from "./preflight-shard-merge-test-support.ts";

describe("durable preflight shard merge receipt reader", () => {
  let fixture: PersistedMergeFixture;

  beforeAll(async () => {
    fixture = await createPersistedMergeFixture();
  });

  afterAll(async () => {
    await fixture.dispose();
  });

  const merge = () =>
    mergePreflightShards({
      source: fixture.source,
      assignment: fixture.assignment,
      donorRoots: fixture.donorRoots,
      completionRequests: fixture.requests,
    });

  const receiptWithBody = (
    body: ReturnType<typeof preflightShardMergeReceiptBody>,
  ) => ({
    ...body,
    receiptDigest: sha256Hex(body),
  });

  const readReceipt = (
    preflight: Awaited<ReturnType<typeof merge>>["preflight"],
    receipt: ReturnType<typeof receiptWithBody>,
    donorRoots = fixture.donorRoots,
  ) =>
    readPreflightShardMergeReceipt({
      source: fixture.source,
      assignment: fixture.assignment,
      donorRoots,
      preflight,
      receipt,
    });

  it("rejects self-consistent receipt digests when persisted evidence digests are arbitrary", async () => {
    const result = await merge();
    const body = preflightShardMergeReceiptBody(result.receipt);
    const firstShard = body.shards[0];
    const secondShard = body.shards[1];
    if (firstShard === undefined || secondShard === undefined)
      throw new Error("merge receipt requires two shards");

    const arbitraryProofDigest = receiptWithBody({
      ...body,
      shards: [
        { ...firstShard, resourceProofDigest: "a".repeat(64) },
        secondShard,
      ],
    });
    await expect(
      readReceipt(result.preflight, arbitraryProofDigest),
    ).rejects.toThrow(/resource proof identity drifted/u);

    const arbitraryCompletionDigest = receiptWithBody({
      ...body,
      shards: [
        { ...firstShard, completionDigest: "b".repeat(64) },
        secondShard,
      ],
    });
    await expect(
      readReceipt(result.preflight, arbitraryCompletionDigest),
    ).rejects.toThrow(/completion, journal, or ordered state binding drifted/u);

    const arbitraryJournalDigest = receiptWithBody({
      ...body,
      shards: [
        { ...firstShard, journalTailDigest: "c".repeat(64) },
        secondShard,
      ],
    });
    await expect(
      readReceipt(result.preflight, arbitraryJournalDigest),
    ).rejects.toThrow(/completion, journal, or ordered state binding drifted/u);
  });

  it("rejects canonical-looking receipt paths for a nonexistent Air donor", async () => {
    const result = await merge();
    const body = preflightShardMergeReceiptBody(result.receipt);
    const firstShard = body.shards[0];
    const secondShard = body.shards[1];
    if (firstShard === undefined || secondShard === undefined)
      throw new Error("merge receipt requires two shards");
    const airRoot = path.join(
      tmpdir(),
      `preflight-shard-merge-air-missing-${process.pid}`,
    );
    await rm(airRoot, { recursive: true, force: true });
    const airBase = path.join(
      airRoot,
      "shards",
      firstShard.logicalShardId,
      "attempts",
      firstShard.shardAttemptId,
    );
    const airReceipt = receiptWithBody({
      ...body,
      shards: [
        {
          ...firstShard,
          donorId: "Air",
          donorRoot: airRoot,
          resourceProofPath: path.join(
            airBase,
            "PREFLIGHT_SHARD_RESOURCE_PROOF.json",
          ),
          completionPath: path.join(airBase, "SHARD_COMPLETE.json"),
          journalPath: path.join(airBase, "PREFLIGHT_SHARD.journal.jsonl"),
        },
        secondShard,
      ],
    });
    try {
      await expect(
        readReceipt(result.preflight, airReceipt, [
          ...fixture.donorRoots,
          { donorId: "Air", root: airRoot },
        ]),
      ).rejects.toThrow(/resource proof read failed/u);
    } finally {
      await rm(airRoot, { recursive: true, force: true });
    }
  });
});
