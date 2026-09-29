import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type {
  ReportHealthPulse,
  ReportHealthUnit,
} from "../model/report-health-pulse";
import { healthLocations, ReportHealthPulseView } from "./report-health-pulse";

const unit: ReportHealthUnit = {
  key: "p1",
  name: "Payments",
  kind: "product",
  status: "on-track",
  stages: [],
  missingStages: [],
  risks: [],
  historical: false,
};

function pulse(units: readonly ReportHealthUnit[]): ReportHealthPulse {
  return { units, blocked: 0, atRisk: 0, missing: 0, total: units.length };
}

describe("ReportHealthPulseView", () => {
  it("uses the singular for exactly one current reporting unit", () => {
    render(
      <ReportHealthPulseView health={pulse([unit])} onInspect={vi.fn()} />,
    );
    expect(screen.getByText(/1 current reporting unit ·/)).toBeInTheDocument();
  });

  it("renders no location line for a healthy attention row", () => {
    expect(healthLocations(unit)).toBe("");
    const flagged = { ...unit, missingStages: ["QA"] };
    render(
      <ReportHealthPulseView health={pulse([flagged])} onInspect={vi.fn()} />,
    );
    expect(screen.getByText("Not reported: QA")).toBeInTheDocument();
  });
});
