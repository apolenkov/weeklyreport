import {
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import {
  readOrCreatePreflightShardAssignment,
  readPreflightShardAssignment,
  serializePreflightShardAssignment,
  writePreflightShardAssignment,
} from "./preflight-shard-assignment.ts";
import { withSource } from "./preflight-shard-assignment-test-support.ts";

describe("preflight shard assignment archive I/O", () => {
  it("uses immutable canonical archive files and rejects escape, symlink, overwrite, and byte drift", async () => {
    await withSource(async (source) => {
      const root = await realpath(
        await mkdtemp(path.join(tmpdir(), "preflight-shards-")),
      );
      try {
        const filePath = path.join(root, "PREFLIGHT_SHARD_ASSIGNMENT.json");
        const assignment = await readOrCreatePreflightShardAssignment({
          archiveRoot: root,
          filePath,
          source,
          shardCount: 3,
        });
        expect(await readFile(filePath, "utf8")).toBe(
          serializePreflightShardAssignment(assignment),
        );
        await expect(
          readOrCreatePreflightShardAssignment({
            archiveRoot: root,
            filePath,
            source,
            shardCount: 3,
          }),
        ).resolves.toEqual(assignment);
        await expect(
          readOrCreatePreflightShardAssignment({
            archiveRoot: root,
            filePath,
            source,
            shardCount: 4,
          }),
        ).rejects.toThrow(/stored shard count 3.*requested shard count 4/u);
        for (const shardCount of [0, -1, 1.5]) {
          await expect(
            readOrCreatePreflightShardAssignment({
              archiveRoot: root,
              filePath,
              source,
              shardCount,
            }),
          ).rejects.toThrow(/positive integer/u);
        }
        await expect(
          writePreflightShardAssignment({
            archiveRoot: root,
            filePath,
            assignment,
          }),
        ).rejects.toThrow(/immutable|EEXIST/u);

        const symlinkPath = path.join(root, "symlink.json");
        await symlink(path.join(root, "outside.json"), symlinkPath);
        await expect(
          writePreflightShardAssignment({
            archiveRoot: root,
            filePath: symlinkPath,
            assignment,
          }),
        ).rejects.toThrow(/symlink|immutable/u);
        await expect(readPreflightShardAssignment(symlinkPath)).rejects.toThrow(
          /symlink|regular/u,
        );
        await expect(
          writePreflightShardAssignment({
            archiveRoot: root,
            filePath: path.join(root, "..", "outside-shards.json"),
            assignment,
          }),
        ).rejects.toThrow(/escaped archive root|archive path/u);

        await readFile(filePath, "utf8").then(async (text) => {
          await rm(filePath);
          await writeFile(
            filePath,
            `${JSON.stringify(JSON.parse(text), null, 2)}\n`,
            "utf8",
          );
        });
        await expect(readPreflightShardAssignment(filePath)).rejects.toThrow(
          /bytes are not canonical/u,
        );
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });
  });
});
