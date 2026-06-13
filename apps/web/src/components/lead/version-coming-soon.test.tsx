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
    expect(control).toHaveAttribute("title", "Coming Soon");
    expect(control).toHaveAttribute("aria-disabled", "true");
  });

  it("renders the ComingSoonBadge tooltip", () => {
    const { container } = render(<VersionComingSoonControl />);

    const tooltip = container.querySelector('[role="tooltip"]');

    expect(tooltip).not.toBeNull();
    expect(tooltip?.textContent).toMatch(/coming soon/i);
  });
});
