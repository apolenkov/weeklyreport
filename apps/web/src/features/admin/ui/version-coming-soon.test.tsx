// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { VersionComingSoonControl } from "./version-coming-soon";

describe("VersionComingSoonControl", () => {
  it("renders an inert disabled control with Coming Soon metadata", () => {
    render(<VersionComingSoonControl />);
    const control = screen.getByTestId("version-coming-soon");

    expect(control).toHaveAttribute(
      "aria-label",
      "Version history is coming soon",
    );
    // No native title — the aria-label carries the name and the amber
    // ComingSoonBadge renders the visual tooltip. A stacked title="Coming Soon"
    // would double the tooltip on hover (see coming-soon-style.test.tsx).
    expect(control).not.toHaveAttribute("title");
    expect(control).toHaveAttribute("aria-disabled", "true");
  });

  it("derives its circle size from the shared toolbar token like its siblings", () => {
    // ui-control-density: token is 32px desktop and rises to the touch floor
    // below `md` — hard-coded h-8/w-8 would stay 32px while siblings grow.
    render(<VersionComingSoonControl />);
    const control = screen.getByTestId("version-coming-soon");

    expect(control.className).toContain("h-[var(--toolbar-control-h)]");
    expect(control.className).toContain("w-[var(--toolbar-control-h)]");
    expect(control.className).toContain("rounded-full");
  });

  it("opens the amber ComingSoonBadge tooltip on focus, via the Radix portal", async () => {
    render(<VersionComingSoonControl />);

    // Portaled: nothing is in the DOM before the control is interacted with.
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.focus(screen.getByTestId("version-coming-soon"));

    await screen.findByRole("tooltip");
    // The visible amber badge lives in the Radix content; the sr-only
    // `role="tooltip"` description is intentionally blanked so the control's
    // own aria-label is the single coming-soon source (no double-announce).
    const content = document.querySelector('[data-slot="tooltip-content"]');
    expect(content?.textContent).toMatch(/coming soon/i);
  });
});
