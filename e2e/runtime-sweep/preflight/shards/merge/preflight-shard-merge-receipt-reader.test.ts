import { appendFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { sha256Hex } from "../../../support/ids.ts";
import * as completionIo from "../completion/preflight-shard-completion-io.ts";
import { mergePreflightShards } from "./preflight-shard-merge.ts";
import { preflightShardMergeReceiptBody } from "./preflight-shard-merge-contract.ts";
import {
  type PreflightShardMergeReceiptTrustedBinding,
  readPreflightShardMergeReceipt,
} from "./preflight-shard-merge-receipt-reader.ts";
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

  const trustedBindings =
    (): readonly PreflightShardMergeReceiptTrustedBinding[] =>
      fixture.requests.map(
        ({
          context,
          archiveRoot,
          filePath,
          journalPath,
          resourceProofPath,
        }) => ({
          donorId: context.resourceProof.donorId,
          donorRoot: context.resourceProof.donorRoot,
          logicalShardId: context.shard.logicalShardId,
          shardAttemptId: context.resourceProof.shardAttemptId,
          archiveRoot,
          resourceProofPath,
          completionPath: filePath,
          journalPath,
        }),
      );

  const preflightWithBody = (
    body: Omit<
      Awaited<ReturnType<typeof merge>>["preflight"],
      "preflightDigest"
    >,
  ) => {
    return { ...body, preflightDigest: sha256Hex(body) };
  };

  const readReceipt = (
    preflight: Awaited<ReturnType<typeof merge>>["preflight"],
    receipt: ReturnType<typeof receiptWithBody>,
    donorRoots = fixture.donorRoots,
    bindings = trustedBindings(),
  ) =>
    readPreflightShardMergeReceipt({
      source: fixture.source,
      assignment: fixture.assignment,
      donorRoots,
      trustedBindings: bindings,
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
        readReceipt(
          result.preflight,
          airReceipt,
          [...fixture.donorRoots, { donorId: "Air", root: airRoot }],
          [
            {
              donorId: "Air",
              donorRoot: airRoot,
              logicalShardId: firstShard.logicalShardId,
              shardAttemptId: firstShard.shardAttemptId,
              archiveRoot: airRoot,
              resourceProofPath: airReceipt.shards[0]?.resourceProofPath ?? "",
              completionPath: airReceipt.shards[0]?.completionPath ?? "",
              journalPath: airReceipt.shards[0]?.journalPath ?? "",
            },
            ...trustedBindings().slice(1),
          ],
        ),
      ).rejects.toThrow(/resource proof read failed/u);
    } finally {
      await rm(airRoot, { recursive: true, force: true });
    }
  });

  it("rejects a self-consistent preflight forged away from durable terminal segments", async () => {
    const result = await merge();
    const { preflightDigest: _digest, ...body } = result.preflight;
    if (body.segments[0] === undefined)
      throw new Error("merge preflight requires segments");
    const preflight = preflightWithBody({
      ...body,
      segments: body.segments.map((segment, index) =>
        index === 0
          ? {
              ...segment,
              state: { ...segment.state, pairwiseDigest: "f".repeat(64) },
            }
          : segment,
      ),
    });
    const receipt = receiptWithBody({
      ...preflightShardMergeReceiptBody(result.receipt),
      preflightDigest: preflight.preflightDigest,
    });
    await expect(readReceipt(preflight, receipt)).rejects.toThrow(
      /reconstructed durable terminal segments/u,
    );
  });

  it("rejects a forged preflight digest before durable reconstruction", async () => {
    const result = await merge();
    const { preflightDigest: _digest, ...body } = result.preflight;
    if (body.segments[0] === undefined)
      throw new Error("merge preflight requires segments");
    const forged = {
      ...body,
      segments: body.segments.map((segment, index) =>
        index === 0
          ? {
              ...segment,
              state: { ...segment.state, pairwiseDigest: "e".repeat(64) },
            }
          : segment,
      ),
      preflightDigest: result.preflight.preflightDigest,
    };
    await expect(readReceipt(forged, result.receipt)).rejects.toThrow(
      /Supplied PREFLIGHT is not canonical/u,
    );
  });

  it("rejects a self-consistent copied tree without the caller trusted binding", async () => {
    const result = await merge();
    const body = preflightShardMergeReceiptBody(result.receipt);
    const first = body.shards[0];
    const second = body.shards[1];
    if (first === undefined || second === undefined)
      throw new Error("merge receipt requires two shards");
    const copiedRoot = path.join(
      tmpdir(),
      `preflight-shard-merge-copied-${process.pid}`,
    );
    const copiedBase = path.join(
      copiedRoot,
      "shards",
      first.logicalShardId,
      "attempts",
      first.shardAttemptId,
    );
    const copiedReceipt = receiptWithBody({
      ...body,
      shards: [
        {
          ...first,
          donorRoot: copiedRoot,
          resourceProofPath: path.join(
            copiedBase,
            "PREFLIGHT_SHARD_RESOURCE_PROOF.json",
          ),
          completionPath: path.join(copiedBase, "SHARD_COMPLETE.json"),
          journalPath: path.join(copiedBase, "PREFLIGHT_SHARD.journal.jsonl"),
        },
        second,
      ],
    });
    await expect(readReceipt(result.preflight, copiedReceipt)).rejects.toThrow(
      /trusted canonical archive binding/u,
    );
  });

  it("rejects evidence drift between two complete reader snapshots", async () => {
    const result = await merge();
    const first = fixture.requests[0];
    if (first === undefined)
      throw new Error("merge fixture has no first shard");
    const reads = { value: 0 };
    const original = completionIo.readPreflightShardCompletion;
    const spy = vi
      .spyOn(completionIo, "readPreflightShardCompletion")
      .mockImplementation(async (input) => {
        const value = await original(input);
        reads.value += 1;
        if (reads.value === 2) await appendFile(first.journalPath, " ", "utf8");
        return value;
      });
    try {
      await expect(
        readReceipt(result.preflight, result.receipt),
      ).rejects.toThrow(/journal|evidence drifted/u);
      expect(reads.value).toBeGreaterThanOrEqual(2);
    } finally {
      spy.mockRestore();
    }
  });
});
