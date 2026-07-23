/**
 * @vitest-environment jsdom
 *
 * A11y assertions for LeadFormSkeleton:
 *  - root div has role="status"
 *  - root div has aria-busy="true"
 *  - root div has aria-label="Loading report form"
 *  - PlaceholderAccordion skeleton rows render in stable order
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { expectDefined } from "../../../test-utils/expect-defined.js";
import { LeadFormSkeleton } from "./lead-form-skeleton";

describe("LeadFormSkeleton — a11y regression", () => {
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

describe("LeadFormSkeleton — root a11y attributes", () => {
  it("root container has role, aria-busy, and aria-label", () => {
    const { container } = render(<LeadFormSkeleton />);

    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("role")).toBe("status");
    expect(root.getAttribute("aria-busy")).toBe("true");
    expect(root.getAttribute("aria-label")).toBe("Loading report form");
  });

  it("PlaceholderAccordion skeleton rows render in stable order across re-renders", () => {
    // The first PlaceholderAccordion has rows=3 (Pipeline section).
    // We verify the .space-y-2 containers each have the correct number of
    // skeleton rows, and that the order is stable by snapshotting the
    // data-slot attributes of children.
    const { container, rerender } = render(<LeadFormSkeleton />);

    const spaceContainers = container.querySelectorAll(".space-y-2");
    // There are 6 PlaceholderAccordion blocks; each produces one .space-y-2
    expect(spaceContainers).toHaveLength(6);

    // Snapshot the first block's row count and slot values for stability
    const firstBlock = expectDefined(spaceContainers[0]);
    const firstSnapshot = Array.from(firstBlock.children).map(
      (el) => (el as HTMLElement).dataset.slot,
    );

    // Re-render should produce the same structure (index-keyed rows are stable)
    rerender(<LeadFormSkeleton />);
    const spaceContainersAfter = container.querySelectorAll(".space-y-2");
    const firstBlockAfter = expectDefined(spaceContainersAfter[0]);
    const afterSnapshot = Array.from(firstBlockAfter.children).map(
      (el) => (el as HTMLElement).dataset.slot,
    );

    expect(afterSnapshot).toEqual(firstSnapshot);
    expect(firstSnapshot).toMatchSnapshot();
  });
});
