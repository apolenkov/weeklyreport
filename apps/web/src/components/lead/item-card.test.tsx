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

import { render, screen, within } from "@testing-library/react";
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

describe("ItemCard — compact touch floor (responsive-compact-layout)", () => {
  // jsdom cannot evaluate media queries, so the accepted teeth are class
  // assertions: the icon buttons must derive their size from the shared
  // toolbar token (32px on desktop, the 44px touch floor below `md`), never
  // a hard-coded h-8/w-8.
  it.each(["Edit", "Delete"])(
    "%s icon button sizes from the toolbar control token",
    (name) => {
      render(<ItemCard item={BASE_ITEM} />);
      const button = screen.getByRole("button", { name });
      expect(button.className).toContain("h-[var(--toolbar-control-h)]");
      expect(button.className).toContain("w-[var(--toolbar-control-h)]");
    },
  );
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

describe("ItemCard — uniform height (lead-item-card-uniformity, B1)", () => {
  // Same fixed height as the section-level empty-state placeholder ("No
  // items yet" in current-week-section.tsx / next-week-section.tsx) — the
  // reference every populated card must match.
  const EMPTY_STATE_REFERENCE_HEIGHT = "150px";

  it("a short card and a long card render at the empty-state reference height", () => {
    const shortItem: KanbanItem = { ...BASE_ITEM, text: "Ship it." };
    const longItem: KanbanItem = {
      ...BASE_ITEM,
      id: "item-2",
      text: "This description runs on for several lines of body copy, the kind of text that, under the old min-height growing-column layout, would push this card taller than a short sibling sitting next to it in the same section.",
    };

    const { container: shortContainer } = render(<ItemCard item={shortItem} />);
    const { container: longContainer } = render(<ItemCard item={longItem} />);

    const shortCard = within(shortContainer).getByTestId("item-card");
    const longCard = within(longContainer).getByTestId("item-card");

    expect(shortCard.style.height).toBe(EMPTY_STATE_REFERENCE_HEIGHT);
    expect(longCard.style.height).toBe(EMPTY_STATE_REFERENCE_HEIGHT);
    expect(shortCard.style.height).toBe(longCard.style.height);
    // The old layout floored on min-height, which a long card could outgrow;
    // the static render is fixed via `height`, never `min-height`.
    expect(shortCard.style.minHeight).toBe("");
    expect(longCard.style.minHeight).toBe("");
  });

  it("the fixed chrome (status pill row, author, stage tags) is never clipped by the reference height", () => {
    const { container } = render(
      <ItemCard
        item={{ ...BASE_ITEM, priorityRank: 1, stageIds: ["S1", "S2"] }}
      />,
    );
    const card = within(container).getByTestId("item-card");
    // Top row (status pill + actions) and footer row (author + stage tags)
    // opt out of the flex column's shrink pressure via `shrink-0`, so the
    // fixed card height never compresses them below their natural size;
    // only the body text region in between (line-clamp-3) is flexible.
    const rows = Array.from(card.children);
    expect(rows[0]).toHaveClass("shrink-0");
    expect(rows[2]).toHaveClass("shrink-0");
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.getByText("Alice Lead")).toBeInTheDocument();
  });
});

describe("ItemCard — body text truncation + tooltip (lead-item-card-uniformity, B2)", () => {
  const LONG_TEXT =
    "A very long piece of item text that keeps going and going and going well past what three clamped lines can comfortably show in the card.";

  it("static render clamps the body text and exposes the full text via a title tooltip", () => {
    render(<ItemCard item={{ ...BASE_ITEM, text: LONG_TEXT }} />);
    const body = screen.getByTitle(LONG_TEXT);
    expect(body).toHaveClass("line-clamp-3");
    expect(body).toHaveTextContent(LONG_TEXT);
  });

  it("inline edit shows the full, untruncated text in the textarea", () => {
    render(<ItemCard item={{ ...BASE_ITEM, text: LONG_TEXT }} isEditing />);
    const textarea = screen.getByRole("textbox", { name: "Edit item text" });
    expect(textarea).toHaveValue(LONG_TEXT);
  });
});
