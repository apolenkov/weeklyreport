import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ReportToolbar } from "./report-toolbar";

describe("ReportToolbar", () => {
  it("renders all slots when provided", () => {
    render(
      <ReportToolbar
        periodNavigator={<span>PeriodNav</span>}
        archiveToggle={<span>Archive</span>}
        leadingExtras={<span>LeadingExtra</span>}
        trailingExtras={<span>TrailingExtra</span>}
      />,
    );
    expect(screen.getByText("PeriodNav")).toBeDefined();
    expect(screen.getByText("Archive")).toBeDefined();
    expect(screen.getByText("LeadingExtra")).toBeDefined();
    expect(screen.getByText("TrailingExtra")).toBeDefined();
  });

  it("omits leading and trailing slots when undefined", () => {
    const { container } = render(
      <ReportToolbar
        periodNavigator={<span>PeriodNav</span>}
        archiveToggle={<span>Archive</span>}
      />,
    );
    expect(screen.getByText("PeriodNav")).toBeDefined();
    expect(screen.getByText("Archive")).toBeDefined();
    // No extra text nodes besides the provided slots
    expect(container.querySelectorAll("span")).toHaveLength(2);
  });

  it("root has flex, justify-between and rounded class signature", () => {
    const { container } = render(<ReportToolbar />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain("flex");
    expect(root.className).toContain("justify-between");
    expect(root.className).toContain("rounded-");
  });
});
