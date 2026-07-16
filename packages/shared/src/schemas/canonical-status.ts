import type { TrafficLightStatus } from "./report-primitives.schema";

/**
 * The single severity vocabulary every surface's status ladder is an adapter
 * over: web's stage/product presentation status and the API's TrafficLight
 * fold both reduce to this ladder instead of each keeping its own precedence
 * table.
 */
export type CanonicalStatus = "blocked" | "at-risk" | "on-track" | "empty";

export const CANONICAL_STATUS_PRECEDENCE: Record<CanonicalStatus, number> = {
  blocked: 3,
  "at-risk": 2,
  "on-track": 1,
  empty: 0,
};

/**
 * The worst (highest-precedence) status across a set of values. `"empty"` —
 * the ladder's lowest rung — is the fold identity, so an empty input (or an
 * input of only `"empty"` values) resolves to `"empty"`.
 * @param values the statuses to fold over
 * @returns the highest-precedence status present, or `"empty"` if none
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
 * Floors a covering risk's severity to the status it forces on the
 * stage/product/activity it covers: an explicit `"blocked"` floors to
 * blocked, everything else — including an unset severity on a risk that is
 * already known to cover — floors to at-risk.
 * @param severity the risk's raw stored severity
 * @returns the status floor this risk forces
 */
export function riskSeverityToCanonicalFloor(
  severity: string | undefined,
): CanonicalStatus {
  return severity === "blocked" ? "blocked" : "at-risk";
}

const CANONICAL_TO_TRAFFIC: Record<CanonicalStatus, TrafficLightStatus | null> =
  {
    blocked: "red",
    "at-risk": "yellow",
    "on-track": "green",
    empty: null,
  };

/**
 * Adapts a canonical status to the API's traffic-light vocabulary.
 * @param status the canonical status to adapt
 * @returns the equivalent traffic light, or `null` for `"empty"`
 */
export function canonicalToTrafficLight(
  status: CanonicalStatus,
): TrafficLightStatus | null {
  return CANONICAL_TO_TRAFFIC[status];
}

/**
 * Adapts a traffic-light status to the canonical vocabulary. `null`/absent
 * maps to `"empty"` — the traffic-light side has no direct equivalent of
 * "touched but no severity", so the caller's "no data" and "known on-track"
 * distinction is asymmetric with the reverse adapter (empty ⇏ null; only
 * `null` ⇒ empty).
 * @param status the traffic light to adapt
 * @returns the equivalent canonical status
 */
export function trafficLightToCanonical(
  status: TrafficLightStatus | null | undefined,
): CanonicalStatus {
  if (status === "red") return "blocked";
  if (status === "yellow") return "at-risk";
  if (status === "green") return "on-track";
  return "empty";
}
