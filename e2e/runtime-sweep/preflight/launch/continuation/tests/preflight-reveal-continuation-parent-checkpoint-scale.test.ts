import { existsSync } from "node:fs";
import { access, stat } from "node:fs/promises";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { DEFAULT_MAX_CONTROLS_PER_SEGMENT } from "../../../../matrix/matrix-limits.ts";
import {
  reducerStateForCheckpoint,
  reducerStateSnapshotFor,
} from "../../../reveal/continuation/preflight-reveal-continuation-reducer.ts";
import {
  amplifiedStateFor,
  coherentSegmentStateFor,
  completedStateFor,
  distinctStateFor,
  MAX_ARTIFACT_BYTES,
  R191_SURFACE_CONTROL_COUNT,
} from "../../checkpoint/preflight-reveal-continuation-parent-checkpoint-scale-fixture.ts";
import { createRevealContinuationTerminalizationPermit } from "../preflight-reveal-continuation-parent.ts";
import { sealGrant } from "../preflight-reveal-continuation-parent-grant.ts";
import { completeParent } from "../preflight-reveal-continuation-parent-results.ts";
import { writeCompleteCanary } from "../preflight-reveal-continuation-parent-support.ts";
import {
  withCleanSealedGrantFixture,
  withSealedGrantFixture,
} from "../preflight-reveal-continuation-parent-test-fixture.ts";

