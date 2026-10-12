import type { TrafficLightStatus } from "@weeklyreport/shared";

// Risk-derived status projection for stages owned by another report author.
// The SDLC health and hidden-stage views consume the same projection, so its
// contract belongs to the period model rather than either React component.
export interface CrossAuthorEntry {
  readonly projectId: string;
  readonly projectName: string;
  readonly authorId: string;
  readonly authorInitials: string;
  readonly stageNames: readonly string[];
  readonly stages: readonly {
    readonly stageName: string;
    readonly status: TrafficLightStatus | null;
  }[];
}
