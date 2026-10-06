import { fireEvent, render, screen } from "@testing-library/react";
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
  it("rests as one collapsed summary line with counts and denominators", () => {
    const blocked = {
      ...unit,
      key: "p2",
      name: "Billing",
      status: "blocked" as const,
    };
    const flagged = {
      ...unit,
      key: "p3",
      name: "Search",
      missingStages: ["QA"],
    };
    render(
      <ReportHealthPulseView
        health={{
          units: [unit, blocked, flagged],
          blocked: 1,
          atRisk: 0,
          missing: 1,
          total: 3,
        }}
        onInspect={vi.fn()}
      />,
    );
    const summary = screen.getByText(
      "1 of 3 blocked · 0 of 3 at risk · 1 of 3 missing status",
    );
    expect(summary).toBeVisible();
    const details = summary.closest("details");
    expect(details).not.toHaveAttribute("open");
    expect(
      screen.getByRole("button", { name: "Inspect health for Billing" }),
    ).not.toBeVisible();
    fireEvent.click(summary);
    expect(
      screen.getByRole("button", { name: "Inspect health for Billing" }),
    ).toBeVisible();
    expect(screen.getByText(/3 current reporting units ·/)).toBeVisible();
  });

  it("states that all current units are healthy when nothing needs attention", () => {
    render(
      <ReportHealthPulseView
        health={pulse([unit, { ...unit, key: "p2" }])}
        onInspect={vi.fn()}
      />,
    );
    expect(screen.getByText(/all 2 current units healthy/)).toBeVisible();
    expect(screen.queryByRole("group")).toBeNull();
    expect(document.querySelector("details")).toBeNull();
  });

  it("uses the singular for exactly one healthy current unit", () => {
    render(
      <ReportHealthPulseView health={pulse([unit])} onInspect={vi.fn()} />,
    );
    expect(screen.getByText(/1 current unit healthy/)).toBeVisible();
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
