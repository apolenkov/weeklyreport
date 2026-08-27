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

import { REVEAL_CONTINUATION_LIMITS } from "../../../reveal/continuation/contracts/preflight-reveal-continuation-limits.ts";
import type { ParentProgress } from "../preflight-reveal-continuation-parent.ts";
import { runPreflightRevealContinuation } from "../preflight-reveal-continuation-parent.ts";
import {
  assertRevealContinuationChildBudget,
  runContinuationChild,
} from "../preflight-reveal-continuation-parent-child.ts";
import {
  withCleanSealedGrantFixture,
  withCleanSource,
} from "../preflight-reveal-continuation-parent-test-fixture.ts";

describe("R188 parent-child process boundary", () => {
  it.each([
    REVEAL_CONTINUATION_LIMITS.hardWallMs +
      REVEAL_CONTINUATION_LIMITS.killGraceMs -
      1,
    0,
  ])(
    "rejects a child without a full cooperative budget (%s ms)",
    (remainingMs) => {
      expect(() =>
        assertRevealContinuationChildBudget({
          remainingMs,
          hardWallMs: REVEAL_CONTINUATION_LIMITS.hardWallMs,
          killGraceMs: REVEAL_CONTINUATION_LIMITS.killGraceMs,
        }),
      ).toThrow("INSUFFICIENT_REMAINING_BUDGET");
    },
  );

  it("accepts an unbounded parent clock as sufficient budget", () => {
    expect(() =>
      assertRevealContinuationChildBudget({
        remainingMs: Number.POSITIVE_INFINITY,
        hardWallMs: REVEAL_CONTINUATION_LIMITS.hardWallMs,
        killGraceMs: REVEAL_CONTINUATION_LIMITS.killGraceMs,
      }),
    ).not.toThrow();
  });

  it("accepts exactly one complete child window", () => {
    expect(() =>
      assertRevealContinuationChildBudget({
        remainingMs:
          REVEAL_CONTINUATION_LIMITS.hardWallMs +
          REVEAL_CONTINUATION_LIMITS.killGraceMs,
        hardWallMs: REVEAL_CONTINUATION_LIMITS.hardWallMs,
        killGraceMs: REVEAL_CONTINUATION_LIMITS.killGraceMs,
      }),
    ).not.toThrow();
  });

  it.each([
    REVEAL_CONTINUATION_LIMITS.hardWallMs +
      REVEAL_CONTINUATION_LIMITS.killGraceMs -
      1,
    0,
  ])(
    "checks the remaining budget before grant hydration, output checks, or browser launch (%s ms)",
    async (remainingMs) => {
      await withCleanSealedGrantFixture(async (fixture) => {
        const browserCalls = { value: 0 };
        const outputPath = path.join(
          fixture.archiveRoot,
          "continuation",
          `PREFLIGHT_REVEAL_CONTINUATION.${fixture.context.attemptId}.1.json`,
        );
        await mkdir(path.dirname(outputPath), { recursive: true });
        await writeFile(outputPath, "stale\n", "utf8");
        const context = {
          ...fixture.context,
          functionalDeadlineMonotonic: remainingMs,
          deadlineMonotonic: remainingMs + 9999,
          monotonicNow: () => 0,
          runPlaywright: () => {
            browserCalls.value += 1;
            return Promise.resolve(0);
          },
        };

        await expect(
          runContinuationChild({
            context,
            progress: {
              ...fixture.validProgress,
              previousGrantDigest: "f".repeat(64),
            },
            ordinal: 1,
          }),
        ).rejects.toThrow("INSUFFICIENT_REMAINING_BUDGET");
        expect(browserCalls.value).toBe(0);
        await expect(readFile(outputPath, "utf8")).resolves.toBe("stale\n");
      });
    },
  );

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
