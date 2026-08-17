import {
  type CapacitySurveyCompletedSpan,
  type CapacitySurveyQueueSpan,
  type CapacitySurveyTimingSnapshot,
  type CapacitySurveyTimingStage,
} from "./preflight-capacity-survey-timing-contract.ts";

export const EMPTY_CAPACITY_SURVEY_TIMING_SNAPSHOT: CapacitySurveyTimingSnapshot =
  {
    elapsedMs: 0,
    prepareWallMs: 0,
    navigateWallMs: 0,
    inventoryWallMs: 0,
    freezeWallMs: 0,
    executeRevealWallMs: 0,
    replayExecuteCount: 0,
    replayExecuteWallMs: 0,
    candidateExecuteCount: 0,
    candidateExecuteWallMs: 0,
    preSettleWallMs: 0,
    beforeSnapshotWallMs: 0,
    actionWallMs: 0,
    actionRevealReadyWallMs: 0,
    actionRevealReadyCount: 0,
    actionNavigationBoundaryWallMs: 0,
    actionNavigationBoundaryCount: 0,
    navigationNoneCount: 0,
    navigationObservedCount: 0,
    postSettleWallMs: 0,
    afterSnapshotWallMs: 0,
    representativeInputWallMs: 0,
    postObservationWallMs: 0,
    candidateTotalWallMs: 0,
    externalUnionWallMs: 0,
    pureQueueResidualWallMs: 0,
  };

const unionDurationFor = (
  spans: readonly CapacitySurveyCompletedSpan[],
  queue: CapacitySurveyQueueSpan,
): number => {
  const intervals = spans
    .map(({ startMs, endMs, depth }) => ({
      startMs: Math.max(startMs, queue.startMs),
      endMs: Math.min(endMs, queue.endMs),
      depth,
    }))
    .filter(({ startMs, endMs }) => endMs > startMs)
    .toSorted(
      (left, right) =>
        left.startMs - right.startMs ||
        left.endMs - right.endMs ||
        left.depth - right.depth,
    );
  const first = intervals[0];
  if (first === undefined) return 0;
  const merged = intervals.slice(1).reduce(
    (current, interval) =>
      interval.startMs > current.endMs
        ? {
            totalMs: current.totalMs + current.endMs - current.startMs,
            startMs: interval.startMs,
            endMs: interval.endMs,
          }
        : { ...current, endMs: Math.max(current.endMs, interval.endMs) },
    { totalMs: 0, startMs: first.startMs, endMs: first.endMs },
  );
  return merged.totalMs + merged.endMs - merged.startMs;
};

const stageSpansFor = (
  spans: readonly CapacitySurveyCompletedSpan[],
  stage: CapacitySurveyTimingStage,
): readonly CapacitySurveyCompletedSpan[] =>
  spans.filter((span) => span.stage === stage);

const stageWallMsFor = (
  spans: readonly CapacitySurveyCompletedSpan[],
  stage: CapacitySurveyTimingStage,
): number =>
  stageSpansFor(spans, stage).reduce(
    (total, span) => total + span.endMs - span.startMs,
    0,
  );

export const capacitySurveyTimingSnapshotFor = (input: {
  readonly spans: readonly CapacitySurveyCompletedSpan[];
  readonly queues: readonly CapacitySurveyQueueSpan[];
  readonly elapsedMs: number;
}): CapacitySurveyTimingSnapshot => {
  const wallMs = (stage: CapacitySurveyTimingStage): number =>
    stageWallMsFor(input.spans, stage);
  const candidateTotalWallMs = input.queues.reduce(
    (total, queue) => total + queue.endMs - queue.startMs,
    0,
  );
  const externalUnionWallMs = input.queues.reduce(
    (total, queue) => total + unionDurationFor(input.spans, queue),
    0,
  );
  return {
    elapsedMs: input.elapsedMs,
    prepareWallMs: wallMs("prepare"),
    navigateWallMs: wallMs("navigate"),
    inventoryWallMs: wallMs("inventory"),
    freezeWallMs: wallMs("freeze"),
    executeRevealWallMs: wallMs("executeReveal"),
    replayExecuteCount: stageSpansFor(input.spans, "replayExecute").length,
    replayExecuteWallMs: wallMs("replayExecute"),
    candidateExecuteCount: stageSpansFor(input.spans, "candidateExecute")
      .length,
    candidateExecuteWallMs: wallMs("candidateExecute"),
    preSettleWallMs: wallMs("preSettle"),
    beforeSnapshotWallMs: wallMs("beforeSnapshot"),
    actionWallMs: wallMs("action"),
    actionRevealReadyWallMs: wallMs("actionRevealReady"),
    actionRevealReadyCount: stageSpansFor(input.spans, "actionRevealReady")
      .length,
    actionNavigationBoundaryWallMs: wallMs("actionNavigationBoundary"),
    actionNavigationBoundaryCount: stageSpansFor(
      input.spans,
      "actionNavigationBoundary",
    ).length,
    navigationNoneCount: stageSpansFor(input.spans, "navigationNone").length,
    navigationObservedCount: stageSpansFor(input.spans, "navigationObserved")
      .length,
    postSettleWallMs: wallMs("postSettle"),
    afterSnapshotWallMs: wallMs("afterSnapshot"),
    representativeInputWallMs: wallMs("representativeInput"),
    postObservationWallMs: wallMs("postObservation"),
    candidateTotalWallMs,
    externalUnionWallMs,
    pureQueueResidualWallMs: Math.max(
      0,
      candidateTotalWallMs - externalUnionWallMs,
    ),
  };
};
