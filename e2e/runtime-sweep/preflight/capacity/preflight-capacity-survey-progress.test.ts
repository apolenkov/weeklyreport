import { describe, expect, it, vi } from "vitest";

import type { RevealDiscoveryProgress } from "../reveal/interaction/preflight-reveal-types.ts";
import {
  CAPACITY_SURVEY_PROGRESS_INTERVAL,
  CAPACITY_SURVEY_TIMING_PROGRESS_INTERVAL,
  createCapacitySurveyProgressReporter,
} from "./preflight-capacity-survey-progress.ts";
import { createCapacitySurveyTiming } from "./preflight-capacity-survey-timing.ts";

const progressFor = (
  completedCandidateCount: number,
): RevealDiscoveryProgress => ({
  completedCandidateCount,
  revealActionCount: completedCandidateCount * 2,
  materialEdgeCount: completedCandidateCount / 2,
  controlCount: 20,
  visitedStateCount: 10,
  queueLength: 4,
  maxQueueLength: 8,
});

describe("capacity survey progress reporter", () => {
  it("emits one bounded scalar sample per fixed candidate interval", () => {
    const write = vi.fn();
    const reporter = createCapacitySurveyProgressReporter({
      memoryUsage: () => ({ heapUsed: 123, rss: 456 }),
      write,
    });

    reporter(progressFor(CAPACITY_SURVEY_PROGRESS_INTERVAL - 1));
    reporter(progressFor(CAPACITY_SURVEY_PROGRESS_INTERVAL));
    reporter(progressFor(CAPACITY_SURVEY_PROGRESS_INTERVAL + 1));

    expect(write).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(write.mock.calls[0]?.[0]))).toEqual({
      kind: "capacity-survey-progress",
      ...progressFor(CAPACITY_SURVEY_PROGRESS_INTERVAL),
      heapUsedBytes: 123,
      rssBytes: 456,
    });
  });

  it("keeps enabled timing fields flat and omits them when disabled", async () => {
    let nowMs = 0;
    const enabledTiming = createCapacitySurveyTiming({
      enabled: true,
      now: () => nowMs,
    });
    enabledTiming.beginCandidateQueue();
    await enabledTiming.span("navigate", () => {
      nowMs += 5;
      return Promise.resolve();
    });
    enabledTiming.endCandidateQueue();
    const enabledWrite = vi.fn();
    const enabledReporter = createCapacitySurveyProgressReporter({
      memoryUsage: () => ({ heapUsed: 123, rss: 456 }),
      timing: enabledTiming,
      write: enabledWrite,
    });

    enabledReporter(progressFor(CAPACITY_SURVEY_TIMING_PROGRESS_INTERVAL));

    const enabledPayload = JSON.parse(
      String(enabledWrite.mock.calls[0]?.[0]),
    ) as Record<string, unknown>;
    const timingKeys = [
      "capacitySurveyTimingElapsedMs",
      "capacitySurveyTimingPrepareWallMs",
      "capacitySurveyTimingNavigateWallMs",
      "capacitySurveyTimingInventoryWallMs",
      "capacitySurveyTimingFreezeWallMs",
      "capacitySurveyTimingExecuteRevealWallMs",
      "capacitySurveyTimingReplayExecuteCount",
      "capacitySurveyTimingReplayExecuteWallMs",
      "capacitySurveyTimingCandidateExecuteCount",
      "capacitySurveyTimingCandidateExecuteWallMs",
      "capacitySurveyTimingPreSettleWallMs",
      "capacitySurveyTimingBeforeSnapshotWallMs",
      "capacitySurveyTimingActionWallMs",
      "capacitySurveyTimingActionRevealReadyWallMs",
      "capacitySurveyTimingActionRevealReadyCount",
      "capacitySurveyTimingActionNavigationBoundaryWallMs",
      "capacitySurveyTimingActionNavigationBoundaryCount",
      "capacitySurveyTimingNavigationNoneCount",
      "capacitySurveyTimingNavigationObservedCount",
      "capacitySurveyTimingPostSettleWallMs",
      "capacitySurveyTimingAfterSnapshotWallMs",
      "capacitySurveyTimingRepresentativeInputWallMs",
      "capacitySurveyTimingPostObservationWallMs",
      "capacitySurveyTimingCandidateTotalWallMs",
      "capacitySurveyTimingExternalUnionWallMs",
      "capacitySurveyTimingPureQueueResidualWallMs",
    ];
    timingKeys.forEach((key) => {
      expect(enabledPayload[key]).toEqual(expect.any(Number));
    });
    expect(enabledPayload.timing).toBeUndefined();
    expect(
      Object.values(enabledPayload).filter(
        (value) => typeof value === "object" && value !== null,
      ),
    ).toEqual([]);

    const disabledWrite = vi.fn();
    const disabledReporter = createCapacitySurveyProgressReporter({
      memoryUsage: () => ({ heapUsed: 123, rss: 456 }),
      timing: createCapacitySurveyTiming(),
      write: disabledWrite,
    });
    disabledReporter(progressFor(CAPACITY_SURVEY_TIMING_PROGRESS_INTERVAL));
    expect(disabledWrite).not.toHaveBeenCalled();
    disabledReporter(progressFor(CAPACITY_SURVEY_PROGRESS_INTERVAL));
    const disabledPayload = JSON.parse(
      String(disabledWrite.mock.calls[0]?.[0]),
    ) as Record<string, unknown>;
    expect(
      Object.keys(disabledPayload).filter((key) =>
        key.startsWith("capacitySurveyTiming"),
      ),
    ).toEqual([]);
    expect(disabledPayload.timing).toBeUndefined();
  });
});
