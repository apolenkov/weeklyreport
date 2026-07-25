import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LeadHistorySkeleton } from "./lead-history-skeleton";

describe("LeadHistorySkeleton — a11y regression", () => {
  it("container div has role='status'", () => {
    render(<LeadHistorySkeleton />);

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("container has aria-busy='true' and aria-label='Loading history'", () => {
    render(<LeadHistorySkeleton />);

    const container = screen.getByRole("status");
    expect(container).toHaveAttribute("aria-busy", "true");
    expect(container).toHaveAttribute("aria-label", "Loading history");
  });
});

describe("LeadHistorySkeleton — DOM snapshot", () => {
  it("matches snapshot with count=2 (locks DOM structure and card count)", () => {
    const { container } = render(<LeadHistorySkeleton count={2} />);

    expect(container.firstChild).toMatchSnapshot();
  });
});
