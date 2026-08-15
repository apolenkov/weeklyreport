import { execFile } from "node:child_process";
import { access, mkdtemp, rm } from "node:fs/promises";
import * as path from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { buildCampaignSource } from "../../manifest/manifest.ts";
import { createManifestFixture } from "../../manifest/manifest-fixture.ts";
import { writeRevealContinuationAsset } from "../reveal/continuation/preflight-reveal-continuation-assets.ts";
import {
  controlFor,
  inventoryFor,
  runChunk,
  selectionFor,
  withSource,
} from "../reveal/continuation/preflight-reveal-continuation-fixture.ts";
import type { RevealReceiptChunk } from "../reveal/continuation/preflight-reveal-continuation-schemas.ts";
import { assetsForReceipt } from "../reveal/continuation/receipts/preflight-reveal-continuation-receipt-refs.ts";
import type { ParentContext } from "./preflight-reveal-continuation-parent.ts";
import { continueChild } from "./preflight-reveal-continuation-parent-results.ts";

const execFileAsync = promisify(execFile);

const zeroProgress = {
  previousGrantDigest: null,
  previousCompletedCandidateCount: 0,
  receiptHead: null,
  receiptCount: 0,
  chunkHead: null,
  chunkCount: 0,
} as const;

const persistChunkAssets = async (
  archiveRoot: string,
  chunk: RevealReceiptChunk,
): Promise<void> => {
  for (const receipt of chunk.receipts)
    for (const asset of assetsForReceipt(receipt))
      await writeRevealContinuationAsset({ archiveRoot, asset });
};

const initializeCleanFixtureRepository = async (
  repoRoot: string,
): Promise<string> => {
  for (const args of [
    ["init", "--quiet"],
    ["config", "user.name", "R188 Fixture"],
    ["config", "user.email", "r188-fixture@customreport.local"],
    ["add", "catalog.yaml", "spec.md"],
    ["commit", "--quiet", "-m", "fixture"],
  ] as const)
    await execFileAsync("git", args, { cwd: repoRoot });
  return (
    await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: repoRoot })
  ).stdout.trim();
};

describe("R188 parent genesis reduction", () => {
  it("preserves an open first chunk in the sealed continuation grant", async () => {
    await withSource(async (source) => {
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("Fixture has no source state");
      const { selection, route } = selectionFor(source, state.stateId);
      const root = inventoryFor([
        controlFor("button:a-open:0", "Open panel", 0),
        controlFor("button:b-open:0", "Open later", 1),
      ]);
      let nowCalls = 0;
      const chunkResult = await runChunk({
        source,
        state,
        route,
        root,
        nested: inventoryFor([]),
        stableAllPostAction: root,
        now: () => {
          const value = nowCalls;
          nowCalls += 1;
          return value;
        },
        deadlineAt: 1,
      });
      expect(chunkResult.result.completed).toBe(false);
      const archiveRoot = await mkdtemp(
        path.join(process.cwd(), ".r188-genesis-open-"),
      );
      try {
        await persistChunkAssets(archiveRoot, chunkResult.result.chunk);
        const context: ParentContext = {
          source,
          repoRoot: process.cwd(),
          archiveRoot,
          canaryPath: path.join(archiveRoot, "PREFLIGHT_CANARY.json"),
          selection,
          revealRoute: route,
          authorityKey: "a".repeat(64),
          attemptId: "attempt-fixture",
          chunkBudget: "1000",
          chunkBudgetMs: 1000,
          runPlaywright: () =>
            Promise.reject(new Error("Browser launch is forbidden")),
        };

        const result = await continueChild({
          context,
          progress: zeroProgress,
          chunk: chunkResult.result.chunk,
          ordinal: 0,
        });

        expect(result.done).toBe(false);
        expect(result.progress.receiptHead).toBe(
          chunkResult.result.chunk.receiptHead,
        );
        expect(result.progress.receiptCount).toBe(
          chunkResult.result.chunk.receiptCount,
        );
        expect(result.progress.chunkHead).toBe(
          chunkResult.result.chunk.chunkDigest,
        );
        expect(result.progress.chunkCount).toBe(1);
        expect(result.progress.previousCompletedCandidateCount).toBe(1);
        expect(result.progress.grant?.chain).toEqual({
          receiptHead: chunkResult.result.chunk.receiptHead,
          receiptCount: chunkResult.result.chunk.receiptCount,
          chunkHead: chunkResult.result.chunk.chunkDigest,
          chunkCount: 1,
        });
        expect(result.progress.inputPath).toBeDefined();
        await expect(
          access(result.progress.inputPath ?? ""),
        ).resolves.toBeUndefined();
      } finally {
        await rm(archiveRoot, { recursive: true, force: true });
      }
    });
  });

  it("reduces a complete first chunk before the parent writes PASS", async () => {
    const fixture = await createManifestFixture();
    const archiveRoot = await mkdtemp(
      path.join(process.cwd(), ".r188-genesis-pass-"),
    );
    try {
      const sourceSha = await initializeCleanFixtureRepository(fixture.root);
      const source = await buildCampaignSource({
        ...fixture.input,
        sourceSha,
      });
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("Fixture has no source state");
      const { selection, route } = selectionFor(source, state.stateId);
      const root = inventoryFor([
        controlFor("button:a-open:0", "Open panel", 0),
      ]);
      const chunkResult = await runChunk({
        source,
        state,
        route,
        root,
        nested: inventoryFor([]),
        stableAllPostAction: root,
        now: () => 0,
        deadlineAt: 10_000,
      });
      expect(chunkResult.result.completed).toBe(true);
      await persistChunkAssets(archiveRoot, chunkResult.result.chunk);
      const canaryPath = path.join(archiveRoot, "PREFLIGHT_CANARY.json");
      const context: ParentContext = {
        source,
        repoRoot: fixture.root,
        archiveRoot,
        canaryPath,
        selection,
        revealRoute: route,
        authorityKey: "a".repeat(64),
        attemptId: "attempt-fixture",
        chunkBudget: "1000",
        chunkBudgetMs: 1000,
        runPlaywright: () =>
          Promise.reject(new Error("Browser launch is forbidden")),
      };

      const result = await continueChild({
        context,
        progress: zeroProgress,
        chunk: chunkResult.result.chunk,
        ordinal: 0,
      });

      expect(result.done).toBe(true);
      expect(result.progress.receiptCount).toBe(1);
      expect(result.progress.chunkCount).toBe(1);
      expect(result.progress.grant).toBeUndefined();
      await expect(
        access(
          path.join(
            archiveRoot,
            "continuation",
            "PREFLIGHT_REVEAL_PARENT_PASS.attempt-fixture.0.json",
          ),
        ),
      ).resolves.toBeUndefined();
      await expect(access(canaryPath)).resolves.toBeUndefined();
    } finally {
      await Promise.all([
        rm(fixture.root, { recursive: true, force: true }),
        rm(archiveRoot, { recursive: true, force: true }),
      ]);
    }
  });
});
