import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import type { ReportPeriod } from "../../report-sections";
import { FillFromDropdownPanel } from "./fill-from-dropdown-panel";

describe("FillFromDropdownPanel counts", () => {
  it("singularizes a count of one and pluralizes zero", () => {
    const period = {
      id: "p1",
      label: "W1",
      productCount: 1,
      itemCount: 0,
      riskCount: 1,
    } as unknown as ReportPeriod;
    render(
      <FillFromDropdownPanel
        open
        id="fill"
        pos={{ top: 0, left: 0, width: 340 }}
        panelRef={createRef()}
        pastPeriods={[period]}
        filteredPeriods={[period]}
        previousPeriodId={undefined}
        archivedHidden={false}
        search=""
        onSearchChange={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    expect(
      screen.getByText(/1 product · 0 items · 1 risk/),
    ).toBeInTheDocument();
  });

  it("applies vertical bounding styles to the panel container", () => {
    const period = {
      id: "p1",
      label: "W1",
      productCount: 1,
      itemCount: 0,
      riskCount: 1,
    } as unknown as ReportPeriod;
    render(
      <FillFromDropdownPanel
        open
        id="fill-bounded"
        pos={{ top: 116, left: 16, width: 340, maxHeight: 168 }}
        panelRef={createRef()}
        pastPeriods={[period]}
        filteredPeriods={[period]}
        previousPeriodId={undefined}
        archivedHidden={false}
        search=""
        onSearchChange={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    const panel = screen.getByRole("region", { name: "Past reports" });
    expect(panel.style.top).toBe("116px");
    expect(panel.style.maxHeight).toBe("168px");
    expect(panel.className).toContain("flex-col");
  });
});
