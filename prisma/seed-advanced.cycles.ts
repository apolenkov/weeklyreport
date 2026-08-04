import { ItemWorkflowStatus, TrafficLightStatus } from "@prisma/client";

import type { SeedStage } from "./seed-constants.js";
import { SEED_STAGES } from "./seed-constants.js";

/**
 * Total cyclic lookup over a catalogue the caller guarantees is non-empty; the
 * throw replaces a non-null assertion and is unreachable for the seed literals.
 */
export function cyclic<T>(values: readonly T[], index: number): T {
  const value = values[index % values.length];
  if (value === undefined) {
    throw new Error("Advanced seed: cyclic lookup over an empty catalogue");
  }
  return value;
}

// Stage assignments and stage statuses both cover three consecutive stages
// starting at the product's own catalogue position.
export const CONSECUTIVE_STAGE_OFFSETS = [0, 1, 2] as const;

// Traffic-light rotation giving each section a varied but deterministic mix.
const TRAFFIC_CYCLE: readonly TrafficLightStatus[] = [
  TrafficLightStatus.green,
  TrafficLightStatus.yellow,
  TrafficLightStatus.red,
  TrafficLightStatus.green,
];

// NO bare stored `blocked` — a blocked pill is DERIVED from a covering
// blocked-severity risk, so the generic cycle stores only progress states.
const WORKFLOW_CYCLE: readonly ItemWorkflowStatus[] = [
  ItemWorkflowStatus.in_progress,
  ItemWorkflowStatus.done,
  ItemWorkflowStatus.in_progress,
  ItemWorkflowStatus.done,
];

const TAG_CYCLE: readonly string[] = ["feature", "bugfix", "infra", "ops"];

export const trafficLightFor = (seed: number): TrafficLightStatus =>
  cyclic(TRAFFIC_CYCLE, seed);

export const workflowFor = (seed: number): ItemWorkflowStatus =>
  cyclic(WORKFLOW_CYCLE, seed);

export const tagFor = (seed: number): string => cyclic(TAG_CYCLE, seed);

export const stageAt = (seed: number): SeedStage => cyclic(SEED_STAGES, seed);

export const stageNameFor = (seed: number): string =>
  cyclic(SEED_STAGES, seed).name;
