import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { WeeklyPortfolioProduct } from "../../../features/report-sections";
import { PrintPortfolioTable } from "./print-portfolio-table";

function makeProduct(
  status: WeeklyPortfolioProduct["status"],
): WeeklyPortfolioProduct {
  return {
    id: `product-${status}`,
    initials: "PR",
    name: `Product ${status}`,
    hasContent: true,
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
    { status: "at-risk", label: "At Risk", color: "#856800" },
    { status: "blocked", label: "Blocked", color: "#c82014" },
    { status: "empty", label: "No status", color: "#6b7280" },
  ] as const)(
    "renders '$label' with $color for status '$status'",
    ({ status, label, color }) => {
      render(<PrintPortfolioTable products={[makeProduct(status)]} />);

      const badge = screen.getByText(label);
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveStyle({ backgroundColor: color });
    },
  );

  it("keeps a 200-character product name inside the fixed-width print table", () => {
    const product = { ...makeProduct("on-track"), name: "P".repeat(200) };
    const { container } = render(<PrintPortfolioTable products={[product]} />);

    expect(container.querySelector("table")).toHaveStyle({
      tableLayout: "fixed",
    });
    expect(screen.getByText(product.name)).toHaveStyle({
      overflowWrap: "anywhere",
    });
  });
});
