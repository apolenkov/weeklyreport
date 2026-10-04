import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SlideDensityControl } from "../slide-density-control";

describe("SlideDensityControl", () => {
  it("uses the neutral context-toggle token for the active segment", () => {
    render(<SlideDensityControl value="document" onChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Document" })).toHaveClass(
      "bg-[var(--color-toggle-active)]",
    );
  });

  // R08: two visually identical segmented pills in the slides toolbar read as
  // peers; a muted "Format" caption nests the density group semantically.
  it("names the group with a visible Format caption", () => {
    render(<SlideDensityControl value="document" onChange={vi.fn()} />);

    expect(screen.getByText("Format")).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Slide density" }),
    ).toBeInTheDocument();
  });
});
