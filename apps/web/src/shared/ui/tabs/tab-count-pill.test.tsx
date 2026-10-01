// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TabCountPill } from "./tab-count-pill";

describe("TabCountPill", () => {
  it("sits beside the label instead of over its last letter", () => {
    render(<TabCountPill ariaLabel="3 pending" count={3} testId="pill" />);
    const pill = screen.getByTestId("pill");
    expect(pill).toHaveClass("absolute", "left-full");
    // -right-3 pulled the 16px pill 4px back over the label text.
    expect(pill.className).not.toMatch(/-right-/);
  });

  it("renders nothing for a zero count unless unavailable", () => {
    const { container } = render(<TabCountPill ariaLabel="none" count={0} />);
    expect(container).toBeEmptyDOMElement();
  });
});
