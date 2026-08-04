// @vitest-environment jsdom

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
  it("every decorative SVG inside the header button is hidden from the a11y tree", () => {
    render(<BlockedAtRiskTable items={oneItem} />);

    // Accessible ownership: the button's name comes from its text, never from
    // the icons. Any exposed decorative svg (missing aria-hidden) fails here.
    const button = screen.getByRole("button", { name: /blocked & at risk/i });
    const svgs = button.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of svgs) {
      expect(svg).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("keeps the collapse indicator hidden when the list is empty", () => {
    const { container } = render(<BlockedAtRiskTable items={[]} />);
    const button = container.querySelector("button");
    const svgs = button?.querySelectorAll("svg") ?? [];
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of svgs) {
      expect(svg).toHaveAttribute("aria-hidden", "true");
    }
  });
});

describe("BlockedAtRiskTable — grouping by product", () => {
  const sameProduct = [
    {
      id: "r1",
      severity: "blocked" as const,
      product: "Marketing Portal",
      stage: "Dev",
      assignee: "Anna",
      description: "Vendor patch pending",
    },
    {
      id: "r2",
      severity: "at-risk" as const,
      product: "Marketing Portal",
      stage: "Testing",
      assignee: "Boris",
      description: "QA capacity short",
    },
  ];

  it("shows the shared product name once as a card header, not on every issue row", () => {
    render(<BlockedAtRiskTable items={sameProduct} />);

    fireEvent.click(screen.getByRole("button", { name: /blocked & at risk/i }));

    // The repeated product collapses to a single product-card heading; both
    // issues still render their own stage + description inside that card.
    const headings = screen.getAllByRole("heading", {
      name: "Marketing Portal",
    });
    expect(headings).toHaveLength(1);
    expect(screen.getByText("Vendor patch pending")).toBeVisible();
    expect(screen.getByText("QA capacity short")).toBeVisible();
  });

  it("renders a separate product card per product, preserving first-appearance order", () => {
    render(
      <BlockedAtRiskTable
        items={[
          ...sameProduct,
          {
            id: "r3",
            severity: "at-risk",
            product: "Billing",
            stage: "Dev",
            assignee: "Dmitry",
            description: "OAuth delay",
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /blocked & at risk/i }));

    const headings = screen.getAllByRole("heading", { level: 3 });
    expect(headings.map((h) => h.textContent)).toEqual([
      "Marketing Portal",
      "Billing",
    ]);
    // Total count badge sums across groups, not per-group.
    expect(screen.getByText("3 issues")).toBeVisible();
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

  it("is collapsed by default and expands on click when issues exist", () => {
    render(
      <BlockedAtRiskTable
        items={[
          {
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

    // Collapsed by default — the report below carries the same content.
    expect(trigger).not.toBeDisabled();
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Needs approval")).toBeVisible();
  });
});
