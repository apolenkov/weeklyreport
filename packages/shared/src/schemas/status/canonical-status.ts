import { z } from "zod";

import type {
  RiskSeverity,
  TrafficLightStatus,
} from "../primitives/report-primitives.schema";

/**
 * Canonical severity ladder shared by web presentation and API traffic-light folds.
 */
export const canonicalStatusSchema = z.enum([
  "blocked",
  "at-risk",
  "on-track",
  "empty",
]);

/** Canonical status accepted at application boundaries. */
export type CanonicalStatus = z.infer<typeof canonicalStatusSchema>;

/** Numeric severity order used to fold canonical statuses to their worst value. */
export const CANONICAL_STATUS_PRECEDENCE: Readonly<
  Record<CanonicalStatus, number>
> = Object.freeze({
  blocked: 3,
  "at-risk": 2,
  "on-track": 1,
  empty: 0,
});

/**
 * The worst (highest-precedence) status across a set of values. `"empty"` —
 * the ladder's lowest rung — is the fold identity, so an empty input (or an
 * input of only `"empty"` values) resolves to `"empty"`.
 */
export function worstCanonicalStatus(
  values: readonly CanonicalStatus[],
): CanonicalStatus {
  return values.reduce<CanonicalStatus>(
    (worst, value) =>
      CANONICAL_STATUS_PRECEDENCE[value] > CANONICAL_STATUS_PRECEDENCE[worst]
        ? value
        : worst,
    "empty",
  );
}

/**
 * Converts a mandatory risk severity to the floor it forces on covered records.
 */
export function riskSeverityToCanonicalFloor(
  severity: RiskSeverity,
): CanonicalStatus {
  return severity === "blocked" ? "blocked" : "at-risk";
}

const CANONICAL_TO_TRAFFIC: Readonly<
  Record<CanonicalStatus, TrafficLightStatus | null>
> = Object.freeze({
  blocked: "red",
  "at-risk": "yellow",
  "on-track": "green",
  empty: null,
});

/** Adapts a canonical status to a traffic light; `"empty"` becomes `null`. */
export function canonicalToTrafficLight(
  status: CanonicalStatus,
): TrafficLightStatus | null {
  return CANONICAL_TO_TRAFFIC[status];
}

/**
 * Adapts a traffic light to canonical severity; null and absent map to `"empty"`.
 */
export function trafficLightToCanonical(
  status: TrafficLightStatus | null | undefined,
): CanonicalStatus {
  if (status === "red") return "blocked";
  if (status === "yellow") return "at-risk";
  if (status === "green") return "on-track";
  return "empty";
}
