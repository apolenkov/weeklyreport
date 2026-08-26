import { describe, expect, it } from "vitest";

import {
  assertRevealContinuationTerminalizationActive,
  createRevealContinuationTerminalizationPermit,
} from "../continuation/preflight-reveal-continuation-parent.ts";
import { withCleanSealedGrantFixture } from "../continuation/preflight-reveal-continuation-parent-test-fixture.ts";
import type { RequestHostCheckpoint } from "./preflight-reveal-host-checkpoint-client.ts";
import { runChildUntilDone } from "./preflight-reveal-host-checkpoint-parent.ts";
import { responseFor } from "./preflight-reveal-host-checkpoint-parent-test-fixture.ts";

const expiringClock = (): (() => number) => {
  const state = { calls: 0 };
  return () => {
    state.calls += 1;
    return state.calls < 4 ? 0 : 100;
  };
};

describe("host checkpoint parent cumulative deadline", () => {
  it("rejects a permit from another attempt or without a final checkpoint", () =>
    withCleanSealedGrantFixture((fixture) => {
      const context = {
        ...fixture.context,
        deadlineMonotonic: 100,
        monotonicNow: () => 0,
        signal: new AbortController().signal,
      };
      const permits = [
        createRevealContinuationTerminalizationPermit({
          attemptId: "attempt-other",
          terminalChildOrdinal: 0,
          finalCheckpointDigest: "d".repeat(64),
        }),
        createRevealContinuationTerminalizationPermit({
          attemptId: context.attemptId,
          terminalChildOrdinal: 0,
          finalCheckpointDigest: "",
        }),
      ];
      for (const permit of permits)
        expect(() =>
          assertRevealContinuationTerminalizationActive(context, permit),
        ).toThrow(/permit is invalid/u);
      return Promise.resolve();
    }));

  it("stops before a second child after the shared deadline", async () => {
    await withCleanSealedGrantFixture(async (fixture) => {
      const signal = new AbortController().signal;
      const evidence = {
        childCalls: 0,
        observedSignal: undefined as AbortSignal | undefined,
      };
      await expect(
        runChildUntilDone({
          context: {
            ...fixture.context,
            now: () => 100,
            monotonicNow: expiringClock(),
            deadlineMonotonic: 50,
            deadlineAt: 150,
            signal,
            requestHostCheckpoint: Object.assign(
              ({
                request,
                signal: requestSignal,
              }: Parameters<RequestHostCheckpoint>[0]) => {
                evidence.observedSignal = requestSignal;
                return Promise.resolve(responseFor(request));
              },
              { complete: () => Promise.resolve() },
            ),
          },
          progress: fixture.validProgress,
          ordinal: 0,
          maxChildren: 2,
          runChild: (input) => {
            evidence.childCalls += 1;
            return Promise.resolve({ done: false, progress: input.progress });
          },
        }),
      ).rejects.toThrow(/24-minute deadline exceeded/u);
      expect(evidence).toEqual({ childCalls: 1, observedSignal: signal });
    });
  });

  it("does not publish terminal evidence after the shared deadline", async () => {
    await withCleanSealedGrantFixture(async (fixture) => {
      const evidence = { published: false };
      await expect(
        runChildUntilDone({
          context: {
            ...fixture.context,
            now: () => 100,
            monotonicNow: expiringClock(),
            deadlineMonotonic: 50,
            deadlineAt: 150,
            signal: new AbortController().signal,
            requestHostCheckpoint: ({
              request,
            }: Parameters<RequestHostCheckpoint>[0]) =>
              Promise.resolve(responseFor(request)),
          },
          progress: fixture.validProgress,
          ordinal: 0,
          maxChildren: 1,
          runChild: () =>
            Promise.resolve({
              done: true,
              progress: fixture.validProgress,
              exitCode: 0,
              publishTerminalArtifacts: () => {
                evidence.published = true;
                return Promise.resolve(() => Promise.resolve());
              },
            }),
        }),
      ).rejects.toThrow(/24-minute deadline exceeded/u);
      expect(evidence.published).toBe(false);
    });
  });

  it("allows only terminal publication inside the reserved grace", async () => {
    await withCleanSealedGrantFixture(async (fixture) => {
      const evidence = { published: false };
      const clockValues = [0, 10, 10, 10, 60, 60] as const;
      let clockIndex = 0;
      const monotonicNow = () =>
        clockValues[Math.min(clockIndex++, clockValues.length - 1)] ?? 60;
      await expect(
        runChildUntilDone({
          context: {
            ...fixture.context,
            now: () => 100,
            monotonicNow,
            functionalDeadlineMonotonic: 50,
            deadlineMonotonic: 100,
            deadlineAt: 200,
            signal: new AbortController().signal,
            requestHostCheckpoint: Object.assign(
              ({ request }: Parameters<RequestHostCheckpoint>[0]) =>
                Promise.resolve(responseFor(request)),
              { complete: () => Promise.resolve() },
            ),
          },
          progress: fixture.validProgress,
          ordinal: 0,
          maxChildren: 1,
          runChild: () =>
            Promise.resolve({
              done: true,
              progress: fixture.validProgress,
              exitCode: 0,
              publishTerminalArtifacts: () => {
                evidence.published = true;
                return Promise.resolve(() => Promise.resolve());
              },
            }),
        }),
      ).resolves.toBe(0);
      expect(evidence.published).toBe(true);
    });
  });

  it("rejects terminal publication after the cumulative deadline", async () => {
    await withCleanSealedGrantFixture(async (fixture) => {
      const evidence = { published: false };
      const clockValues = [0, 10, 10, 10, 110] as const;
      let clockIndex = 0;
      const monotonicNow = () =>
        clockValues[Math.min(clockIndex++, clockValues.length - 1)] ?? 110;
      await expect(
        runChildUntilDone({
          context: {
            ...fixture.context,
            now: () => 100,
            monotonicNow,
            functionalDeadlineMonotonic: 50,
            deadlineMonotonic: 100,
            deadlineAt: 200,
            signal: new AbortController().signal,
            requestHostCheckpoint: Object.assign(
              ({ request }: Parameters<RequestHostCheckpoint>[0]) =>
                Promise.resolve(responseFor(request)),
              { complete: () => Promise.resolve() },
            ),
          },
          progress: fixture.validProgress,
          ordinal: 0,
          maxChildren: 1,
          runChild: () =>
            Promise.resolve({
              done: true,
              progress: fixture.validProgress,
              exitCode: 0,
              publishTerminalArtifacts: () => {
                evidence.published = true;
                return Promise.resolve(() => Promise.resolve());
              },
            }),
        }),
      ).rejects.toThrow(/24-minute deadline exceeded/u);
      expect(evidence.published).toBe(false);
    });
  });
});
