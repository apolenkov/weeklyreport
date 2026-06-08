/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it } from "vitest";

import { BlockedAtRiskTable } from "./blocked-at-risk-table";

const oneItem = [
  {
    id: "risk-1",
    severity: "blocked" as const,
    product: "Billing",
    stage: "Testing",
    assignee: "Dmitry",
    description: "Needs approval",
  },
];

describe("BlockedAtRiskTable — aria-hidden on decorative SVG icons", () => {
  it("AlertIcon svg has aria-hidden=true so screen readers skip the decorative icon", () => {
    render(<BlockedAtRiskTable items={oneItem} />);

    // AlertIcon is the first svg inside the button header
    const button = screen.getByRole("button", { name: /blocked & at risk/i });
    const alertSvg = button.querySelector("svg");

    expect(alertSvg).not.toBeNull();
    expect(alertSvg).toHaveAttribute("aria-hidden", "true");
  });

  it("ChevronDown svg has aria-hidden=true so screen readers skip the collapse indicator", () => {
    render(<BlockedAtRiskTable items={oneItem} />);

    // ChevronDown is the last svg inside the button header (after AlertIcon)
    const button = screen.getByRole("button", { name: /blocked & at risk/i });
    const svgs = button.querySelectorAll("svg");

    // There are exactly two svgs in the button: AlertIcon + ChevronDown
    expect(svgs.length).toBe(2);
    const chevronSvg = svgs[1];
    expect(chevronSvg).toHaveAttribute("aria-hidden", "true");

    // Also verify with empty items — ChevronDown still renders (with opacity)
    const { container: emptyContainer } = render(
      <BlockedAtRiskTable items={[]} />,
    );
    const emptyButton = emptyContainer.querySelector("button");
    const emptySvgs = emptyButton?.querySelectorAll("svg");
    expect(emptySvgs?.length).toBe(2);
    expect(emptySvgs?.[1]).toHaveAttribute("aria-hidden", "true");
  });
});

describe("BlockedAtRiskTable", () => {
  it("mutes and disables the accordion when there are no issues", () => {
    render(<BlockedAtRiskTable items={[]} />);

    const trigger = screen.getByRole("button", {
      name: /blocked & at risk/i,
    });

    expect(trigger).toBeDisabled();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("0 issues")).toBeVisible();
  });

  it("adds top spacing and remains collapsible when issues exist", () => {
    render(
      <BlockedAtRiskTable
        items={[
          {
            id: "risk-1",
            severity: "blocked",
            product: "Billing",
            stage: "Testing",
            assignee: "Dmitry",
            description: "Needs approval",
          },
        ]}
      />,
    );

    const trigger = screen.getByRole("button", {
      name: /blocked & at risk/i,
    });

    expect(trigger).not.toBeDisabled();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Needs approval")).toBeVisible();

    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});
