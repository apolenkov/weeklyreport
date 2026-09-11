import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ReportBreadcrumb } from "./report-breadcrumb";

describe("ReportBreadcrumb", () => {
  it("renders the report period as the current crumb under a Reports link", () => {
    render(<ReportBreadcrumb label="Week 34, Aug 17–23, 2026" />);

    expect(
      screen.getByRole("navigation", { name: "Breadcrumb" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Week 34, Aug 17–23, 2026")).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Reports" })).toHaveAttribute(
      "href",
      "/reports",
    );
  });
});
