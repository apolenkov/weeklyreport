// @vitest-environment jsdom
// Fill From says which of the source week's records it leaves behind
// (openspec: lead-incomplete-record-drafts, task 5.5).
import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ReportPeriod } from "../../report-sections";
import { FillFromButton } from "./fill-from-button";

const period = (retainedDraftCount?: number): ReportPeriod => ({
  id: "2026-W16",
  periodStart: new Date("2026-04-14T00:00:00.000Z"),
  dateRange: "Apr 14–20, 2026",
  sourceSectionId: "sec-W16",
  weekLabel: "Week 16",
  isCurrent: false,
  isSubmitted: true,
  retainedDraftCount,
});

function openConfirmation(source: ReportPeriod) {
  render(<FillFromButton periods={[source]} onFillFrom={vi.fn()} />);
  fireEvent.click(
    screen.getByRole("button", {
      name: "Fill from most recent submitted period",
    }),
  );
  return screen.getByRole("alertdialog", { name: "Fill from Week 16?" });
}

describe("Fill From confirmation: unfinished source drafts", () => {
  it("says the source week's unfinished drafts are not copied and where to read them", () => {
    const dialog = openConfirmation(period(2));

    expect(dialog).toHaveTextContent(
      "2 unfinished drafts from that week will not be copied. You can read them in History.",
    );
    expect(screen.getByRole("link", { name: "History" })).toHaveAttribute(
      "href",
      "/reports",
    );
  });

  it("says nothing when the source keeps no unfinished drafts", () => {
    const dialog = openConfirmation(period());

    expect(dialog).not.toHaveTextContent("will not be copied");
    expect(screen.queryByRole("link", { name: "History" })).toBeNull();
  });
});
