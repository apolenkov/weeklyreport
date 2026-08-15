import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

import type { ParentContext } from "../../../launch/preflight-reveal-continuation-parent.ts";
import { sealGrant } from "../../../launch/preflight-reveal-continuation-parent-grant.ts";
import { parentReplayContextFor } from "../../../launch/preflight-reveal-continuation-parent-replay.ts";
import {
  controlFor,
  inventoryFor,
  runChunk,
  selectionFor,
  withSource,
} from "../preflight-reveal-continuation-fixture.ts";
import {
  reduceRevealReceiptSuffix,
  reducerStateDigestFor,
} from "../preflight-reveal-continuation-reducer.ts";
import { branchForRef } from "../receipts/preflight-reveal-continuation-receipts.ts";

describe("R188 material-branch reducer", () => {
  it("preserves dynamic registration across split reduction", async () => {
    await withSource(async (source) => {
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("Fixture has no source state");
      const { route } = selectionFor(source, state.stateId);
      const result = await runChunk({
        source,
        state,
        route,
        root: inventoryFor([controlFor("button:a-open:0", "Open panel", 0)]),
        nested: inventoryFor([
          controlFor("button:n-first:0", "Nested action", 0),
        ]),
        now: () => 0,
        deadlineAt: 10_000,
      });
      const [first, second] = result.result.chunk.receipts;
      if (first === undefined || second === undefined)
        throw new Error("Fixture did not produce material branch receipts");
      const initialBranch = branchForRef(first.branchRef);
      const context = parentReplayContextFor({
        source,
        state,
        route,
        initialUrl: initialBranch.url,
        initialInventory: initialBranch.inventory,
      });
      const all = reduceRevealReceiptSuffix({
        queueInput: context.queueInput,
        state: context.initialState,
        receipts: [first, second],
        predecessorCompletedCandidateCount: 0,
        predecessorDigest: null,
      });
      const firstPart = reduceRevealReceiptSuffix({
        queueInput: context.queueInput,
        state: context.initialState,
        receipts: [first],
        predecessorCompletedCandidateCount: 0,
        predecessorDigest: null,
      });
      const split = reduceRevealReceiptSuffix({
        queueInput: context.queueInput,
        state: firstPart.state,
        receipts: [second],
        predecessorCompletedCandidateCount: firstPart.completedCandidateCount,
        predecessorDigest: firstPart.receiptHead,
      });
      expect(firstPart.status).toBe("OPEN");
      expect(
        firstPart.state.controls.some(
          (control) => control.controlKey === "button:n-first:0",
        ),
      ).toBe(true);
      expect(reducerStateDigestFor(split.state)).toBe(
        reducerStateDigestFor(all.state),
      );
      expect(split.status).toBe("COMPLETE");
    });
  });

  it("resumes a dynamic material frontier with the parent reducer state", async () => {
    await withSource(async (source) => {
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("Fixture has no source state");
      const { selection, route } = selectionFor(source, state.stateId);
      const root = inventoryFor([
        controlFor("button:a-open:0", "Open panel", 0),
      ]);
      const nested = inventoryFor([
        controlFor("button:n-first:0", "Nested action", 0),
      ]);
      let nowCalls = 0;
      const firstChunk = await runChunk({
        source,
        state,
        route,
        root,
        nested,
        now: () => nowCalls++,
        deadlineAt: 1,
      });
      expect(firstChunk.result.completed).toBe(false);
      const first = firstChunk.result.chunk.receipts[0];
      if (first === undefined) throw new Error("Fixture produced no receipt");
      const initialBranch = branchForRef(first.branchRef);
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
        receipts: [first],
        predecessorCompletedCandidateCount: 0,
        predecessorDigest: null,
      });
      const archiveRoot = await mkdtemp(
        path.join(process.cwd(), ".r188-material-resume-"),
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
        await expect(
          runChunk({
            source,
            state,
            route,
            root,
            nested,
            grant: sealed.grant,
            expectedGrantDigest: sealed.grant.grantDigest,
            nonMutation: {
              status: "unchanged",
              beforeDigest: "e".repeat(64),
              afterDigest: "f".repeat(64),
            },
            now: () => 0,
            deadlineAt: 10_000,
          }),
        ).rejects.toThrow(/unchanged database-oracle proof/iu);
        const resumed = await runChunk({
          source,
          state,
          route,
          root,
          nested,
          grant: sealed.grant,
          expectedGrantDigest: sealed.grant.grantDigest,
          nonMutation: {
            status: "unchanged",
            beforeDigest: "e".repeat(64),
            afterDigest: "e".repeat(64),
          },
          now: () => 0,
          deadlineAt: 10_000,
        });
        expect(resumed.result.completed).toBe(true);
        expect(resumed.result.chunk.receipts).toHaveLength(1);
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
              root: inventoryFor([controlFor("button:a-open:0", "Open panel", 0)]),
              nested: inventoryFor([controlFor("button:n-first:0", "Nested action", 0)]),
              grant,
              expectedGrantDigest: grant.grantDigest,
              nonMutation: {
                status: "unchanged",
                beforeDigest: "${"f".repeat(64)}",
                afterDigest: "${"f".repeat(64)}",
              },
              now: () => 0,
              deadlineAt: 10000,
            });
            process.stdout.write(JSON.stringify({ completed: result.result.completed, receipts: result.result.chunk.receipts.length }));
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
          child.once("close", (code) => resolve(code ?? -1));
        });
        expect({ exitCode, stderr }).toEqual({ exitCode: 0, stderr: "" });
        expect(JSON.parse(stdout)).toEqual({ completed: true, receipts: 1 });
      } finally {
        await rm(archiveRoot, { recursive: true, force: true });
      }
    });
  });
});
