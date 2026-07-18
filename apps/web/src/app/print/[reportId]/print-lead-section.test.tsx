/**
 * Characterization pin (sweep-doc-truth-and-canon-dupes task 1.2): the
 * rendered status label + color for each `WeeklyProductStatus` value, taken
 * before `PrintLeadSection` is rerouted from the local `printStatusLabel` to
 * the canonical `statusLabel(status, "print")`. A label mismatch after
 * rerouting fails this test instead of shipping silently.
 */
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
