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
});
