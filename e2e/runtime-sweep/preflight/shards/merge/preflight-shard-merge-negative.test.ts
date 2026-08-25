import { appendFile, readFile, rm } from "node:fs/promises";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { sha256Hex } from "../../../support/ids.ts";
import * as completionIo from "../completion/preflight-shard-completion-io.ts";
import {
  readPreflightShardResourceProof,
  writePreflightShardResourceProof,
} from "../resources/preflight-shard-resource-proof-io.ts";
import { resourceProofBodyFor } from "../resources/preflight-shard-resource-proof-validation.ts";
import {
  mergePreflightShards,
  type PreflightShardCompletionReadRequest,
} from "./preflight-shard-merge.ts";
import {
  assertPreflightShardMergeReceiptMatchesSource,
  preflightShardMergeReceiptBody,
} from "./preflight-shard-merge-contract.ts";
import {
  createPersistedMergeFixture,
  type PersistedMergeFixture,
} from "./preflight-shard-merge-test-support.ts";

describe("canonical preflight shard merge causal negatives", () => {
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

  const receiptWithBody = (
    body: ReturnType<typeof preflightShardMergeReceiptBody>,
  ) => ({
    ...body,
    receiptDigest: sha256Hex(body),
  });

  it("rejects same-donor resource collisions before completion reads", async () => {
    const first = fixture.requests[0];
    const second = fixture.requests[1];
    if (first === undefined || second === undefined)
      throw new Error("merge fixture requires two shard requests");
    const originalProofText = await readFile(second.resourceProofPath, "utf8");
    const secondProof = await readPreflightShardResourceProof(
      second.resourceProofPath,
      second.archiveRoot,
    );
    const firstProof = await readPreflightShardResourceProof(
      first.resourceProofPath,
      first.archiveRoot,
    );
    const body = {
      ...resourceProofBodyFor(secondProof),
      resources: {
        ...secondProof.resources,
        database: {
          ...secondProof.resources.database,
          name: firstProof.resources.database.name,
          identity: {
            ...secondProof.resources.database.identity,
            database: firstProof.resources.database.name,
          },
        },
      },
    } as const;
    const collisionProof = { ...body, proofDigest: sha256Hex(body) };
    await rm(second.resourceProofPath);
    await writePreflightShardResourceProof({
      archiveRoot: second.archiveRoot,
      filePath: second.resourceProofPath,
      proof: collisionProof,
    });
    try {
      const collisionRequest: PreflightShardCompletionReadRequest = {
        ...second,
        context: { ...second.context, resourceProof: collisionProof },
      };
      await expect(merge([first, collisionRequest])).rejects.toThrow(
        /Donor-local.*collide/u,
      );
    } finally {
      await rm(second.resourceProofPath);
      await writePreflightShardResourceProof({
        archiveRoot: second.archiveRoot,
        filePath: second.resourceProofPath,
        proof: second.context.resourceProof,
      });
      if ((await readFile(second.resourceProofPath, "utf8")) === "")
        throw new Error("resource proof restore failed");
      if (originalProofText.length === 0)
        throw new Error("resource proof fixture unexpectedly empty");
    }
  });

  it("rejects duplicate receipt identities and state-union drift", async () => {
    const result = await merge();
    const body = preflightShardMergeReceiptBody(result.receipt);
    const firstShard = body.shards[0];
    const secondShard = body.shards[1];
    if (firstShard === undefined || secondShard === undefined)
      throw new Error("merge receipt requires two shards");
    const duplicateIdentity = receiptWithBody({
      ...body,
      shards: [
        firstShard,
        { ...secondShard, resourceProofDigest: firstShard.resourceProofDigest },
      ],
    });
    expect(() =>
      assertPreflightShardMergeReceiptMatchesSource({
        source: fixture.source,
        assignment: fixture.assignment,
        donorRoots: fixture.donorRoots,
        preflight: result.preflight,
        receipt: duplicateIdentity,
      }),
    ).toThrow(/duplicate resource proof identity/u);

    const duplicatedStateIds = receiptWithBody({
      ...body,
      shards: [
        {
          ...firstShard,
          assignedStateIds: [
            firstShard.assignedStateIds[0] ?? "missing",
            firstShard.assignedStateIds[0] ?? "missing",
          ],
          assignedStateDigests: [
            firstShard.assignedStateDigests[0] ?? "0".repeat(64),
            firstShard.assignedStateDigests[0] ?? "0".repeat(64),
          ],
        },
        secondShard,
      ],
    });
    expect(() =>
      assertPreflightShardMergeReceiptMatchesSource({
        source: fixture.source,
        assignment: fixture.assignment,
        donorRoots: fixture.donorRoots,
        preflight: result.preflight,
        receipt: duplicatedStateIds,
      }),
    ).toThrow(/state union does not match shard/u);

    const incompleteStateUnion = receiptWithBody({
      ...body,
      shards: [
        {
          ...firstShard,
          assignedStateIds: [firstShard.assignedStateIds[0] ?? "missing"],
          assignedStateDigests: [
            firstShard.assignedStateDigests[0] ?? "0".repeat(64),
          ],
        },
        secondShard,
      ],
    });
    expect(() =>
      assertPreflightShardMergeReceiptMatchesSource({
        source: fixture.source,
        assignment: fixture.assignment,
        donorRoots: fixture.donorRoots,
        preflight: result.preflight,
        receipt: incompleteStateUnion,
      }),
    ).toThrow(/state union does not match shard/u);
  });

  it("rejects preexisting specialized payload before central attachment", async () => {
    const poisoned = await createPersistedMergeFixture({
      preexistingSpecialized: true,
    });
    try {
      await expect(
        mergePreflightShards({
          source: poisoned.source,
          assignment: poisoned.assignment,
          donorRoots: poisoned.donorRoots,
          completionRequests: poisoned.requests,
        }),
      ).rejects.toThrow(/preexisting specialized entries/u);
    } finally {
      await poisoned.dispose();
    }
  });

  it("rejects durable drift introduced between collection passes", async () => {
    const first = fixture.requests[0];
    if (first === undefined)
      throw new Error("merge fixture has no first shard");
    const completionReads = { value: 0 };
    const originalRead = completionIo.readPreflightShardCompletion;
    const spy = vi
      .spyOn(completionIo, "readPreflightShardCompletion")
      .mockImplementation(async (input) => {
        const result = await originalRead(input);
        completionReads.value += 1;
        if (completionReads.value === 2)
          await appendFile(first.journalPath, " ");
        return result;
      });
    try {
      await expect(merge()).rejects.toThrow(
        /Durable completion read failed|evidence drifted/u,
      );
      expect(completionReads.value).toBeGreaterThanOrEqual(2);
    } finally {
      spy.mockRestore();
    }
  });
});
