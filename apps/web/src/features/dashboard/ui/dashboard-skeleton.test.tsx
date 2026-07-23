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
    expect(container.querySelector(".overflow-x-auto")).not.toBeInTheDocument();
  });
});
