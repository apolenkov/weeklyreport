// @vitest-environment jsdom

import {
  buildEscalationsFromReadSections,
  reportSectionReadModelSchema,
} from "@customreport/shared";
import { fireEvent, render, screen, within } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";

import { makeReportSectionFixture } from "../../../test-utils/report-section-fixtures";
import {
  escalationToBlockedItem,
  groupByProduct,
} from "../model/dashboard-escalations";
import { ProductCard } from "./blocked-at-risk-product-card";
import { BlockedAtRiskTable } from "./blocked-at-risk-table";

const oneItem = [
  {
    productId: "10000000-0000-4000-8000-000000000001",
    authorId: "10000000-0000-4000-8000-000000000002",
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
      productId: "10000000-0000-4000-8000-000000000001",
      authorId: "10000000-0000-4000-8000-000000000002",
      severity: "blocked" as const,
      product: "Marketing Portal",
      stage: "Dev",
      assignee: "Anna",
      description: "Vendor patch pending",
    },
    {
      productId: "10000000-0000-4000-8000-000000000001",
      authorId: "10000000-0000-4000-8000-000000000003",
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
    expect(screen.getAllByText("Marketing Portal")).toHaveLength(1);
    const card = headings[0]?.closest("div.overflow-hidden");
    if (!(card instanceof HTMLElement))
      throw new TypeError("expected product card");
    expect(within(card).getByText("MP")).toBeVisible();
    expect(within(card).getByText("Anna · Boris")).toBeVisible();
    expect(within(card).getAllByText("Blocked")).toHaveLength(2);
    expect(within(card).getByText("At risk")).toBeVisible();

    const blockedRow = card.querySelector('[data-blocked-row="blocked"]');
    const atRiskRow = card.querySelector('[data-blocked-row="at-risk"]');
    if (
      !(blockedRow instanceof HTMLElement) ||
      !(atRiskRow instanceof HTMLElement)
    ) {
      throw new TypeError("expected issue rows");
    }
    expect(blockedRow).toHaveTextContent("DevAnnaVendor patch pendingBlocked");
    expect(atRiskRow).toHaveTextContent("TestingBorisQA capacity shortAt risk");
  });

  it("renders a separate product card per product, preserving first-appearance order", () => {
    render(
      <BlockedAtRiskTable
        items={[
          ...sameProduct,
          {
            productId: "10000000-0000-4000-8000-000000000004",
            authorId: "10000000-0000-4000-8000-000000000005",
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
    const billingHeader = screen.getByRole("heading", {
      name: "Billing",
    }).parentElement;
    if (!billingHeader) throw new Error("expected billing header");
    expect(within(billingHeader).getByText("At risk")).toHaveStyle({
      color: "var(--color-status-at-risk-fg)",
    });
    // Total count badge sums across groups, not per-group.
    expect(screen.getByText("3 issues")).toBeVisible();
  });

  it("uses the singular noun when exactly one issue exists", () => {
    render(<BlockedAtRiskTable items={oneItem} />);
    expect(screen.getByText("1 issue")).toBeVisible();
    expect(screen.queryByText("1 issues")).toBeNull();
  });

  it("keeps a red product header when its remaining concrete row is at risk", () => {
    const item = oneItem[0];
    if (!item) throw new Error("expected blocked fixture");
    render(
      <BlockedAtRiskTable
        items={[
          {
            ...item,
            severity: "at-risk",
            productFlaggedRed: true,
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /blocked & at risk/i }));

    expect(screen.getByText("At risk")).toBeVisible();
    expect(screen.getByTestId("product-header-status")).toHaveTextContent(
      "Flagged red",
    );
    expect(screen.queryByText("Blocked")).toBeNull();
  });

  it("labels the header Blocked when a blocked row backs it (R26)", () => {
    render(<BlockedAtRiskTable items={oneItem} />);

    fireEvent.click(screen.getByRole("button", { name: /blocked & at risk/i }));

    expect(screen.getByTestId("product-header-status")).toHaveTextContent(
      "Blocked",
    );
  });

  it("renders separate cards for distinct products with the same display name", () => {
    const first = sameProduct[0];
    const second = sameProduct[1];
    if (!first || !second) throw new Error("expected two product fixtures");

    render(
      <BlockedAtRiskTable
        items={[
          first,
          {
            ...second,
            productId: "10000000-0000-4000-8000-000000000006",
            description: "Other same-name product",
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /blocked & at risk/i }));

    expect(
      screen.getAllByRole("heading", { name: "Marketing Portal" }),
    ).toHaveLength(2);
    expect(screen.getByText("Vendor patch pending")).toBeVisible();
    expect(screen.getByText("Other same-name product")).toBeVisible();
  });
});

describe("BlockedAtRiskTable", () => {
  it("keeps the empty heading and count readable while disabling the toggle", () => {
    render(<BlockedAtRiskTable items={[]} />);

    const trigger = screen.getByRole("button", {
      name: /blocked & at risk/i,
    });

    expect(trigger).toBeDisabled();
    expect(trigger).toHaveAttribute("aria-disabled", "true");
    expect(trigger).toHaveClass("cursor-default");
    expect(trigger.className).not.toMatch(/(?:^|\s)opacity-/);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Blocked & At Risk")).toBeVisible();
    expect(screen.getByText("Blocked & At Risk")).toHaveClass(
      "text-[var(--color-muted-foreground)]",
    );
    expect(screen.getByText("0 issues")).toBeVisible();
    expect(screen.getByText("0 issues")).toHaveClass(
      "text-[var(--color-muted-foreground)]",
    );

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("is collapsed by default and expands on click when issues exist", () => {
    const { container } = render(
      <BlockedAtRiskTable
        items={[
          {
            productId: "10000000-0000-4000-8000-000000000001",
            authorId: "10000000-0000-4000-8000-000000000002",
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
    const panel = container.querySelector("[style*='grid-template-rows']");
    expect(panel).toHaveClass("motion-reduce:transition-none");
    expect(panel).toHaveStyle({ gridTemplateRows: "0fr" });
    expect(trigger.querySelector("svg.lucide-chevron-down")).toHaveClass(
      "motion-reduce:transition-none",
    );

    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(panel).toHaveStyle({ gridTemplateRows: "1fr" });
    expect(screen.getByText("Needs approval")).toBeVisible();
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(panel).toHaveStyle({ gridTemplateRows: "0fr" });
  });
});

describe("ProductCard — admitted repeated risks and canonical avatars", () => {
  function admittedGroup(duplicate: boolean) {
    const projectId = "90000000-0000-4000-8000-000000000001";
    const risks = [
      {
        id: "90000000-0000-4000-8000-000000000002",
        stableId: "90000000-0000-4000-8000-000000000003",
        projectId,
        risk: "Needs approval",
        impact: "Delayed",
        mitigation: "Ask owner",
        severity: "blocked" as const,
        stageNames: ["Testing"],
      },
      {
        id: "90000000-0000-4000-8000-000000000004",
        stableId: "90000000-0000-4000-8000-000000000005",
        projectId,
        risk: duplicate ? "Needs approval" : "Other approval",
        impact: "Delayed",
        mitigation: "Ask owner",
        severity: "blocked" as const,
        stageNames: ["Testing"],
      },
    ];
    const section = reportSectionReadModelSchema.parse(
      makeReportSectionFixture({
        projects: [
          { projectId, projectName: "Billing", trafficLight: "green" },
        ],
        risks,
      }),
    );
    const group = groupByProduct(
      buildEscalationsFromReadSections([section])
        .filter((row) => row.type === "blocked")
        .map(escalationToBlockedItem),
    )[0];
    if (!group) throw new Error("Expected admitted product group");
    return group;
  }
  it.each([true, false])(
    "retains all admitted risks without duplicate keys, duplicate=%s",
    (duplicate) => {
      const errors = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      try {
        const group = admittedGroup(duplicate);
        const rendered = render(<ProductCard group={group} />);
        expect(
          rendered.container.querySelectorAll("[data-blocked-row]"),
        ).toHaveLength(2);
        const keyWarnings = errors.mock.calls.filter((args) =>
          args.some(
            (arg) => typeof arg === "string" && arg.includes("same key"),
          ),
        );

        const first = group.items[0];
        if (!first) throw new Error("Expected admitted risk");
        rendered.rerender(<ProductCard group={{ ...group, items: [first] }} />);
        expect(
          rendered.container.querySelectorAll("[data-blocked-row]"),
        ).toHaveLength(1);
        rendered.rerender(<ProductCard group={group} />);
        expect(
          rendered.container.querySelectorAll("[data-blocked-row]"),
        ).toHaveLength(2);
        expect(keyWarnings).toEqual([]);
      } finally {
        errors.mockRestore();
      }
    },
  );
  it.each([
    ["Billing", "BI"],
    ["Marketing Portal", "MP"],
    ["😀 Portal", "😀P"],
    [" ".repeat(3), "??"],
  ])("uses the existing canonical avatar for %s", (product, initials) => {
    render(<ProductCard group={{ ...admittedGroup(false), product }} />);
    expect(screen.getByText(initials)).toBeInTheDocument();
  });
});
