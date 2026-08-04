import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { WeeklyProductReport } from "../../../features/report-sections/model/weekly-report-types";
import { PrintLeadSection } from "./print-lead-section";

function makeReport(
  status: WeeklyProductReport["status"],
): WeeklyProductReport {
  return {
    id: `report-${status}`,
    authorIds: ["author-1"],
    initials: "AL",
    name: "Alex Lead",
    status,
    statusLabel: status,
    leads: "Alex Lead",
    currentWeek: [],
    nextWeek: [],
    risks: [],
    decisions: [],
    priorities: [],
  };
}

describe("PrintLeadSection — status label/color pins", () => {
  it.each([
    { status: "on-track", label: "On Track", color: "#006241" },
    { status: "at-risk", label: "At Risk", color: "#daa520" },
    { status: "blocked", label: "Blocked", color: "#c82014" },
  ] as const)(
    "renders '$label' with $color for status '$status'",
    ({ status, label, color }) => {
      render(<PrintLeadSection report={makeReport(status)} />);

      const badge = screen.getByText(label);
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveStyle({ backgroundColor: color });
    },
  );
});

describe("PrintLeadSection — needs-attention severity is not invented", () => {
  it("colors the attention callout by the projection's own severity, never defaulting", () => {
    const report: WeeklyProductReport = {
      ...makeReport("on-track"),
      needsAttention: "SLA breach risk",
      needsAttentionSeverity: "blocked",
    };
    render(<PrintLeadSection report={report} />);
    const callout = screen.getByText("SLA breach risk");
    // Blocked severity must render blocked ink, not the milder at-risk color.
    expect(callout).toHaveStyle({ borderLeft: "3px solid #c82014" });
  });

  it("renders no attention callout when the projection carries no attention", () => {
    render(<PrintLeadSection report={makeReport("on-track")} />);
    expect(screen.queryByText(/breach|attention/i)).not.toBeInTheDocument();
  });
});
