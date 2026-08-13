import { readFile, rename, symlink, writeFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { sha256Hex, stableSerialize } from "../../../support/ids.ts";
import { preflightShardCompletionBody } from "./preflight-shard-completion-contract.ts";
import {
  readPreflightShardCompletion,
  writePreflightShardCompletion,
} from "./preflight-shard-completion-io.ts";
import { withPersistedCompletionFixture } from "./preflight-shard-completion-io-test-support.ts";

describe("preflight shard completion I/O", () => {
  it("writes once and revalidates every durable shard input on read", async () => {
    await withPersistedCompletionFixture(async (fixture) => {
      const completion = await writePreflightShardCompletion({
        context: fixture.context,
        archiveRoot: fixture.archiveRoot,
        filePath: fixture.completionPath,
        journalPath: fixture.journalPath,
      });
      const revalidated = await readPreflightShardCompletion({
        context: fixture.context,
        archiveRoot: fixture.archiveRoot,
        filePath: fixture.completionPath,
        journalPath: fixture.journalPath,
      });
      expect(revalidated.completion).toEqual(completion);
      expect(revalidated.resume.authorizedSkipStateIds).toEqual(
        fixture.context.shard.states.map(({ state }) => state.stateId),
      );
      expect(revalidated.resume.terminalPasses.size).toBe(
        fixture.context.shard.states.length,
      );
      await expect(
        writePreflightShardCompletion({
          context: fixture.context,
          archiveRoot: fixture.archiveRoot,
          filePath: fixture.completionPath,
          journalPath: fixture.journalPath,
        }),
      ).rejects.toThrow(/Cannot create immutable/u);
    });
  });

  it("rejects foreign roots and completion or journal paths", async () => {
    await withPersistedCompletionFixture(async (fixture) => {
      const valid = {
        context: fixture.context,
        archiveRoot: fixture.archiveRoot,
        filePath: fixture.completionPath,
        journalPath: fixture.journalPath,
      };
      await expect(
        writePreflightShardCompletion({
          ...valid,
          archiveRoot: `${fixture.archiveRoot}.foreign`,
        }),
      ).rejects.toThrow(/archive root/u);
      await expect(
        writePreflightShardCompletion({
          ...valid,
          filePath: `${fixture.completionPath}.foreign`,
        }),
      ).rejects.toThrow(/SHARD_COMPLETE path/u);
      await expect(
        writePreflightShardCompletion({
          ...valid,
          journalPath: `${fixture.journalPath}.foreign`,
        }),
      ).rejects.toThrow(/journal path/u);
    });
  });

  it("rejects stale self-consistent completion and durable input drift", async () => {
    await withPersistedCompletionFixture(async (fixture) => {
      const completion = await writePreflightShardCompletion({
        context: fixture.context,
        archiveRoot: fixture.archiveRoot,
        filePath: fixture.completionPath,
        journalPath: fixture.journalPath,
      });
      const body = {
        ...preflightShardCompletionBody(completion),
        journalRecordCount: completion.journalRecordCount + 1,
      };
      const stale = { ...body, completionDigest: sha256Hex(body) };
      await writeFile(
        fixture.completionPath,
        `${stableSerialize(stale)}\n`,
        "utf8",
      );
      await expect(
        readPreflightShardCompletion({
          context: fixture.context,
          archiveRoot: fixture.archiveRoot,
          filePath: fixture.completionPath,
          journalPath: fixture.journalPath,
        }),
      ).rejects.toThrow(/stale|revalidated/u);

      await writeFile(fixture.journalPath, '{"truncated":true}', "utf8");
      await expect(
        readPreflightShardCompletion({
          context: fixture.context,
          archiveRoot: fixture.archiveRoot,
          filePath: fixture.completionPath,
          journalPath: fixture.journalPath,
        }),
      ).rejects.toThrow(/truncated/u);
    });
  });

  it("rejects non-canonical and symlinked completion bytes", async () => {
    await withPersistedCompletionFixture(async (fixture) => {
      await writePreflightShardCompletion({
        context: fixture.context,
        archiveRoot: fixture.archiveRoot,
        filePath: fixture.completionPath,
        journalPath: fixture.journalPath,
      });
      const canonical = await readFile(fixture.completionPath, "utf8");
      await writeFile(fixture.completionPath, ` ${canonical}`, "utf8");
      await expect(
        readPreflightShardCompletion({
          context: fixture.context,
          archiveRoot: fixture.archiveRoot,
          filePath: fixture.completionPath,
          journalPath: fixture.journalPath,
        }),
      ).rejects.toThrow(/bytes are not canonical/u);

      const retainedPath = `${fixture.completionPath}.retained`;
      await rename(fixture.completionPath, retainedPath);
      await symlink(retainedPath, fixture.completionPath);
      await expect(
        readPreflightShardCompletion({
          context: fixture.context,
          archiveRoot: fixture.archiveRoot,
          filePath: fixture.completionPath,
          journalPath: fixture.journalPath,
        }),
      ).rejects.toThrow(/symlink/u);
    });
  });

  it("re-reads receipt and segment evidence instead of trusting completion", async () => {
    await withPersistedCompletionFixture(async (fixture) => {
      const completion = await writePreflightShardCompletion({
        context: fixture.context,
        archiveRoot: fixture.archiveRoot,
        filePath: fixture.completionPath,
        journalPath: fixture.journalPath,
      });
      const first = completion.stateEvidence[0];
      if (first === undefined) throw new Error("completion evidence missing");
      const receiptBytes = await readFile(first.receiptPath, "utf8");
      await writeFile(first.receiptPath, ` ${receiptBytes}`, "utf8");
      await expect(
        readPreflightShardCompletion({
          context: fixture.context,
          archiveRoot: fixture.archiveRoot,
          filePath: fixture.completionPath,
          journalPath: fixture.journalPath,
        }),
      ).rejects.toThrow(/bytes are not canonical/u);

      await writeFile(first.receiptPath, receiptBytes, "utf8");
      const segmentBytes = await readFile(first.segmentArtifactPath, "utf8");
      await writeFile(first.segmentArtifactPath, ` ${segmentBytes}`, "utf8");
      await expect(
        readPreflightShardCompletion({
          context: fixture.context,
          archiveRoot: fixture.archiveRoot,
          filePath: fixture.completionPath,
          journalPath: fixture.journalPath,
        }),
      ).rejects.toThrow(/bytes are not canonical/u);
    });
  });
});
