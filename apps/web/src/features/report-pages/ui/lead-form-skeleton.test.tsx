/**
 * @vitest-environment jsdom
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

  it("PlaceholderAccordion skeleton rows render in the expected order", () => {
    const { container } = render(<LeadFormSkeleton />);

    const spaceContainers = container.querySelectorAll(".space-y-2");
    expect(spaceContainers).toHaveLength(6);

    const firstBlock = expectDefined(spaceContainers[0]);
    const firstSnapshot = Array.from(firstBlock.children).map(
      (el) => (el as HTMLElement).dataset.slot,
    );

    expect(firstSnapshot).toMatchSnapshot();
  });
});
