/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it } from "vitest";

import { BlockedAtRiskTable } from "./blocked-at-risk-table";

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
