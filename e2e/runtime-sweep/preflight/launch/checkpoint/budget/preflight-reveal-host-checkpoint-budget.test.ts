import { access } from "node:fs/promises";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { readPreflightCanaryArtifact } from "../../../canary/preflight-canary.ts";
import { REVEAL_CONTINUATION_LIMITS } from "../../../reveal/continuation/contracts/preflight-reveal-continuation-limits.ts";
import { RevealContinuationBudgetError } from "../../continuation/preflight-reveal-continuation-budget-error.ts";
import { initialParentProgress } from "../../continuation/preflight-reveal-continuation-parent-progress.ts";
import { withCleanSealedGrantFixture } from "../../continuation/preflight-reveal-continuation-parent-test-fixture.ts";
import { runChildUntilDone } from "../preflight-reveal-host-checkpoint-parent.ts";
import { runRevealContinuationChildWithBudget } from "./preflight-reveal-host-checkpoint-budget-runner.ts";

describe("host checkpoint parent child-budget diagnostic", () => {
  it("rejects a post-checkpoint diagnostic without checkpoint bindings", async () => {
    await withCleanSealedGrantFixture(async (fixture) => {
      const context = {
        ...fixture.context,
        monotonicNow: () => 0,
        functionalDeadlineMonotonic: 76_945,
        deadlineMonotonic: 86_945,
        continuationLimits: REVEAL_CONTINUATION_LIMITS,
      };
      await expect(
        runChildUntilDone({
          context,
          progress: fixture.validProgress,
          ordinal: 1,
          maxChildren: 2,
        }),
      ).rejects.toThrow(
        "R188 post-checkpoint budget diagnostic requires a checkpoint binding",
      );
      expect(fixture.browserCalls()).toBe(0);
      await expect(access(context.canaryPath)).rejects.toMatchObject({
        code: "ENOENT",
      });
      await expect(
        access(
          path.join(
            path.dirname(context.canaryPath),
            `.${path.basename(context.canaryPath)}.${context.attemptId}.pending`,
          ),
        ),
      ).rejects.toMatchObject({ code: "ENOENT" });
    });
  });

  it("rejects dirty initial progress without publishing a diagnostic", async () => {
    await withCleanSealedGrantFixture(async (fixture) => {
      const context = {
        ...fixture.context,
        monotonicNow: () => 0,
        functionalDeadlineMonotonic: 76_945,
        deadlineMonotonic: 86_945,
        continuationLimits: REVEAL_CONTINUATION_LIMITS,
      };
      const dirtyInitialProgress = {
        previousGrantDigest: null,
        previousCompletedCandidateCount: 0,
        receiptHead: null,
        receiptCount: 1,
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
        previousCheckpointDigest: null,
        previousSampleSequence: null,
      };
      await expect(
        runChildUntilDone({
          context,
          progress: dirtyInitialProgress,
          ordinal: 0,
          maxChildren: 1,
        }),
      ).rejects.toThrow(
        "R188 empty bootstrap is valid only at the initial zero-chain boundary",
      );
      expect(fixture.browserCalls()).toBe(0);
      await expect(access(context.canaryPath)).rejects.toMatchObject({
        code: "ENOENT",
      });
      await expect(
        access(
          path.join(
            path.dirname(context.canaryPath),
            `.${path.basename(context.canaryPath)}.${context.attemptId}.pending`,
          ),
        ),
      ).rejects.toMatchObject({ code: "ENOENT" });
    });
  });

  it("captures an inner budget TOCTOU failure without launching Playwright", async () => {
    await withCleanSealedGrantFixture(async (fixture) => {
      const clockValues = [0, 0, 1, 1, 1, 1] as const;
      let clockIndex = 0;
      const context = {
        ...fixture.context,
        monotonicNow: () =>
          clockValues[Math.min(clockIndex++, clockValues.length - 1)] ?? 1,
        functionalDeadlineMonotonic: 100_000,
        deadlineMonotonic: 110_000,
      };
      const progress = {
        ...fixture.validProgress,
        previousCheckpointDigest: "c".repeat(64),
        previousSampleSequence: 61,
      };
      await expect(
        runChildUntilDone({
          context,
          progress,
          ordinal: 1,
          maxChildren: 2,
        }),
      ).resolves.toBe(1);
      expect(fixture.browserCalls()).toBe(0);
      const canary = await readPreflightCanaryArtifact(context.canaryPath);
      expect(canary).toMatchObject({
        status: "FAIL_NOT_PROVEN",
        functionalRemainingMs: 99_999,
        requiredChildWindowMs: 100_000,
        nextChildOrdinal: 1,
      });
    });
  });

  it("permits a child at the exact required budget boundary", async () => {
    await withCleanSealedGrantFixture(async (fixture) => {
      const evidence = { childCalls: 0 };
      const context = {
        ...fixture.context,
        monotonicNow: () => 0,
        functionalDeadlineMonotonic: 100_000,
        deadlineMonotonic: 110_000,
      };
      await expect(
        runChildUntilDone({
          context,
          progress: fixture.validProgress,
          ordinal: 0,
          maxChildren: 1,
          runChild: () => {
            evidence.childCalls += 1;
            return Promise.resolve({
              done: true as const,
              progress: fixture.validProgress,
              exitCode: 23,
            });
          },
        }),
      ).resolves.toBe(23);
      expect(evidence.childCalls).toBe(1);
    });
  });

  it("publishes a source-bound diagnostic and does not spawn a child below the boundary", async () => {
    await withCleanSealedGrantFixture(async (fixture) => {
      const context = {
        ...fixture.context,
        monotonicNow: () => 0,
        functionalDeadlineMonotonic: 76_945,
        deadlineMonotonic: 86_945,
        continuationLimits: REVEAL_CONTINUATION_LIMITS,
      };
      const progress = {
        ...fixture.validProgress,
        previousCheckpointDigest: "c".repeat(64),
        previousSampleSequence: 61,
      };
      await expect(
        runChildUntilDone({
          context,
          progress,
          ordinal: 7,
          maxChildren: 8,
        }),
      ).resolves.toBe(1);
      expect(fixture.browserCalls()).toBe(0);
      const canary = await readPreflightCanaryArtifact(context.canaryPath);
      if (canary.status !== "FAIL_NOT_PROVEN")
        throw new Error("Expected a diagnostic budget canary");
      expect(canary).toMatchObject({
        sourceSha: fixture.source.sourceSha,
        sourceTree: fixture.source.sourceTree,
        campaignId: fixture.source.campaignId,
        attemptId: context.attemptId,
        nextChildOrdinal: 7,
        lastCheckpointDigest: "c".repeat(64),
        lastCheckpointSequence: 7,
        lastSampleSequence: 61,
        grantDigest: fixture.validProgress.grant?.grantDigest,
        reducerStateDigest: fixture.validProgress.grant?.reducerStateDigest,
        functionalRemainingMs: 76_945,
        requiredChildWindowMs: 100_000,
        reason: "INSUFFICIENT_REMAINING_BUDGET",
      });
      expect(canary.frontier).not.toBeNull();
    });
  });

  it("keeps a budget error after browser launch terminal in aggregate mode", async () => {
    await withCleanSealedGrantFixture(async (fixture) => {
      const budgetError = new RevealContinuationBudgetError({
        remainingMs: 88_499,
        requiredMs: 100_000,
      });
      let boundaryCalls = 0;
      const context = {
        ...fixture.context,
        runPlaywright: () => Promise.reject(budgetError),
      };
      await expect(
        runRevealContinuationChildWithBudget({
          context,
          progress: initialParentProgress(),
          ordinal: 0,
          runChild: async ({ context: childContext }) => {
            await childContext.runPlaywright("canary");
            throw new Error("unreachable");
          },
          remainingMs: 100_000,
          assertTerminalPublicationActive: () => undefined,
          onPrelaunchBudgetExhausted: () => {
            boundaryCalls += 1;
          },
        }),
      ).resolves.toBeUndefined();
      expect(boundaryCalls).toBe(0);
      await expect(
        readPreflightCanaryArtifact(context.canaryPath),
      ).resolves.toMatchObject({
        status: "FAIL_NOT_PROVEN",
        functionalRemainingMs: 88_499,
        requiredChildWindowMs: 100_000,
      });
    });
  });
});
