import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LeadFormPastPeriodBanner } from "./lead-form-past-period-banner";

describe("LeadFormPastPeriodBanner", () => {
  // A submitted past period is still read-only context; the banner explains it.
  it("shows for a pinned report that is not the active one", () => {
    render(
      <LeadFormPastPeriodBanner
        pinnedReportId="report-old"
        activeReportId="report-new"
      />,
    );
    expect(
      screen.getByText("Viewing past period. This form is read-only."),
    ).toBeInTheDocument();
  });

  it.each([
    ["the pinned report is active", "report-new", "report-new"],
    ["no report is pinned", undefined, "report-new"],
    ["no active report exists", "report-old", null],
  ] as const)("stays hidden when %s", (_case, pinned, active) => {
    const { container } = render(
      <LeadFormPastPeriodBanner
        pinnedReportId={pinned}
        activeReportId={active}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
