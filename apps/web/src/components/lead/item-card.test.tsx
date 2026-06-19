/**
 * @vitest-environment jsdom
 *
 * Regression catalog: verify-a11y-recommended-flip
 * Source: apps/web/src/components/lead/item-card.tsx
 *
 * In-scope rows (unit-rtl/high + snapshot):
 *  - Priority rank badge: role="img" and aria-label
 *  - Stage tags container: role="img" and aria-label
 *  - EditIcon / DeleteIcon SVGs: aria-hidden (snapshot)
 *  - Full card DOM structure (snapshot)
 */
import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ItemCard } from "./item-card";
import type { KanbanItem } from "./mock-data";

const BASE_ITEM: KanbanItem = {
  id: "item-1",
  productId: "p1",
  productName: "DevOps Tools",
  text: "Implement CI pipeline",
  status: "in-progress",
  author: "Alice Lead",
};

describe("ItemCard — priority rank badge a11y (unit-rtl/high)", () => {
  it("priority rank badge has role='img'", () => {
    render(<ItemCard item={{ ...BASE_ITEM, priorityRank: 2 }} />);
    // Two role="img" elements: priority badge and stage-tags container.
    // Disambiguate by accessible name.
    const badge = screen.getByRole("img", { name: /Priority 2/i });
    expect(badge).toBeInTheDocument();
  });

  it("priority rank badge has aria-label matching 'Priority <rank>'", () => {
    render(<ItemCard item={{ ...BASE_ITEM, priorityRank: 3 }} />);
    const badge = screen.getByRole("img", { name: "Priority 3" });
    expect(badge).toHaveAttribute("aria-label", "Priority 3");
  });
});

describe("ItemCard — stage tags container a11y (unit-rtl/high)", () => {
  it("stage tags container has role='img'", () => {
    render(<ItemCard item={{ ...BASE_ITEM, stageIds: ["S1", "S2"] }} />);
    const container = screen.getByRole("img", {
      name: /^Item stages:/,
    });
    expect(container).toBeInTheDocument();
  });

  it("stage tags container has aria-label 'Item stages: <stage-list>'", () => {
    render(<ItemCard item={{ ...BASE_ITEM, stageIds: ["S1", "S2"] }} />);
    const container = screen.getByRole("img", {
      name: "Item stages: S1, S2",
    });
    expect(container).toHaveAttribute("aria-label", "Item stages: S1, S2");
  });

  it("stage tags container shows the 'No stage set' warning when no stageIds", () => {
    render(<ItemCard item={{ ...BASE_ITEM, stageIds: [] }} />);
    const container = screen.getByRole("img", {
      name: "Item stages: No stage set",
    });
    expect(container).toHaveAttribute(
      "aria-label",
      "Item stages: No stage set",
    );
    expect(screen.getByText("No stage set")).toBeInTheDocument();
  });
});

describe("ItemCard — SVG icon aria-hidden (snapshot)", () => {
  it("EditIcon svg has aria-hidden='true'", () => {
    render(<ItemCard item={BASE_ITEM} />);
    const editButton = screen.getByRole("button", { name: "Edit" });
    const svg = editButton.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toMatchSnapshot();
  });

  it("DeleteIcon svg has aria-hidden='true'", () => {
    render(<ItemCard item={BASE_ITEM} />);
    const deleteButton = screen.getByRole("button", { name: "Delete" });
    const svg = deleteButton.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toMatchSnapshot();
  });
});

describe("ItemCard — card DOM structure (snapshot)", () => {
  it("renders card with aria-hidden icons and accessible button labels", () => {
    const { container } = render(
      <ItemCard item={{ ...BASE_ITEM, priorityRank: 1, stageIds: ["Dev"] }} />,
    );
    const card = container.querySelector('[data-testid="item-card"]');
    expect(card).toMatchSnapshot();
  });
});
