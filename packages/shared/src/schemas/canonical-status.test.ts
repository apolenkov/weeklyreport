import { describe, expect, it } from "vitest";

import {
  CANONICAL_STATUS_PRECEDENCE,
  type CanonicalStatus,
  canonicalToTrafficLight,
  riskSeverityToCanonicalFloor,
  trafficLightToCanonical,
  worstCanonicalStatus,
} from "./canonical-status";
import type { TrafficLightStatus } from "./report-primitives.schema";

describe("CANONICAL_STATUS_PRECEDENCE", () => {
  it("orders the ladder blocked > at-risk > on-track > empty", () => {
    expect(CANONICAL_STATUS_PRECEDENCE.blocked).toBeGreaterThan(
      CANONICAL_STATUS_PRECEDENCE["at-risk"],
    );
    expect(CANONICAL_STATUS_PRECEDENCE["at-risk"]).toBeGreaterThan(
      CANONICAL_STATUS_PRECEDENCE["on-track"],
    );
    expect(CANONICAL_STATUS_PRECEDENCE["on-track"]).toBeGreaterThan(
      CANONICAL_STATUS_PRECEDENCE.empty,
    );
  });
});

describe("worstCanonicalStatus", () => {
  it("returns empty for an empty input (fold identity)", () => {
    expect(worstCanonicalStatus([])).toBe("empty");
  });

  it("returns the sole value for a single-element input", () => {
    expect(worstCanonicalStatus(["at-risk"])).toBe("at-risk");
  });

  it.each([
    { values: ["on-track", "empty"], expected: "on-track" },
    { values: ["at-risk", "on-track"], expected: "at-risk" },
    {
      values: ["blocked", "at-risk", "on-track", "empty"],
      expected: "blocked",
    },
    { values: ["empty", "empty"], expected: "empty" },
  ] satisfies { values: CanonicalStatus[]; expected: CanonicalStatus }[])(
    "resolves $values to $expected",
    ({ values, expected }) => {
      expect(worstCanonicalStatus(values)).toBe(expected);
    },
  );

  it("is order-independent", () => {
    const forward: CanonicalStatus[] = ["on-track", "blocked", "at-risk"];
    const reversed = [...forward].reverse();
    expect(worstCanonicalStatus(forward)).toBe(worstCanonicalStatus(reversed));
  });
});

describe("riskSeverityToCanonicalFloor", () => {
  it('floors "blocked" to blocked', () => {
    expect(riskSeverityToCanonicalFloor("blocked")).toBe("blocked");
  });

  it('floors "at-risk" to at-risk', () => {
    expect(riskSeverityToCanonicalFloor("at-risk")).toBe("at-risk");
  });
});

describe("canonicalToTrafficLight / trafficLightToCanonical round-trips", () => {
  it.each([
    { canonical: "blocked", traffic: "red" },
    { canonical: "at-risk", traffic: "yellow" },
    { canonical: "on-track", traffic: "green" },
  ] satisfies {
    canonical: CanonicalStatus;
    traffic: TrafficLightStatus;
  }[])(
    "$canonical <-> $traffic round-trips both ways",
    ({ canonical, traffic }) => {
      expect(canonicalToTrafficLight(canonical)).toBe(traffic);
      expect(trafficLightToCanonical(traffic)).toBe(canonical);
    },
  );

  it("empty/null is the asymmetric edge: empty -> null, but null -> empty", () => {
    expect(canonicalToTrafficLight("empty")).toBeNull();
    expect(trafficLightToCanonical(null)).toBe("empty");
    expect(trafficLightToCanonical(undefined)).toBe("empty");
  });
});
