// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { segmentClassName, SegmentedToggle } from "./segmented-toggle";

describe("SegmentedToggle", () => {
  it("keeps compact actions at the mobile touch-target floor", () => {
    render(
      <SegmentedToggle ariaLabel="View mode">
        <a className={segmentClassName(true, { iconOnly: true })} href="/edit">
          Edit
        </a>
        <a
          className={segmentClassName(false, { iconOnly: true })}
          href="/slides"
        >
          Slides
        </a>
      </SegmentedToggle>,
    );

    const group = screen.getByRole("group", { name: "View mode" });
    expect(group).toHaveClass(
      "h-[var(--toolbar-control-h)]",
      "max-md:min-h-[var(--touch-target-min)]",
      "overflow-visible",
    );
    for (const link of screen.getAllByRole("link")) {
      expect(link).toHaveClass(
        "h-full",
        "max-md:min-h-[var(--touch-target-min)]",
        "max-md:min-w-[var(--touch-target-min)]",
      );
    }
  });

  it("keeps text segments mobile-height safe without changing desktop sizing", () => {
    const classes = segmentClassName(false);

    expect(classes).toContain("max-md:min-h-[var(--touch-target-min)]");
    expect(classes).toContain("min-w-[64px]");
  });
});
