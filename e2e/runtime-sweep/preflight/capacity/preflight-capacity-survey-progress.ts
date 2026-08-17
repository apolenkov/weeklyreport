import type { RevealDiscoveryProgress } from "../reveal/interaction/preflight-reveal-types.ts";
import type { CapacitySurveyTiming } from "./preflight-capacity-survey-timing.ts";

export const CAPACITY_SURVEY_PROGRESS_INTERVAL = 1024;

type MemorySample = Readonly<{
  heapUsed: number;
  rss: number;
}>;

const timingFieldsFor = (
  timing: CapacitySurveyTiming | undefined,
): Readonly<Record<string, number>> => {
  if (timing?.enabled !== true) return {};
  const snapshot = timing.snapshot();
  return {
    capacitySurveyTimingElapsedMs: snapshot.elapsedMs,
    capacitySurveyTimingPrepareWallMs: snapshot.prepareWallMs,
    capacitySurveyTimingNavigateWallMs: snapshot.navigateWallMs,
    capacitySurveyTimingInventoryWallMs: snapshot.inventoryWallMs,
    capacitySurveyTimingFreezeWallMs: snapshot.freezeWallMs,
    capacitySurveyTimingExecuteRevealWallMs: snapshot.executeRevealWallMs,
    capacitySurveyTimingCandidateTotalWallMs: snapshot.candidateTotalWallMs,
    capacitySurveyTimingExternalUnionWallMs: snapshot.externalUnionWallMs,
    capacitySurveyTimingPureQueueResidualWallMs:
      snapshot.pureQueueResidualWallMs,
  };
};

export const createCapacitySurveyProgressReporter = (
  input?: Readonly<{
    memoryUsage?: () => MemorySample;
    write?: (line: string) => void;
    timing?: CapacitySurveyTiming;
  }>,
): ((progress: RevealDiscoveryProgress) => void) => {
  const memoryUsage = input?.memoryUsage ?? process.memoryUsage;
  const write = input?.write ?? ((line: string) => process.stdout.write(line));
  const timing = input?.timing;
  return (progress) => {
    if (
      progress.completedCandidateCount % CAPACITY_SURVEY_PROGRESS_INTERVAL !==
      0
    )
      return;
    const memory = memoryUsage();
    const timingFields = timingFieldsFor(timing);
    write(
      `${JSON.stringify({
        kind: "capacity-survey-progress",
        ...progress,
        heapUsedBytes: memory.heapUsed,
        rssBytes: memory.rss,
        ...timingFields,
      })}\n`,
    );
  };
};
