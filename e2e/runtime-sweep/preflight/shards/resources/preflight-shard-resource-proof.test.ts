import { describe, expect, it } from "vitest";

import { createPreflightShardResourceProof } from "./preflight-shard-resource-proof-planner.ts";
import {
  withProofDigest,
  withResourceProofFixture,
} from "./preflight-shard-resource-proof-test-support.ts";
import {
  assertPreflightShardResourceProofMatchesSource,
  parsePreflightShardResourceProof,
} from "./preflight-shard-resource-proof-validation.ts";

describe("PREFLIGHT_SHARD_RESOURCE_PROOF contract", () => {
  it("creates deterministic source/shard-bound declarations", async () => {
    await withResourceProofFixture(({ source, assignment, proof, shard }) => {
      const recreated = createPreflightShardResourceProof({
        source,
        assignment,
        shard,
        donorId: proof.donorId,
        donorRoot: proof.donorRoot,
        shardAttemptId: proof.shardAttemptId,
        browser: proof.browser,
        runtime: proof.runtime,
        resources: proof.resources,
      });
      expect(recreated).toEqual(proof);
      expect(() =>
        assertPreflightShardResourceProofMatchesSource({
          source,
          assignment,
          proof,
          selectedShard: shard,
        }),
      ).not.toThrow();
      expect(proof.capabilities.destructiveOperationsAllowed).toBe(false);
      expect(proof.collisionScope).toBe("donor-local");
    });
  });

  it.each([
    "sourceSha",
    "sourceTree",
    "treeDigest",
    "sourceDigest",
    "planDigest",
    "assignmentDigest",
    "logicalShardId",
    "shardDigest",
  ])("rejects stale %s identity", async (field) => {
    await withResourceProofFixture(({ source, assignment, proof }) => {
      const stale = withProofDigest(proof, (body) => ({
        ...body,
        [field]: field.endsWith("Digest")
          ? "f".repeat(64)
          : field === "sourceSha" || field === "sourceTree"
            ? "f".repeat(40)
            : field === "logicalShardId"
              ? "stale-shard"
              : "stale-value",
      }));
      expect(() =>
        assertPreflightShardResourceProofMatchesSource({
          source,
          assignment,
          proof: stale,
        }),
      ).toThrow(/does not match|unknown shard/iu);
    });
  });

  it("rejects digest tampering before identity matching", async () => {
    await withResourceProofFixture(({ proof }) => {
      expect(() =>
        parsePreflightShardResourceProof({ ...proof, donorId: "Air" }),
      ).toThrow(/digest does not match/iu);
    });
  });

  it.each([
    ["database", "customreport_e2e_lane_p_test"],
    ["redis URL", "redis://127.0.0.1:6381"],
    ["queue URL", "redis://queue"],
  ])("rejects forbidden or secret-bearing %s values", async (_label, value) => {
    await withResourceProofFixture(({ proof }) => {
      const candidate = withProofDigest(proof, (body) => ({
        ...body,
        resources: {
          ...body.resources,
          ...(value.startsWith("customreport")
            ? {
                database: {
                  name: value,
                  identity: {
                    ...body.resources.database.identity,
                    database: value,
                  },
                },
              }
            : value.startsWith("redis:")
              ? { redis: { ...body.resources.redis, runId: value } }
              : { queuePrefix: value }),
        },
      }));
      expect(() => parsePreflightShardResourceProof(candidate)).toThrow();
    });
  });

  it("rejects unexpected fields, wrong viewport, and missing capabilities", async () => {
    await withResourceProofFixture(({ proof }) => {
      expect(() =>
        parsePreflightShardResourceProof({ ...proof, password: "x" }),
      ).toThrow();
      const wrongViewport = withProofDigest(proof, (body) => ({
        ...body,
        browser: {
          ...body.browser,
          viewport: {
            browser: "chromium",
            width: 1280 as unknown as 1440,
            height: 900,
          },
        },
      }));
      expect(() => parsePreflightShardResourceProof(wrongViewport)).toThrow();
      const wrongCapability = withProofDigest(proof, (body) => ({
        ...body,
        capabilities: {
          ...body.capabilities,
          destructiveOperationsAllowed: true as unknown as false,
        },
      }));
      expect(() => parsePreflightShardResourceProof(wrongCapability)).toThrow();
    });
  });
});
