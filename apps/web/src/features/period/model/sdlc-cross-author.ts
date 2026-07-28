import type { TrafficLightStatus } from "@customreport/shared";

/**
 * Risk-derived status projection for stages owned by another report author.
 *
 * The SDLC health and hidden-stage views consume the same projection, so its
 * contract belongs to the period model rather than either React component.
 */
export interface CrossAuthorEntry {
  projectId: string;
  projectName: string;
  authorId: string;
  authorInitials: string;
  stageNames: string[];
  stages: { stageName: string; status: TrafficLightStatus | null }[];
}
