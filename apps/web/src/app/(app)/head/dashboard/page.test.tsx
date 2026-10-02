// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../../features/dashboard", () => ({
  DashboardPage: () => <div data-testid="dashboard-page" />,
}));

import HeadDashboardPage from "./page";

describe("HeadDashboardPage", () => {
  it("renders the dashboard on a focusable main target", () => {
    render(<HeadDashboardPage />);

    expect(screen.getByTestId("dashboard-page")).toBeInTheDocument();
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main-content");
    expect(main).toHaveAttribute("tabindex", "-1");
  });
});
