/**
 * @vitest-environment jsdom
 */
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

  it("is a fully rounded 32x32 control matching its toolbar siblings", () => {
    render(<VersionComingSoonControl />);
    const control = screen.getByTestId("version-coming-soon");

    expect(control.className).toContain("h-8");
    expect(control.className).toContain("w-8");
    expect(control.className).toContain("rounded-full");
  });

  it("opens the amber ComingSoonBadge tooltip on focus, via the Radix portal", async () => {
    render(<VersionComingSoonControl />);

    // Portaled: nothing is in the DOM before the control is interacted with.
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.focus(screen.getByTestId("version-coming-soon"));

    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip.textContent).toMatch(/coming soon/i);
  });
});
