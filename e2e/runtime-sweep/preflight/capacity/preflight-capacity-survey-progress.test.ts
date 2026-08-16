import { describe, expect, it, vi } from "vitest";

import type { RevealDiscoveryProgress } from "../reveal/interaction/preflight-reveal-types.ts";
import {
  CAPACITY_SURVEY_PROGRESS_INTERVAL,
  createCapacitySurveyProgressReporter,
} from "./preflight-capacity-survey-progress.ts";

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
});
