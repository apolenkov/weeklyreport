/**
 * Characterization pin (sweep-doc-truth-and-canon-dupes task 1.3): asserts
 * the shared `PlusIcon`'s markup matches what `policy-form.tsx`'s local copy
 * currently renders (viewBox, stroke, strokeWidth, `<line>` coordinates),
 * taken before that local copy and its re-export are removed.
 */
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PlusIcon } from "./icons";

describe("PlusIcon", () => {
  it("renders the pinned cross-glyph markup", () => {
    const { container } = render(<PlusIcon />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
    expect(svg).toHaveAttribute("stroke", "currentColor");
    expect(svg).toHaveAttribute("stroke-width", "2");
    expect(svg).toHaveAttribute("fill", "none");
    expect(svg).toHaveAttribute("aria-hidden", "true");

    const lines = container.querySelectorAll("line");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toHaveAttribute("x1", "12");
    expect(lines[0]).toHaveAttribute("y1", "5");
    expect(lines[0]).toHaveAttribute("x2", "12");
    expect(lines[0]).toHaveAttribute("y2", "19");
    expect(lines[1]).toHaveAttribute("x1", "5");
    expect(lines[1]).toHaveAttribute("y1", "12");
    expect(lines[1]).toHaveAttribute("x2", "19");
    expect(lines[1]).toHaveAttribute("y2", "12");
  });
});
