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
  runIdentityFor,
  strictRouteFor,
} from "../contracts/preflight-reveal-continuation-contract-factories.ts";
import {
  readBoundedBytes,
  readBoundedRegularFile,
} from "../io/preflight-reveal-continuation-bounded-file.ts";
import {
  createParentPass,
  parseRevealParentPass,
} from "../preflight-reveal-continuation-artifacts.ts";
import { MAX_ASSET_BYTES } from "../preflight-reveal-continuation-assets.ts";
import {
  controlFor,
  inventoryFor,
  runChunk,
  selectionFor,
  withSource,
} from "../preflight-reveal-continuation-fixture.ts";
import {
  assertRevealContinuationOutputAbsent,
  readRevealContinuationArtifact,
  writeRevealReceiptChunk,
} from "../preflight-reveal-continuation-io.ts";

describe("R188 v3 continuation boundaries and immutable IO", () => {
  it("physically caps reads even when an opened file grows after stat", async () => {
    const requestedLengths: number[] = [];
    const growingHandle = {
      read: (
        buffer: Buffer,
        offset: number,
        length: number,
        _position: null,
      ) => {
        requestedLengths.push(length);
        buffer.fill(0x61, offset, offset + length);
        return Promise.resolve({ bytesRead: length, buffer });
      },
    };

    await expect(
      readBoundedBytes({
        handle: growingHandle,
        maxBytes: 4,
        sizeError: "bounded read overflow",
      }),
    ).rejects.toThrow("bounded read overflow");
    expect(requestedLengths).toEqual([5]);
  });

  it("opens untrusted artifacts without following a leaf symlink", async () => {
    const root = await mkdtemp(path.join(await realpath(tmpdir()), "r188-io-"));
    try {
      const targetPath = path.join(root, "target.json");
      const linkPath = path.join(root, "child.json");
      await writeFile(targetPath, "{}\n", "utf8");
      await symlink(targetPath, linkPath);
      await expect(
        readBoundedRegularFile({
          filePath: linkPath,
          maxBytes: MAX_ASSET_BYTES,
          regularFileError: "regular non-symlink required",
          sizeError: "byte bound exceeded",
        }),
      ).rejects.toThrow("regular non-symlink required");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("creates a parent PASS with a canonical parseable digest", async () => {
    await withSource((source) => {
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("Fixture has no source state");
      const { route } = selectionFor(source, state.stateId);
      const pass = createParentPass({
        run: runIdentityFor({
          source,
          state,
          route: strictRouteFor(route),
          executionScope: "canary",
          attemptId: "attempt-fixture",
        }),
        chain: {
          receiptHead: "1".repeat(64),
          receiptCount: 1,
          chunkHead: "2".repeat(64),
          chunkCount: 1,
        },
        reducerStateDigest: "3".repeat(64),
        controlsDigest: "4".repeat(64),
        controlsCount: 1,
        authorityKey: "a".repeat(64),
      });
      expect(parseRevealParentPass(pass)).toEqual(pass);
      return Promise.resolve();
    });
  });

  it("writes and reads canonical raw child chunks", async () => {
    await withSource(async (source) => {
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("Fixture has no source state");
      const { route } = selectionFor(source, state.stateId);
      const result = await runChunk({
        source,
        state,
        route,
        root: inventoryFor([controlFor("button:a-open:0", "Open panel", 0)]),
        nested: inventoryFor([]),
        now: () => 0,
        deadlineAt: 10_000,
      });
      const archiveRoot = await realpath(
        await mkdtemp(path.join(await realpath(tmpdir()), "r188-chunk-")),
      );
      try {
        const filePath = path.join(archiveRoot, "continuation", "child.json");
        await assertRevealContinuationOutputAbsent({ archiveRoot, filePath });
        await writeRevealReceiptChunk({
          archiveRoot,
          filePath,
          chunk: result.result.chunk,
        });
        await expect(
          assertRevealContinuationOutputAbsent({ archiveRoot, filePath }),
        ).rejects.toThrow(/already exists/iu);
        const parsed = await readRevealContinuationArtifact({
          archiveRoot,
          filePath,
        });
        expect(parsed?.kind).toBe("CHUNK");
        expect(await readFile(filePath, "utf8")).toMatch(/\n$/u);
        await writeFile(filePath, "{}\n", "utf8");
        await expect(
          readRevealContinuationArtifact({ archiveRoot, filePath }),
        ).rejects.toThrow(/unknown|artifact|invalid/iu);
        await writeFile(filePath, Buffer.alloc(MAX_ASSET_BYTES + 1));
        await expect(
          readRevealContinuationArtifact({ archiveRoot, filePath }),
        ).rejects.toThrow(/byte bound/iu);
      } finally {
        await rm(archiveRoot, { recursive: true, force: true });
      }
    });
  });

  it("fails before browser work when the child deadline is already expired", async () => {
    await withSource(async (source) => {
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("Fixture has no source state");
      const { route } = selectionFor(source, state.stateId);
      await expect(
        runChunk({
          source,
          state,
          route,
          root: inventoryFor([controlFor("button:a-open:0", "Open panel", 0)]),
          nested: inventoryFor([]),
          now: () => 2,
          deadlineAt: 1,
        }),
      ).rejects.toThrow(/deadline expired/iu);
    });
  });
});
