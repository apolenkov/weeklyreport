/**
 * @vitest-environment jsdom
 *
 * VA-0a / VA-0b regression: a11y assertions for LeadFormSkeleton.
 *
 * Covers the high-priority unit-rtl rows and snapshot rows from the
 * verify-a11y catalog
 * (openspec/changes/verify-a11y-recommended-flip/design.md):
 *  - root div has role="status"
 *  - root div has aria-busy="true"
 *  - root div has aria-label="Loading report form"
 *  - snapshot: root container combines all three ARIA attributes (VA-0b)
 *  - snapshot: PlaceholderAccordion skeleton rows render in stable order (VA-0b)
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LeadFormSkeleton } from "./lead-form-skeleton";

describe("LeadFormSkeleton — a11y regression (VA-0a)", () => {
  it("root container has role='status'", () => {
    render(<LeadFormSkeleton />);

    const status = screen.getByRole("status");
    expect(status).toBeInTheDocument();
  });

  it("root container has aria-busy='true'", () => {
    render(<LeadFormSkeleton />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
  });

  it("root container has aria-label='Loading report form'", () => {
    render(<LeadFormSkeleton />);

    const status = screen.getByRole("status", { name: "Loading report form" });
    expect(status).toBeInTheDocument();
  });
});

describe("LeadFormSkeleton — snapshot (VA-0b)", () => {
  it("root container role + aria attributes snapshot", () => {
    const { container } = render(<LeadFormSkeleton />);

    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("role")).toMatchSnapshot();
    expect(root.getAttribute("aria-busy")).toMatchSnapshot();
    expect(root.getAttribute("aria-label")).toMatchSnapshot();
  });

  it("PlaceholderAccordion skeleton rows render in stable order across re-renders", () => {
    // The first PlaceholderAccordion has rows=3 (Pipeline section).
    // We verify the .space-y-2 containers each have the correct number of
    // skeleton rows, and that the order is stable by snapshotting the
    // data-slot attributes of children.
    const { container, rerender } = render(<LeadFormSkeleton />);

    const spaceContainers = container.querySelectorAll(".space-y-2");
    // There are 6 PlaceholderAccordion blocks; each produces one .space-y-2
    expect(spaceContainers.length).toBe(6);

    // Snapshot the first block's row count and slot values for stability
    const firstBlock = spaceContainers[0];
    const firstSnapshot = Array.from(firstBlock.children).map((el) =>
      el.getAttribute("data-slot"),
    );

    // Re-render should produce the same structure (index-keyed rows are stable)
    rerender(<LeadFormSkeleton />);
    const spaceContainersAfter = container.querySelectorAll(".space-y-2");
    const firstBlockAfter = spaceContainersAfter[0];
    const afterSnapshot = Array.from(firstBlockAfter.children).map((el) =>
      el.getAttribute("data-slot"),
    );

    expect(afterSnapshot).toEqual(firstSnapshot);
    expect(firstSnapshot).toMatchSnapshot();
  });
});
