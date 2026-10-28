// @vitest-environment jsdom
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
  it("keeps polite live-region mounted when count is 0 and updates text upon rerender", () => {
    const onShowAll = vi.fn();
    const { rerender } = render(
      <DraftHiddenSignal count={0} onShowAll={onShowAll} />,
    );

    const liveRegion = screen.getByRole("status");
    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion).toHaveAttribute("aria-live", "polite");
    expect(liveRegion).toHaveTextContent("");
    expect(
      screen.queryByRole("button", {
        name: "Show all sections including drafts",
      }),
    ).not.toBeInTheDocument();

    rerender(<DraftHiddenSignal count={3} onShowAll={onShowAll} />);

    expect(screen.getByRole("status")).toBe(liveRegion);
    expect(liveRegion).toHaveTextContent(
      "3 sections in draft, hidden by the Submitted filter.",
    );
    // Button is rendered outside the live region to prevent duplicate AT announcements
    expect(liveRegion).not.toContainElement(
      screen.getByRole("button", {
        name: "Show all sections including drafts",
      }),
    );
    expect(
      screen.getByRole("button", {
        name: "Show all sections including drafts",
      }),
    ).toBeInTheDocument();
  });

  it("announces via role='status' with aria-live='polite' and contextual button label", () => {
    const onShowAll = vi.fn();
    render(<DraftHiddenSignal count={3} onShowAll={onShowAll} />);

    expect(screen.getByTestId("draft-hidden-signal")).toBeInTheDocument();
    const notice = screen.getByRole("status");
    expect(notice).toHaveAttribute("aria-live", "polite");
    expect(notice).toHaveTextContent(
      "3 sections in draft, hidden by the Submitted filter.",
    );

    const button = screen.getByRole("button", {
      name: "Show all sections including drafts",
    });
    expect(button).toBeInTheDocument();
  });

  it("names the hidden count and floors 'Show all' at the touch target below md", () => {
    const onShowAll = vi.fn();
    render(<DraftHiddenSignal count={2} onShowAll={onShowAll} />);

    expect(
      screen.getByText("2 sections in draft, hidden by the Submitted filter."),
    ).toBeInTheDocument();

    const showAll = screen.getByRole("button", {
      name: "Show all sections including drafts",
    });
    expect(showAll.className).toContain(
      "max-md:min-h-[var(--touch-target-min)]",
    );

    fireEvent.click(showAll);
    expect(onShowAll).toHaveBeenCalledTimes(1);
  });
});
