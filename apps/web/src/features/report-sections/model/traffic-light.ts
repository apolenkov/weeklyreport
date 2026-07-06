/**
 * Traffic-light mapper: bridges API enum (green/yellow/red, optionally null)
 * with the UI presentation enum (on-track/at-risk/blocked/empty).
 *
 * The mapper is intentionally self-contained and does NOT import from
 * mock-data.ts -- it owns canonical type aliases for both sides so that
 * downstream consumers can depend on the mapper layer without coupling
 * to a particular UI module.
 */

export type TrafficLightStatus = "green" | "yellow" | "red";
export type StageStatus = "on-track" | "at-risk" | "blocked" | "empty";

/**
 * Converts an API TrafficLightStatus (or null for "no data") into the
 * StageStatus enum used by lead/dashboard presentation components.
 *
 * - green  -> on-track
 * - yellow -> at-risk
 * - red    -> blocked
 * - null   -> empty (no API equivalent; computed presentation-only state)
 */
export function trafficToStageStatus(
  trafficLight: TrafficLightStatus | null,
): StageStatus {
  switch (trafficLight) {
    case "green":
      return "on-track";
    case "yellow":
      return "at-risk";
    case "red":
      return "blocked";
    case null:
      return "empty";
  }
}

/**
 * Inverse mapping: presentation StageStatus back to API TrafficLightStatus.
 * Returns null for the computed 'empty' state, since it has no DB enum value.
 */
export function stageStatusToTraffic(
  status: StageStatus,
): TrafficLightStatus | null {
  switch (status) {
    case "on-track":
      return "green";
    case "at-risk":
      return "yellow";
    case "blocked":
      return "red";
    case "empty":
      return null;
  }
}
