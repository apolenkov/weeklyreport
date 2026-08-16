import type { RevealDiscoveryProgress } from "../reveal/interaction/preflight-reveal-types.ts";

export const CAPACITY_SURVEY_PROGRESS_INTERVAL = 1024;

type MemorySample = Readonly<{
  heapUsed: number;
  rss: number;
}>;

export const createCapacitySurveyProgressReporter =
  (
    input: Readonly<{
      memoryUsage: () => MemorySample;
      write: (line: string) => void;
    }> = {
      memoryUsage: process.memoryUsage,
      write: (line) => process.stdout.write(line),
    },
  ): ((progress: RevealDiscoveryProgress) => void) =>
  (progress) => {
    if (
      progress.completedCandidateCount % CAPACITY_SURVEY_PROGRESS_INTERVAL !==
      0
    )
      return;
    const memory = input.memoryUsage();
    input.write(
      `${JSON.stringify({
        kind: "capacity-survey-progress",
        ...progress,
        heapUsedBytes: memory.heapUsed,
        rssBytes: memory.rss,
      })}\n`,
    );
  };
