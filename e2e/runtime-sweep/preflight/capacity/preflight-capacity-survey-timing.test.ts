import { describe, expect, it } from "vitest";

import {
  type CapacitySurveyTimingStage,
  createCapacitySurveyTiming,
} from "./preflight-capacity-survey-timing.ts";

const runFakeSurvey = async (browserDelayMs: number) => {
  let nowMs = 0;
  const timing = createCapacitySurveyTiming({
    enabled: true,
    now: () => nowMs,
  });
  const advance = (durationMs: number): void => {
    nowMs += durationMs;
  };
  const browserSpan = (
    stage: CapacitySurveyTimingStage,
    durationMs: number,
  ): Promise<void> =>
    timing.span(stage, () => {
      advance(durationMs);
      return Promise.resolve();
    });

  timing.beginCandidateQueue();
  await browserSpan("prepare", browserDelayMs + 2);
  await browserSpan("navigate", browserDelayMs + 3);
  await browserSpan("inventory", browserDelayMs + 4);
  await browserSpan("freeze", browserDelayMs + 1);
  await timing.span("executeReveal", async () => {
    advance(browserDelayMs + 5);
    await browserSpan("inventory", 2);
  });
  advance(7);
  timing.endCandidateQueue();

  return {
    timing: timing.snapshot(),
    terminal: {
      completedCandidateCount: 6,
      revealActionCount: 14,
      materialEdgeCount: 3,
      controlCount: 22,
      visitedStateCount: 5,
      maxQueueLength: 4,
      queueEmpty: true,
    },
    progress: {
      completedCandidateCount: 6,
      revealActionCount: 14,
      materialEdgeCount: 3,
      controlCount: 22,
      visitedStateCount: 5,
      queueLength: 0,
      maxQueueLength: 4,
    },
  } as const;
};

describe("capacity survey timing", () => {
  it("is inert unless explicitly enabled", () => {
    const timing = createCapacitySurveyTiming({
      now: () => {
        throw new Error("disabled timing must not read its clock");
      },
    });

    expect(timing.enabled).toBe(false);
    expect(timing.snapshot()).toEqual({
      elapsedMs: 0,
      prepareWallMs: 0,
      navigateWallMs: 0,
      inventoryWallMs: 0,
      freezeWallMs: 0,
      executeRevealWallMs: 0,
      candidateTotalWallMs: 0,
      externalUnionWallMs: 0,
      pureQueueResidualWallMs: 0,
    });
  });

  it("separates slow browser spans from stable terminal counters and pure queue residual", async () => {
    const baseline = await runFakeSurvey(1);
    const slowBrowser = await runFakeSurvey(11);

    expect(baseline.timing.externalUnionWallMs).toBe(22);
    expect(baseline.timing.pureQueueResidualWallMs).toBe(7);
    expect(slowBrowser.timing.prepareWallMs).toBeGreaterThan(
      baseline.timing.prepareWallMs,
    );
    expect(slowBrowser.timing.navigateWallMs).toBeGreaterThan(
      baseline.timing.navigateWallMs,
    );
    expect(slowBrowser.timing.inventoryWallMs).toBeGreaterThan(
      baseline.timing.inventoryWallMs,
    );
    expect(slowBrowser.timing.freezeWallMs).toBeGreaterThan(
      baseline.timing.freezeWallMs,
    );
    expect(slowBrowser.timing.executeRevealWallMs).toBeGreaterThan(
      baseline.timing.executeRevealWallMs,
    );
    expect(slowBrowser.timing.candidateTotalWallMs).toBeGreaterThan(
      baseline.timing.candidateTotalWallMs,
    );
    expect(slowBrowser.timing.elapsedMs).toBeGreaterThan(
      baseline.timing.elapsedMs,
    );
    expect(slowBrowser.timing.externalUnionWallMs).toBeGreaterThan(
      baseline.timing.externalUnionWallMs,
    );
    expect(slowBrowser.timing.pureQueueResidualWallMs).toBe(
      baseline.timing.pureQueueResidualWallMs,
    );
    expect(slowBrowser.terminal).toEqual(baseline.terminal);
    expect(slowBrowser.progress).toEqual(baseline.progress);
  });
});
