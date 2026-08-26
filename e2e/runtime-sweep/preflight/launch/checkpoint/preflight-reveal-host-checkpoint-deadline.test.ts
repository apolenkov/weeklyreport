import { describe, expect, it } from "vitest";

import { withCleanSealedGrantFixture } from "../continuation/preflight-reveal-continuation-parent-test-fixture.ts";
import type { RequestHostCheckpoint } from "./preflight-reveal-host-checkpoint-client.ts";
import { runChildUntilDone } from "./preflight-reveal-host-checkpoint-parent.ts";
import { responseFor } from "./preflight-reveal-host-checkpoint-parent-test-fixture.ts";

const expiringClock = (): (() => number) => {
  const state = { calls: 0 };
  return () => {
    state.calls += 1;
    return state.calls < 5 ? 0 : 100;
  };
};

describe("host checkpoint parent cumulative deadline", () => {
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
            requestHostCheckpoint: ({
              request,
              signal: requestSignal,
            }: Parameters<RequestHostCheckpoint>[0]) => {
              evidence.observedSignal = requestSignal;
              return Promise.resolve(responseFor(request));
            },
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
                return Promise.resolve();
              },
            }),
        }),
      ).rejects.toThrow(/24-minute deadline exceeded/u);
      expect(evidence.published).toBe(false);
    });
  });
});
