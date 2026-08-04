import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LeadHistorySkeleton } from "./lead-history-skeleton";

describe("LeadHistorySkeleton — a11y regression", () => {
  it("exposes the loading status region with busy + label in one assertion set", () => {
    render(<LeadHistorySkeleton />);

    const container = screen.getByRole("status", { name: "Loading history" });
    expect(container).toHaveAttribute("aria-busy", "true");
  });
});
