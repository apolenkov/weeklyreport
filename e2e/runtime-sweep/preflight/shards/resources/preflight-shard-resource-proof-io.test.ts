import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { createPreflightShardAssignment } from "../preflight-shard-assignment.ts";
import { withSource } from "../preflight-shard-assignment-test-support.ts";
import {
  readPreflightShardResourceProof,
  serializePreflightShardResourceProof,
  writePreflightShardResourceProof,
} from "./preflight-shard-resource-proof-io.ts";
import { createPreflightShardResourceProof } from "./preflight-shard-resource-proof-planner.ts";
import {
  defaultBrowser,
  defaultRuntime,
  resourcesFor,
  withProofDigest,
} from "./preflight-shard-resource-proof-test-support.ts";

describe("preflight shard resource-proof immutable I/O", () => {
  it("writes canonical bytes once and rejects overwrite or escape", async () => {
    const root = await realpath(
      await mkdtemp(path.join(os.tmpdir(), "r138-proof-")),
    );
    try {
      const donorRoot = path.join(root, "donor");
      await mkdir(donorRoot);
      await withSource(async (source) => {
        const assignment = createPreflightShardAssignment(source, 4);
        const shard = assignment.shards[0];
        if (shard === undefined) throw new Error("fixture has no shard");
        const proof = createPreflightShardResourceProof({
          source,
          assignment,
          shard,
          donorId: "Pro",
          donorRoot,
          shardAttemptId: "attempt-1",
          browser: defaultBrowser,
          runtime: defaultRuntime,
          resources: resourcesFor(path.join(donorRoot, "resources"), 0),
        });
        const archiveRoot = proof.resources.archiveRoot;
        const filePath = path.join(archiveRoot, "RESOURCE-PROOF.json");
        await writePreflightShardResourceProof({
          archiveRoot,
          filePath,
          proof,
        });
        await expect(
          readPreflightShardResourceProof(filePath, archiveRoot),
        ).resolves.toEqual(proof);
        const foreignRoot = path.join(root, "foreign");
        await mkdir(foreignRoot, { recursive: true });
        const foreignFile = path.join(foreignRoot, "RESOURCE-PROOF.json");
        await writeFile(
          foreignFile,
          serializePreflightShardResourceProof(proof),
        );
        await expect(
          readPreflightShardResourceProof(foreignFile, foreignRoot),
        ).rejects.toThrow(/does not match.*read root/iu);
        await expect(
          // @ts-expect-error archiveRoot is mandatory for confinement.
          readPreflightShardResourceProof(filePath),
        ).rejects.toThrow();
        await expect(
          writePreflightShardResourceProof({ archiveRoot, filePath, proof }),
        ).rejects.toThrow(/Cannot create immutable/iu);
        await expect(
          writePreflightShardResourceProof({
            archiveRoot,
            filePath: path.join(root, "outside", "proof.json"),
            proof,
          }),
        ).rejects.toThrow(/escaped archive root|write root/iu);
        expect(await readFile(filePath, "utf8")).toBe(
          serializePreflightShardResourceProof(proof),
        );
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects non-canonical, symlink, and donor-root escape reads", async () => {
    const root = await realpath(
      await mkdtemp(path.join(os.tmpdir(), "r138-proof-")),
    );
    try {
      const donorRoot = path.join(root, "donor");
      await mkdir(donorRoot);
      await withSource(async (source) => {
        const assignment = createPreflightShardAssignment(source, 4);
        const shard = assignment.shards[0];
        if (shard === undefined) throw new Error("fixture has no shard");
        const proof = createPreflightShardResourceProof({
          source,
          assignment,
          shard,
          donorId: "Pro",
          donorRoot,
          shardAttemptId: "attempt-1",
          browser: defaultBrowser,
          runtime: defaultRuntime,
          resources: resourcesFor(path.join(donorRoot, "resources"), 0),
        });
        const archiveRoot = proof.resources.archiveRoot;
        await mkdir(archiveRoot, { recursive: true });
        const canonicalPath = path.join(archiveRoot, "canonical.json");
        await writeFile(canonicalPath, JSON.stringify(proof, null, 2));
        await expect(
          readPreflightShardResourceProof(canonicalPath, archiveRoot),
        ).rejects.toThrow(/canonical/iu);
        const symlinkPath = path.join(archiveRoot, "symlink.json");
        await symlink(canonicalPath, symlinkPath);
        await expect(
          readPreflightShardResourceProof(symlinkPath, archiveRoot),
        ).rejects.toThrow(/symlink/iu);
        const escaped = withProofDigest(proof, (body) => ({
          ...body,
          donorRoot: path.join(root, "other"),
        }));
        await expect(
          writePreflightShardResourceProof({
            archiveRoot,
            filePath: path.join(archiveRoot, "escaped.json"),
            proof: escaped,
          }),
        ).rejects.toThrow(/Donor root|write root/iu);
        const symlinkStat = await lstat(symlinkPath);
        expect(symlinkStat.isSymbolicLink()).toBe(true);
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
