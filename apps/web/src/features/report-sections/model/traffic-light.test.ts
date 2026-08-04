import { trafficLightStatusSchema } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import { stageStatusToTraffic, trafficToStageStatus } from "./traffic-light";

describe("trafficToStageStatus", () => {
  it("maps 'green' to 'on-track'", () => {
    expect(trafficToStageStatus("green")).toBe("on-track");
  });

  it("maps 'yellow' to 'at-risk'", () => {
    expect(trafficToStageStatus("yellow")).toBe("at-risk");
  });

  it("maps 'red' to 'blocked'", () => {
    expect(trafficToStageStatus("red")).toBe("blocked");
  });

  it("maps null to 'empty'", () => {
    expect(trafficToStageStatus(null)).toBe("empty");
  });
});

describe("stageStatusToTraffic", () => {
  it("maps 'on-track' to 'green'", () => {
    expect(stageStatusToTraffic("on-track")).toBe("green");
  });

  it("maps 'at-risk' to 'yellow'", () => {
    expect(stageStatusToTraffic("at-risk")).toBe("yellow");
  });

  it("maps 'blocked' to 'red'", () => {
    expect(stageStatusToTraffic("blocked")).toBe("red");
  });

  it("maps 'empty' to null", () => {
    expect(stageStatusToTraffic("empty")).toBeNull();
  });
});

describe("traffic-light mapper roundtrip", () => {
  it("roundtrips every TrafficLightStatus value (green/yellow/red/null)", () => {
    const values = [...trafficLightStatusSchema.options, null];
    for (const v of values) {
      expect(stageStatusToTraffic(trafficToStageStatus(v))).toBe(v);
    }
  });
});
