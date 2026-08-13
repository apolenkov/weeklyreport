import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { createPreflightShardAssignment } from "../preflight-shard-assignment.ts";
import { withSource } from "../preflight-shard-assignment-test-support.ts";
import { createPreflightShardResourceProof } from "./preflight-shard-resource-proof-planner.ts";
import { validatePreflightShardResourceProofSet } from "./preflight-shard-resource-proof-set-validation.ts";
import {
  attemptFor,
  withProofDigest,
} from "./preflight-shard-resource-proof-test-support.ts";

const TEST_ROOT = path.join(
  process.cwd(),
  ".runtime-shard-resource-proof-fixture",
);
const PRO_ROOT = path.join(TEST_ROOT, "donor-pro");

const proofFor = (
  source: Parameters<typeof attemptFor>[0],
  assignment: Parameters<typeof attemptFor>[1],
  shardIndex: number,
  donorRoot: string,
  attemptId: string,
  resourceIndex: number,
  runId: string,
) =>
  createPreflightShardResourceProof({
    ...attemptFor(
      source,
      assignment,
      shardIndex,
      "Pro",
      donorRoot,
      attemptId,
      resourceIndex,
    ),
    resources: {
      ...attemptFor(
        source,
        assignment,
        shardIndex,
        "Pro",
        donorRoot,
        attemptId,
        resourceIndex,
      ).resources,
      redis: {
        ...attemptFor(
          source,
          assignment,
          shardIndex,
          "Pro",
          donorRoot,
          attemptId,
          resourceIndex,
        ).resources.redis,
        runId,
      },
    },
  });

describe("preflight shard resource-proof path identity", () => {
  it.each(["case variant", "unicode normalization alias"])(
    "rejects %s donor roots conservatively",
    async (kind) => {
      await withSource((source) => {
        const assignment = createPreflightShardAssignment(source, 4);
        const unicodeNfdRoot = path.join(TEST_ROOT, "donor-pro-e\u0301");
        const unicodeNfcRoot = path.join(TEST_ROOT, "donor-pro-é");
        const firstRoot = kind === "case variant" ? PRO_ROOT : unicodeNfdRoot;
        const alias =
          kind === "case variant" ? PRO_ROOT.toUpperCase() : unicodeNfcRoot;
        const first = proofFor(
          source,
          assignment,
          0,
          firstRoot,
          "attempt-1",
          0,
          "run-one",
        );
        const second = withProofDigest(first, (body) => ({
          ...body,
          donorRoot: alias,
        }));
        expect(() =>
          validatePreflightShardResourceProofSet([first, second], {
            donorRoots: [
              { donorId: "Pro", root: firstRoot },
              { donorId: "Air", root: alias },
            ],
          }),
        ).toThrow();
      });
    },
  );

  it("rejects case-variant intra- and cross-proof paths", async () => {
    await withSource((source) => {
      const assignment = createPreflightShardAssignment(source, 4);
      const first = proofFor(
        source,
        assignment,
        0,
        PRO_ROOT,
        "attempt-1",
        0,
        "run-one",
      );
      const intra = withProofDigest(first, (body) => ({
        ...body,
        resources: {
          ...body.resources,
          logDir: body.resources.nextDistDir.toUpperCase(),
        },
      }));
      expect(() =>
        validatePreflightShardResourceProofSet([intra], {
          donorRoots: [{ donorId: "Pro", root: PRO_ROOT }],
        }),
      ).toThrow();
      const second = proofFor(
        source,
        assignment,
        1,
        PRO_ROOT,
        "attempt-2",
        1,
        "run-two",
      );
      const cross = withProofDigest(second, (body) => ({
        ...body,
        resources: {
          ...body.resources,
          outputDir: first.resources.outputDir.toUpperCase(),
        },
      }));
      expect(() =>
        validatePreflightShardResourceProofSet([first, cross], {
          donorRoots: [{ donorId: "Pro", root: PRO_ROOT }],
        }),
      ).toThrow();
    });
  });
});
