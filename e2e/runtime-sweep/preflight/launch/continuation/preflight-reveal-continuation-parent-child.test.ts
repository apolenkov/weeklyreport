import {
  access,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import type { ParentProgress } from "./preflight-reveal-continuation-parent.ts";
import { runPreflightRevealContinuation } from "./preflight-reveal-continuation-parent.ts";
import { withCleanSource } from "./preflight-reveal-continuation-parent-test-fixture.ts";

describe("R188 parent-child process boundary", () => {
  it("forbids the production continuation child from authoring canonical canary evidence", async () => {
    const source = await readFile(
      path.join(
        process.cwd(),
        "e2e/runtime-sweep/preflight/preflight-canary.spec.ts",
      ),
      "utf8",
    );

    expect(source).not.toMatch(
      /\b(?:createPreflightCanaryBlocked|createPreflightCanaryFailure|writePreflightCanaryArtifact)\b/u,
    );
  });

  it("starts without a child-visible cumulative receipt array", () => {
    const progress: ParentProgress = {
      previousGrantDigest: null,
      previousCompletedCandidateCount: 0,
      receiptHead: null,
      receiptCount: 0,
      chunkHead: null,
      chunkCount: 0,
      operationHead: null,
      operationChunkCount: 0,
      operationTotals: {
        fullReplayActions: 0,
        candidateActions: 0,
        inverseActions: 0,
        successfulRestorations: 0,
        consumedLeases: 0,
        physicalActions: 0,
        chargedActions: 0,
      },
    };

    expect(progress.receiptCount).toBe(0);
    expect("receipts" in progress).toBe(false);
  });

  it("terminates after one nonzero child exit without PASS or canary evidence", async () => {
    await withCleanSource(async ({ source, repoRoot }) => {
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("Fixture has no source state");
      const archiveRoot = await mkdtemp(
        path.join(process.cwd(), ".r188-nonzero-child-"),
      );
      try {
        const canaryPath = path.join(archiveRoot, "PREFLIGHT_CANARY.json");
        let childCalls = 0;
        const exitCode = await runPreflightRevealContinuation({
          source,
          repoRoot,
          archiveRoot,
          canaryPath,
          baselineReceiptDigest: "d".repeat(64),
          selector: { stateId: state.stateId },
          runPlaywright: () => {
            childCalls += 1;
            return Promise.resolve(23);
          },
        });

        expect(exitCode).toBe(23);
        expect(childCalls).toBe(1);
        await expect(access(canaryPath)).rejects.toMatchObject({
          code: "ENOENT",
        });
        await expect(
          access(path.join(archiveRoot, "continuation")),
        ).rejects.toMatchObject({ code: "ENOENT" });
      } finally {
        await rm(archiveRoot, { recursive: true, force: true });
      }
    });
  });

  it("does not silently resume an incomplete staged terminal publication", async () => {
    await withCleanSource(async ({ source, repoRoot }) => {
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("Fixture has no source state");
      const archiveRoot = await mkdtemp(
        path.join(process.cwd(), ".r188-pending-terminal-"),
      );
      try {
        const canaryPath = path.join(archiveRoot, "PREFLIGHT_CANARY.json");
        await writeFile(
          path.join(
            archiveRoot,
            ".PREFLIGHT_CANARY.json.reveal-attempt-old.pending",
          ),
          "incomplete\n",
          "utf8",
        );
        let childCalls = 0;
        await expect(
          runPreflightRevealContinuation({
            source,
            repoRoot,
            archiveRoot,
            canaryPath,
            baselineReceiptDigest: "d".repeat(64),
            selector: { stateId: state.stateId },
            runPlaywright: () => {
              childCalls += 1;
              return Promise.resolve(0);
            },
          }),
        ).rejects.toThrow(/staged terminal canary publication is pending/u);
        expect(childCalls).toBe(0);
      } finally {
        await rm(archiveRoot, { recursive: true, force: true });
      }
    });
  });

  it("removes a child result after a hard-wall failure so it cannot resume", async () => {
    await withCleanSource(async ({ source, repoRoot }) => {
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("Fixture has no source state");
      const archiveRoot = await mkdtemp(
        path.join(process.cwd(), ".r188-hard-wall-child-"),
      );
      try {
        await expect(
          runPreflightRevealContinuation({
            source,
            repoRoot,
            archiveRoot,
            canaryPath: path.join(archiveRoot, "PREFLIGHT_CANARY.json"),
            baselineReceiptDigest: "d".repeat(64),
            selector: { stateId: state.stateId },
            runPlaywright: async (_mode, _full, environment) => {
              const output =
                environment?.RUNTIME_SWEEP_PREFLIGHT_REVEAL_CONTINUATION_OUTPUT;
              if (output === undefined) throw new Error("Missing output path");
              await mkdir(path.dirname(output), { recursive: true });
              await writeFile(output, "partial\n", "utf8");
              throw new Error(
                "Reveal continuation exceeded maxDurationMs=90000",
              );
            },
          }),
        ).rejects.toThrow(/exceeded maxDurationMs=90000/u);
        expect(await readdir(path.join(archiveRoot, "continuation"))).toEqual(
          [],
        );
      } finally {
        await rm(archiveRoot, { recursive: true, force: true });
      }
    });
  });
});
