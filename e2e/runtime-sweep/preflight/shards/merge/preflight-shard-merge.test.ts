import { appendFile } from "node:fs/promises";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createPreflightShardAssignment } from "../preflight-shard-assignment.ts";
import {
  mergePreflightShards,
  type PreflightShardCompletionReadRequest,
} from "./preflight-shard-merge.ts";
import { PreflightShardMergeError } from "./preflight-shard-merge-contract.ts";
import { readPreflightShardMergeReceipt } from "./preflight-shard-merge-receipt-reader.ts";
import {
  createPersistedMergeFixture,
  type PersistedMergeFixture,
} from "./preflight-shard-merge-test-support.ts";

describe("canonical preflight shard merge", () => {
  let fixture: PersistedMergeFixture;

  beforeAll(async () => {
    fixture = await createPersistedMergeFixture();
  });

  afterAll(async () => {
    await fixture.dispose();
  });

  const merge = (requests = fixture.requests) =>
    mergePreflightShards({
      source: fixture.source,
      assignment: fixture.assignment,
      donorRoots: fixture.donorRoots,
      completionRequests: requests,
    });

  it("merges only durable terminal completions in source plan order", async () => {
    const result = await merge();
    expect(result.preflight.segments.map(({ state }) => state.stateId)).toEqual(
      fixture.source.plan.states.map(({ stateId }) => stateId),
    );
    expect(result.preflight.sourceSha).toBe(fixture.source.sourceSha);
    expect(result.receipt.preflightDigest).toBe(
      result.preflight.preflightDigest,
    );
    expect(
      result.receipt.shards.map(({ logicalShardId }) => logicalShardId),
    ).toEqual(
      fixture.assignment.shards.map(({ logicalShardId }) => logicalShardId),
    );
    expect(Object.isFrozen(result.preflight)).toBe(true);
    expect(Object.isFrozen(result.receipt)).toBe(true);
  });

  it("revalidates a positive receipt with distinct composite shard attempts", async () => {
    const result = await merge();
    const reread = await readPreflightShardMergeReceipt({
      source: fixture.source,
      assignment: fixture.assignment,
      donorRoots: fixture.donorRoots,
      preflight: result.preflight,
      receipt: result.receipt,
    });
    expect(reread).toEqual(result.receipt);
    expect(reread.shards.map(({ shardAttemptId }) => shardAttemptId)).toEqual([
      "attempt-1",
      "attempt-1",
    ]);
    expect(
      new Set(
        reread.shards.map(({ donorId, logicalShardId, shardAttemptId }) =>
          [donorId, logicalShardId, shardAttemptId].join("\u0000"),
        ),
      ).size,
    ).toBe(reread.shards.length);
  });

  it("attaches and validates all specialized declarations and segment coverage", async () => {
    const result = await merge();
    const expected = fixture.source.specializedDeclarations.map(
      ({ declarationId }) => declarationId,
    );
    expect(
      result.preflight.specializedDeclarations.map(
        ({ declarationId }) => declarationId,
      ),
    ).toEqual(expected);
    const applicable = new Set(
      fixture.source.specializedDeclarations
        .filter((declaration) =>
          fixture.source.routes.some(
            (route) =>
              route.role === declaration.role &&
              route.catalogRoute === declaration.catalogRoute,
          ),
        )
        .map(({ declarationId }) => declarationId),
    );
    const actual = result.preflight.segments.flatMap((segment) =>
      (segment.specialized ?? []).map(({ declarationId }) => declarationId),
    );
    expect(actual).toHaveLength(applicable.size);
    expect(new Set(actual)).toEqual(applicable);
  });

  it("rejects a missing shard before any incomplete union can merge", async () => {
    await expect(merge(fixture.requests.slice(0, -1))).rejects.toThrow(
      /one completion read request per assigned shard/u,
    );
  });

  it("rejects duplicate and reordered shard requests", async () => {
    const first = fixture.requests[0];
    if (first === undefined)
      throw new Error("merge fixture has no first shard");
    await expect(merge([first, first])).rejects.toThrow(
      /missing, extra, duplicate, or reordered/u,
    );
    await expect(merge([...fixture.requests].reverse())).rejects.toThrow(
      /missing, extra, duplicate, or reordered/u,
    );
  });

  it("rejects foreign contexts, assignments, and resource proofs", async () => {
    const first = fixture.requests[0];
    const second = fixture.requests[1];
    if (first === undefined || second === undefined)
      throw new Error("merge fixture requires two shard requests");
    const foreignAssignment = createPreflightShardAssignment(fixture.source, 1);
    const foreignShard = foreignAssignment.shards[0];
    if (foreignShard === undefined)
      throw new Error("foreign assignment has no shard");
    const foreignContextRequest: PreflightShardCompletionReadRequest = {
      ...first,
      context: {
        ...first.context,
        assignment: foreignAssignment,
        shard: foreignShard,
      },
    };
    await expect(merge([foreignContextRequest, second])).rejects.toThrow(
      /foreign PREFLIGHT_SHARD_ASSIGNMENT context/u,
    );
    const foreignProofRequest: PreflightShardCompletionReadRequest = {
      ...first,
      context: {
        ...first.context,
        resourceProof: second.context.resourceProof,
      },
    };
    await expect(merge([foreignProofRequest, second])).rejects.toThrow(
      /resource proof|selected shard|shard identity/u,
    );
  });

  it("rejects a forged durable completion path", async () => {
    const first = fixture.requests[0];
    const second = fixture.requests[1];
    if (first === undefined || second === undefined)
      throw new Error("merge fixture requires two shard requests");
    await expect(
      merge([
        { ...first, resourceProofPath: `${first.resourceProofPath}.forged` },
        second,
      ]),
    ).rejects.toThrow(/forged archive, completion, or journal path/u);
  });

  it("rejects durable journal drift instead of trusting the completion value", async () => {
    const first = fixture.requests[0];
    const second = fixture.requests[1];
    if (first === undefined || second === undefined)
      throw new Error("merge fixture requires two shard requests");
    await appendFile(first.journalPath, " ", "utf8");
    await expect(merge([first, second])).rejects.toBeInstanceOf(
      PreflightShardMergeError,
    );
  });
});
