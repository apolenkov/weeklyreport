/**
 * @vitest-environment jsdom
 */

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { VersionComingSoonControl } from "./version-coming-soon";

describe("VersionComingSoonControl", () => {
  it("renders an inert disabled control with Coming Soon metadata", () => {
    const { container } = render(<VersionComingSoonControl />);

    const control = container.querySelector(
      '[data-testid="version-coming-soon"]',
    );

    expect(control).not.toBeNull();
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
    const { container } = render(<VersionComingSoonControl />);

    const control = container.querySelector(
      '[data-testid="version-coming-soon"]',
    );

    expect(control?.className).toContain("h-8");
    expect(control?.className).toContain("w-8");
    expect(control?.className).toContain("rounded-full");
  });

  it("renders the ComingSoonBadge tooltip", () => {
    const { container } = render(<VersionComingSoonControl />);

    const tooltip = container.querySelector('[role="tooltip"]');

    expect(tooltip).not.toBeNull();
    expect(tooltip?.textContent).toMatch(/coming soon/i);
  });
});
