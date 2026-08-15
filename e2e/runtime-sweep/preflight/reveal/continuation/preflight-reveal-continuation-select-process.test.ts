import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

import type { ParentContext } from "../../launch/preflight-reveal-continuation-parent.ts";
import { sealGrant } from "../../launch/preflight-reveal-continuation-parent-grant.ts";
import { parentReplayContextFor } from "../../launch/preflight-reveal-continuation-parent-replay.ts";
import {
  controlFor,
  inventoryFor,
  runChunk,
  selectionFor,
  withSource,
} from "./preflight-reveal-continuation-fixture.ts";
import { reduceRevealReceiptSuffix } from "./preflight-reveal-continuation-reducer.ts";
import { branchForRef } from "./receipts/preflight-reveal-continuation-receipts.ts";

describe("R188 process-separated select continuation", () => {
  it("hydrates and resumes a nested frozen select frontier", async () => {
    await withSource(async (source) => {
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("Fixture has no source state");
      const { selection, route } = selectionFor(source, state.stateId);
      const root = inventoryFor([
        controlFor("button:a-open:0", "Open panel", 0),
        controlFor("button:b-open:0", "Open later", 1),
      ]);
      const nested = inventoryFor([
        {
          ...controlFor("select:a", "Nested parent A", 0),
          role: "combobox",
          tagName: "select",
        },
      ]);
      const later = inventoryFor([
        {
          ...controlFor("select:b", "Nested parent B", 0),
          role: "combobox",
          tagName: "select",
        },
      ]);
      const selectRepresentatives = {
        "select:a": { kind: "select", value: "parent-a", index: 1 },
        "select:b": { kind: "select", value: "parent-b", index: 1 },
      } as const;
      let nowCalls = 0;
      const firstChunk = await runChunk({
        source,
        state,
        route,
        root,
        nested,
        later,
        selectRepresentatives,
        now: () => nowCalls++,
        deadlineAt: 2,
      });
      const receipt = firstChunk.result.chunk.receipts[0];
      if (receipt === undefined) throw new Error("Fixture produced no receipt");
      const initialBranch = branchForRef(receipt.branchRef);
      const replay = parentReplayContextFor({
        source,
        state,
        route,
        initialUrl: initialBranch.url,
        initialInventory: initialBranch.inventory,
      });
      const reduced = reduceRevealReceiptSuffix({
        queueInput: replay.queueInput,
        state: replay.initialState,
        receipts: firstChunk.result.chunk.receipts,
        predecessorCompletedCandidateCount: 0,
        predecessorDigest: null,
      });
      const archiveRoot = await mkdtemp(
        path.join(process.cwd(), ".r188-dynamic-select-process-"),
      );
      try {
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
        const sealed = await sealGrant({
          context,
          progress: {
            previousGrantDigest: null,
            previousCompletedCandidateCount: 0,
            receiptHead: null,
            receiptCount: 0,
            chunkHead: null,
            chunkCount: 0,
          },
          replay,
          state: reduced.state,
          chunk: firstChunk.result.chunk,
          ordinal: 0,
        });
        const ioUrl = pathToFileURL(
          path.resolve(
            "e2e/runtime-sweep/preflight/reveal/continuation/preflight-reveal-continuation-io.ts",
          ),
        ).href;
        const fixtureUrl = pathToFileURL(
          path.resolve(
            "e2e/runtime-sweep/preflight/reveal/continuation/preflight-reveal-continuation-fixture.ts",
          ),
        ).href;
        const script = `
          import { readRevealContinuationGrant, hydrateRevealContinuationAssets } from ${JSON.stringify(ioUrl)};
          import { withSource, selectionFor, runChunk, inventoryFor, controlFor } from ${JSON.stringify(fixtureUrl)};
          const archiveRoot = ${JSON.stringify(archiveRoot)};
          const grant = await readRevealContinuationGrant({ archiveRoot, filePath: ${JSON.stringify(sealed.path)} });
          if (grant === undefined) throw new Error("grant is missing in child process");
          await hydrateRevealContinuationAssets({ archiveRoot, grant });
          await withSource(async (source) => {
            const state = source.plan.states[0];
            if (state === undefined) throw new Error("fixture state is missing");
            const { route } = selectionFor(source, state.stateId);
            const result = await runChunk({
              source,
              state,
              route,
              root: inventoryFor([
                controlFor("button:a-open:0", "Open panel", 0),
                controlFor("button:b-open:0", "Open later", 1),
              ]),
              nested: inventoryFor([{ ...controlFor("select:a", "Nested parent A", 0), role: "combobox", tagName: "select" }]),
              later: inventoryFor([{ ...controlFor("select:b", "Nested parent B", 0), role: "combobox", tagName: "select" }]),
              selectRepresentatives: {
                "select:a": { kind: "select", value: "parent-a", index: 1 },
                "select:b": { kind: "select", value: "parent-b", index: 1 },
              },
              grant,
              expectedGrantDigest: grant.grantDigest,
              now: () => 0,
              deadlineAt: 10000,
            });
            process.stdout.write(JSON.stringify({
              completed: result.result.completed,
              receiptCount: result.result.chunk.receipts.length,
              action: result.result.chunk.receipts[0]?.action.controlKey,
              representativeKind: result.result.chunk.receipts[0]?.representativeInput?.kind,
              representativeValue: result.result.chunk.receipts[0]?.representativeInput?.value,
            }));
          });
        `;
        const child = spawn(
          process.execPath,
          ["--import", "tsx/esm", "--input-type=module", "-e", script],
          { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] },
        );
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (value: Buffer) => {
          stdout += value.toString("utf8");
        });
        child.stderr.on("data", (value: Buffer) => {
          stderr += value.toString("utf8");
        });
        const exitCode = await new Promise<number>((resolve, reject) => {
          child.once("error", reject);
          child.once("exit", (code) => resolve(code ?? -1));
        });
        expect(stderr).toBe("");
        expect(exitCode).toBe(0);
        expect(JSON.parse(stdout)).toEqual({
          completed: true,
          receiptCount: 2,
          action: "select:a",
          representativeKind: "select",
          representativeValue: "parent-a",
        });
      } finally {
        await rm(archiveRoot, { recursive: true, force: true });
      }
    });
  });
});
