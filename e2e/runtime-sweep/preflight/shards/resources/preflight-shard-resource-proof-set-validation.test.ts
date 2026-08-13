import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { createPreflightShardAssignment } from "../preflight-shard-assignment.ts";
import { withSource } from "../preflight-shard-assignment-test-support.ts";
import {
  createPreflightShardResourceProof,
  planPreflightShardResourceProofs,
} from "./preflight-shard-resource-proof-planner.ts";
import { validatePreflightShardResourceProofSet } from "./preflight-shard-resource-proof-set-validation.ts";
import {
  attemptFor,
  withProofDigest,
} from "./preflight-shard-resource-proof-test-support.ts";

const RESOURCE_PROOF_TEST_ROOT = path.join(
  process.cwd(),
  ".runtime-shard-resource-proof-fixture",
);
const PRO_ROOT = path.join(RESOURCE_PROOF_TEST_ROOT, "donor-pro");
const AIR_ROOT = path.join(RESOURCE_PROOF_TEST_ROOT, "donor-air");
const OUTSIDE_ROOT = path.join(
  process.cwd(),
  ".runtime-shard-resource-proof-outside",
);

const proofFor = (
  source: Parameters<typeof attemptFor>[0],
  assignment: Parameters<typeof attemptFor>[1],
  shardIndex: number,
  donorId: string,
  donorRoot: string,
  attemptId: string,
  resourceIndex: number,
  runId = `${donorId.toLowerCase()}-run-${resourceIndex + 1}`,
) => {
  const input = attemptFor(
    source,
    assignment,
    shardIndex,
    donorId,
    donorRoot,
    attemptId,
    resourceIndex,
  );
  return createPreflightShardResourceProof({
    ...input,
    resources: {
      ...input.resources,
      redis: { ...input.resources.redis, runId },
    },
  });
};

