/**
 * Characterization pin (sweep-doc-truth-and-canon-dupes task 1.2): the
 * rendered status label + color for each `WeeklyProductStatus` value, taken
 * before `PrintPortfolioTable` is rerouted from the local `printStatusLabel`
 * to the canonical `statusLabel(status, "print")`. A label mismatch after
 * rerouting fails this test instead of shipping silently.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { WeeklyPortfolioProduct } from "../../../features/report-sections/model/weekly-report-types";
import { PrintPortfolioTable } from "./print-portfolio-table";

function makeProduct(
  status: WeeklyPortfolioProduct["status"],
): WeeklyPortfolioProduct {
  return {
    id: `product-${status}`,
    initials: "PR",
    name: `Product ${status}`,
    status,
    statusLabel: status,
    leads: "Alex Lead",
    currentWeekCount: 1,
    nextWeekCount: 1,
    riskCount: status === "blocked" ? 1 : 0,
  };
}

describe("PrintPortfolioTable — status label/color pins", () => {
  it.each([
    { status: "on-track", label: "On Track", color: "#006241" },
    { status: "at-risk", label: "At Risk", color: "#daa520" },
    { status: "blocked", label: "Blocked", color: "#c82014" },
  ] as const)(
    "renders '$label' with $color for status '$status'",
    ({ status, label, color }) => {
      render(<PrintPortfolioTable products={[makeProduct(status)]} />);

      const badge = screen.getByText(label);
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveStyle({ backgroundColor: color });
    },
  );
});