describe("R192 compact parent checkpoint scale", () => {
  it("restores the exact 8192-control maximum with linear registration lookup", async () => {
    await withSealedGrantFixture(async (fixture) => {
      const reducerState = fixture.validProgress.reducerState;
      if (reducerState === undefined)
        throw new Error("Scale fixture has no parent reducer state");
      const state = distinctStateFor(
        reducerState,
        DEFAULT_MAX_CONTROLS_PER_SEGMENT,
      );
      const restored = await Promise.resolve(
        reducerStateForCheckpoint({
          snapshot: reducerStateSnapshotFor(state),
          route: fixture.route,
        }),
      );

      expect(restored.controls).toHaveLength(DEFAULT_MAX_CONTROLS_PER_SEGMENT);
      expect(restored.discovered).toHaveLength(
        DEFAULT_MAX_CONTROLS_PER_SEGMENT,
      );
    });
  });

  it("seals an R191-shaped open frontier below the artifact byte bound", async () => {
    await withSealedGrantFixture(async (fixture) => {
      const reducerState = fixture.validProgress.reducerState;
      const reducerInput = fixture.validProgress.reducerInput;
      if (reducerState === undefined || reducerInput === undefined)
        throw new Error("Scale fixture has no parent reducer state");
      const state = amplifiedStateFor(reducerState, R191_SURFACE_CONTROL_COUNT);
      const sealed = await sealGrant({
        context: fixture.context,
        progress: fixture.validProgress,
        replay: { initialState: state, queueInput: reducerInput },
        state,
        chunk: fixture.chunk,
        ordinal: 2,
      });

      expect(sealed.grant.reducerState).toEqual({
        checkpointRef: sealed.grant.reducerStateDigest,
      });
      expect((await stat(sealed.path)).size).toBeLessThan(MAX_ARTIFACT_BYTES);
    });
  });

  it("writes R191-shaped COMPLETE parent PASS and canary evidence", async () => {
    await withCleanSealedGrantFixture(async (fixture) => {
      const reducerState = fixture.validProgress.reducerState;
      if (reducerState === undefined)
        throw new Error("Scale fixture has no parent reducer state");
      const state = completedStateFor(
        coherentSegmentStateFor(reducerState, R191_SURFACE_CONTROL_COUNT),
      );

      const result = await completeParent({
        context: fixture.context,
        progress: fixture.validProgress,
        chunk: fixture.chunk,
        reduced: {
          state,
          completedCandidateCount:
            fixture.validProgress.previousCompletedCandidateCount,
        },
        nextProgress: { ...fixture.validProgress, reducerState: state },
        ordinal: 4,
      });

      expect(result.done).toBe(true);
      const commit = await result.publishTerminalArtifacts(
        createRevealContinuationTerminalizationPermit({
          attemptId: "attempt-fixture",
          terminalChildOrdinal: 4,
          finalCheckpointDigest: "d".repeat(64),
        }),
      );
      await commit();
      await expect(
        access(
          path.join(
            fixture.archiveRoot,
            "continuation",
            "PREFLIGHT_REVEAL_PARENT_PASS.attempt-fixture.4.json",
          ),
        ),
      ).resolves.toBeUndefined();
      await expect(access(fixture.context.canaryPath)).resolves.toBeUndefined();
    });
  });

  it("keeps the staged canary when the final commit deadline expires", async () => {
    await withCleanSealedGrantFixture(async (fixture) => {
      const reducerState = fixture.validProgress.reducerState;
      if (reducerState === undefined)
        throw new Error("Scale fixture has no parent reducer state");
      const state = completedStateFor(
        coherentSegmentStateFor(reducerState, R191_SURFACE_CONTROL_COUNT),
      );
      const context = {
        ...fixture.context,
        deadlineMonotonic: 100,
        monotonicNow: () => (existsSync(fixture.context.canaryPath) ? 101 : 0),
      };
      const result = await completeParent({
        context,
        progress: fixture.validProgress,
        chunk: fixture.chunk,
        reduced: {
          state,
          completedCandidateCount:
            fixture.validProgress.previousCompletedCandidateCount,
        },
        nextProgress: { ...fixture.validProgress, reducerState: state },
        ordinal: 5,
      });
      const commit = await result.publishTerminalArtifacts(
        createRevealContinuationTerminalizationPermit({
          attemptId: "attempt-fixture",
          terminalChildOrdinal: 5,
          finalCheckpointDigest: "d".repeat(64),
        }),
      );
      await expect(commit()).rejects.toThrow(/24-minute deadline exceeded/u);
      await expect(access(fixture.context.canaryPath)).rejects.toMatchObject({
        code: "ENOENT",
      });
      await expect(
        access(
          path.join(
            fixture.archiveRoot,
            ".PREFLIGHT_CANARY.json.attempt-fixture.pending",
          ),
        ),
      ).resolves.toBeUndefined();
    });
  });

  it("keeps a visible pending residue when post-commit cleanup fails", async () => {
    await withCleanSealedGrantFixture(async (fixture) => {
      const reducerState = fixture.validProgress.reducerState;
      if (reducerState === undefined)
        throw new Error("Scale fixture has no parent reducer state");
      const state = completedStateFor(
        coherentSegmentStateFor(reducerState, R191_SURFACE_CONTROL_COUNT),
      );
      const commit = await writeCompleteCanary({
        context: fixture.context,
        replay: {
          state,
          completedCandidateCount:
            fixture.validProgress.previousCompletedCandidateCount,
        },
        cleanupPending: () =>
          Promise.reject(new Error("simulated pending cleanup failure")),
      });
      await expect(commit()).resolves.toBeUndefined();
      await expect(access(fixture.context.canaryPath)).resolves.toBeUndefined();
      await expect(
        access(
          path.join(
            fixture.archiveRoot,
            ".PREFLIGHT_CANARY.json.attempt-fixture.pending",
          ),
        ),
      ).resolves.toBeUndefined();
    });
  });

  it("rejects maxControlsPerSegment plus one before grant creation", async () => {
    await withSealedGrantFixture(async (fixture) => {
      const reducerState = fixture.validProgress.reducerState;
      const reducerInput = fixture.validProgress.reducerInput;
      if (reducerState === undefined || reducerInput === undefined)
        throw new Error("Scale fixture has no parent reducer state");
      const state = amplifiedStateFor(
        reducerState,
        fixture.source.matrixLimits.maxControlsPerSegment + 1,
      );

      await expect(
        sealGrant({
          context: fixture.context,
          progress: fixture.validProgress,
          replay: { initialState: state, queueInput: reducerInput },
          state,
          chunk: fixture.chunk,
          ordinal: 3,
        }),
      ).rejects.toThrow(/controls exceed maxControlsPerSegment/u);
    });
  });
});