describe("preflight shard resource-proof planning", () => {
  it("is deterministic and accepts equal donors with isolated roots", async () => {
    await withSource((source) => {
      const shardAssignment = createPreflightShardAssignment(source, 4);
      const attempts = [
        attemptFor(source, shardAssignment, 0, "Pro", PRO_ROOT, "attempt-1", 0),
        attemptFor(source, shardAssignment, 0, "Air", AIR_ROOT, "attempt-1", 0),
      ].map((attempt, index) => ({
        ...attempt,
        resources: {
          ...attempt.resources,
          redis: {
            ...attempt.resources.redis,
            runId: `donor-run-${index + 1}`,
          },
        },
      }));
      const first = planPreflightShardResourceProofs({
        source,
        assignment: shardAssignment,
        attempts,
        donorRoots: [
          { donorId: "Pro", root: PRO_ROOT },
          { donorId: "Air", root: AIR_ROOT },
        ],
      });
      const second = planPreflightShardResourceProofs({
        source,
        assignment: shardAssignment,
        attempts,
        donorRoots: [
          { donorId: "Pro", root: PRO_ROOT },
          { donorId: "Air", root: AIR_ROOT },
        ],
      });
      expect(second).toEqual(first);
      expect(first[0]?.resources.api.port).toBe(first[1]?.resources.api.port);
      expect(first[0]?.resources.database.name).toBe(
        first[1]?.resources.database.name,
      );
    });
  });

  it.each([
    "database",
    "redis endpoint",
    "runId",
    "api port",
    "web port",
    "cross-kind port",
    "queue prefix",
  ])("rejects duplicate %s resources", async (kind) => {
    await withSource((source) => {
      const assignment = createPreflightShardAssignment(source, 4);
      const first = proofFor(
        source,
        assignment,
        0,
        "Pro",
        PRO_ROOT,
        "attempt-1",
        0,
        "run-one",
      );
      const secondBase = proofFor(
        source,
        assignment,
        1,
        "Pro",
        PRO_ROOT,
        "attempt-2",
        1,
        "run-two",
      );
      const second = withProofDigest(secondBase, (body) => ({
        ...body,
        resources: {
          ...body.resources,
          ...(kind === "database"
            ? { database: first.resources.database }
            : kind === "redis endpoint"
              ? {
                  redis: {
                    ...body.resources.redis,
                    port: first.resources.redis.port,
                  },
                }
              : kind === "runId"
                ? {
                    redis: {
                      ...body.resources.redis,
                      runId: first.resources.redis.runId,
                    },
                  }
                : kind === "api port"
                  ? {
                      api: {
                        ...body.resources.api,
                        port: first.resources.api.port,
                      },
                    }
                  : kind === "web port"
                    ? {
                        web: {
                          ...body.resources.web,
                          port: first.resources.web.port,
                        },
                      }
                    : kind === "cross-kind port"
                      ? {
                          web: {
                            ...body.resources.web,
                            port: first.resources.api.port,
                          },
                        }
                      : { queuePrefix: first.resources.queuePrefix }),
        },
      }));
      expect(() =>
        validatePreflightShardResourceProofSet([first, second], {
          source,
          assignment,
          donorRoots: [{ donorId: "Pro", root: PRO_ROOT }],
        }),
      ).toThrow();
    });
  });

  it("rejects duplicate donor/shard/attempt identity", async () => {
    await withSource((source) => {
      const assignment = createPreflightShardAssignment(source, 4);
      const first = proofFor(
        source,
        assignment,
        0,
        "Pro",
        PRO_ROOT,
        "attempt-1",
        0,
        "run-one",
      );
      const second = proofFor(
        source,
        assignment,
        1,
        "Pro",
        PRO_ROOT,
        "attempt-1",
        1,
        "run-two",
      );
      expect(() =>
        validatePreflightShardResourceProofSet([first, second], {
          source,
          assignment,
          donorRoots: [{ donorId: "Pro", root: PRO_ROOT }],
        }),
      ).not.toThrow();
      const duplicate = withProofDigest(second, (body) => ({
        ...body,
        logicalShardId: first.logicalShardId,
        shardIndex: first.shardIndex,
        shardDigest: first.shardDigest,
      }));
      expect(() =>
        validatePreflightShardResourceProofSet([first, duplicate], {
          source,
          assignment,
          donorRoots: [{ donorId: "Pro", root: PRO_ROOT }],
        }),
      ).toThrow();
    });
  });

  it.each(["same path", "ancestor path", "traversal", "outside donor root"])(
    "rejects %s filesystem resource paths",
    async (kind) => {
      await withSource((source) => {
        const assignment = createPreflightShardAssignment(source, 4);
        const first = proofFor(
          source,
          assignment,
          0,
          "Pro",
          PRO_ROOT,
          "attempt-1",
          0,
          "run-one",
        );
        const malformed = withProofDigest(first, (body) => ({
          ...body,
          resources: {
            ...body.resources,
            ...(kind === "same path"
              ? { logDir: body.resources.nextDistDir }
              : kind === "ancestor path"
                ? { logDir: `${body.resources.nextDistDir}/nested` }
                : kind === "traversal"
                  ? { logDir: `${PRO_ROOT}${path.sep}..${path.sep}escape` }
                  : { logDir: path.join(OUTSIDE_ROOT, "logs") }),
          },
        }));
        expect(() =>
          validatePreflightShardResourceProofSet([malformed], {
            source,
            assignment,
            donorRoots: [{ donorId: "Pro", root: PRO_ROOT }],
          }),
        ).toThrow();
      });
    },
  );

  it("rejects a wrong donor root even when paths are otherwise valid", async () => {
    await withSource((source) => {
      const assignment = createPreflightShardAssignment(source, 4);
      const proof = proofFor(
        source,
        assignment,
        0,
        "Pro",
        PRO_ROOT,
        "attempt-1",
        0,
        "run-one",
      );
      expect(() =>
        validatePreflightShardResourceProofSet([proof], {
          source,
          assignment,
          donorRoots: [{ donorId: "Air", root: AIR_ROOT }],
        }),
      ).toThrow(/donor root/iu);
    });
  });
});
