import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SlideSkeleton } from "./slide-skeleton";

describe("SlideSkeleton — root loading-region contract", () => {
  it("exposes the loading status region with busy state and label", () => {
    render(<SlideSkeleton />);

    const status = screen.getByRole("status", { name: "Loading slides" });
    expect(status).toHaveAttribute("aria-busy", "true");
  });
});
