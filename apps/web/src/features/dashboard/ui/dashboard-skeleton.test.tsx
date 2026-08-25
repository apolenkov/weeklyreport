import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DashboardSkeleton } from "./dashboard-skeleton";

describe("DashboardSkeleton", () => {
  it("matches the canonical five-row queue without a horizontal table rail", () => {
    const { container } = render(<DashboardSkeleton />);

    expect(screen.getAllByTestId("dashboard-queue-skeleton-row")).toHaveLength(
      5,
    );
    for (const row of screen.getAllByTestId("dashboard-queue-skeleton-row")) {
      expect(row).toHaveClass("min-h-[4.875rem]");
      expect(row).toHaveClass(
        "lg:grid-cols-[minmax(11rem,1.3fr)_minmax(9rem,0.8fr)_minmax(10rem,1fr)_minmax(9rem,0.8fr)_var(--dashboard-summary-action-w)_var(--dashboard-summary-action-w)]",
      );
    }
    expect(container.querySelector(".overflow-x-auto")).not.toBeInTheDocument();
  });
});
