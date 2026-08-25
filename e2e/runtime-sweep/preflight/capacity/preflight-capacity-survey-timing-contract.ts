import { REVEAL_EXECUTION_TIMING_STAGES } from "../reveal/interaction/preflight-reveal-types.ts";

type CapacitySurveyBrowserTimingStage =
  "prepare" | "navigate" | "inventory" | "freeze" | "executeReveal";

export type CapacitySurveyTimingStage =
  | CapacitySurveyBrowserTimingStage
  | (typeof REVEAL_EXECUTION_TIMING_STAGES)[number];

export type CapacitySurveyTimingSnapshot = Readonly<{
  readonly elapsedMs: number;
  readonly prepareWallMs: number;
  readonly navigateWallMs: number;
  readonly inventoryWallMs: number;
  readonly freezeWallMs: number;
  readonly executeRevealWallMs: number;
  readonly replayExecuteCount: number;
  readonly replayExecuteWallMs: number;
  readonly candidateExecuteCount: number;
  readonly candidateExecuteWallMs: number;
  readonly preSettleWallMs: number;
  readonly beforeSnapshotWallMs: number;
  readonly actionWallMs: number;
  readonly actionRevealReadyWallMs: number;
  readonly actionRevealReadyCount: number;
  readonly actionNavigationBoundaryWallMs: number;
  readonly actionNavigationBoundaryCount: number;
  readonly navigationNoneCount: number;
  readonly navigationObservedCount: number;
  readonly postSettleWallMs: number;
  readonly afterSnapshotWallMs: number;
  readonly representativeInputWallMs: number;
  readonly postObservationWallMs: number;
  readonly candidateTotalWallMs: number;
  readonly externalUnionWallMs: number;
  readonly pureQueueResidualWallMs: number;
}>;

export type CapacitySurveyCompletedSpan = Readonly<{
  readonly stage: CapacitySurveyTimingStage;
  readonly startMs: number;
  readonly endMs: number;
  readonly depth: number;
}>;

export type CapacitySurveyQueueSpan = Readonly<{
  readonly startMs: number;
  readonly endMs: number;
}>;
