/**
 * VA-0a/VA-0b regression: a11y assertions for LeadHistorySkeleton.
 *
 * Covers the in-scope rows from the verify-a11y catalog
 * (openspec/changes/verify-a11y-recommended-flip/design.md):
 *  - container div has role="status"                           (unit-rtl, high)
 *  - container has aria-busy="true" + aria-label="Loading history" (unit-rtl, high)
 *  - DOM snapshot to lock rendered structure               (snapshot, low)
 *
 * NOTE: The catalog's snapshot row claims "key prop set to array index"
 * as the observable behavior.  React keys are internal — they are never
 * rendered as DOM attributes — so this cannot be asserted via RTL or a
 * snapshot.  Source line 25 (`key={i}`) confirms the index-key pattern
 * directly.  The snapshot here locks the count and DOM structure instead.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LeadHistorySkeleton } from "./lead-history-skeleton";

describe("LeadHistorySkeleton — a11y regression (VA-0a)", () => {
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

describe("LeadHistorySkeleton — DOM snapshot (VA-0b)", () => {
  it("matches snapshot with count=2 (locks DOM structure and card count)", () => {
    const { container } = render(<LeadHistorySkeleton count={2} />);

    expect(container.firstChild).toMatchSnapshot();
  });
});
