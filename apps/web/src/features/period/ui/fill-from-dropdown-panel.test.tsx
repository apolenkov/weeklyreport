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
        pos={{ top: 0, right: 0 }}
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
});
