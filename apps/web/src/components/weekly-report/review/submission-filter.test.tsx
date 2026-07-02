/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DraftHiddenSignal, SubmissionFilterToggle } from "./submission-filter";

describe("SubmissionFilterToggle — compact touch floor (responsive-compact-layout)", () => {
  it("the Submitted|All toggle consumes the shared toolbar height token", () => {
    // jsdom cannot evaluate media queries; the class assertion is the teeth.
    // The segments fill the SegmentedToggle track, whose height comes from
    // --toolbar-control-h (32px on desktop, the touch floor below `md`).
    render(<SubmissionFilterToggle value="submitted" onChange={vi.fn()} />);

    const track = screen.getByRole("group", { name: "Section filter" });
    expect(track.className).toContain("h-[var(--toolbar-control-h)]");
    for (const name of ["Submitted", "All"]) {
      expect(screen.getByRole("button", { name }).className).toContain(
        "h-full",
      );
    }
  });

  it("flips the filter through onChange", () => {
    const onChange = vi.fn();
    render(<SubmissionFilterToggle value="submitted" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "All" }));
    expect(onChange).toHaveBeenCalledWith("all");
  });
});

describe("DraftHiddenSignal — compact touch floor (responsive-compact-layout)", () => {
  it("names the hidden count and floors 'Show all' at the touch target below md", () => {
    const onShowAll = vi.fn();
    render(<DraftHiddenSignal count={2} onShowAll={onShowAll} />);

    expect(
      screen.getByText("2 sections in draft, hidden by the Submitted filter."),
    ).toBeInTheDocument();

    const showAll = screen.getByRole("button", { name: "Show all" });
    expect(showAll.className).toContain(
      "max-md:min-h-[var(--touch-target-min)]",
    );

    fireEvent.click(showAll);
    expect(onShowAll).toHaveBeenCalledTimes(1);
  });
});
