import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { SectionSlideModel, SlideProduct } from "./section-slide-utils";
import { StatusSlideDeck } from "./status-slide-deck";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
  }: {
    children: ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const PRODUCT_ID = "44444444-4444-4444-8444-444444444444";
const PRODUCT_TWO_ID = "88888888-8888-4888-8888-888888888888";

function product(overrides: Partial<SlideProduct> = {}): SlideProduct {
  return {
    id: PRODUCT_ID,
    name: "Marketing Portal",
    status: "red",
    stages: [
      { id: "stage-planning", name: "Planning", status: "red" },
      { id: "stage-development", name: "Development", status: "green" },
    ],
    currentItems: ["Completed authentication module refactor"],
    nextItems: ["Plan architecture review"],
    risks: ["External API partner may delay integration"],
    decisions: ["Move IdP before month end"],
    priorities: ["Stabilize production release"],
    ...overrides,
  };
}

function slide(
  productSlides: readonly SlideProduct[] = [product()],
): SectionSlideModel {
  return {
    id: "section-1",
    ownerId: "lead-1",
    ownerName: "Vasily I.",
    ownerRole: "lead",
    status: "draft",
    submittedAt: null,
    products: productSlides
      .filter((item) => item.id !== "cross-product")
      .map((item) => item.name),
    productSlides: [...productSlides],
    productCount: productSlides.length,
    currentCount: 1,
    nextCount: 1,
    riskCount: 1,
    decisionCount: 1,
    priorityCount: 1,
    blockedCount: 1,
    atRiskCount: 0,
    score: 100,
    tone: "blocked",
    readiness: [
      {
        id: "scope",
        label: "Scope",
        status: "ready",
        detail: "1 product",
        required: true,
      },
      {
        id: "current",
        label: "Current work",
        status: "ready",
        detail: "1 item",
        required: true,
      },
    ],
    currentItems: [],
    nextItems: [],
    risks: [],
    decisions: [],
    priorities: [],
  };
}

function renderLeadDeck(slides: readonly SectionSlideModel[]) {
  render(
    <StatusSlideDeck
      slides={slides}
      selectedIndex={0}
      onSelect={() => undefined}
      title="My Status Slide"
      subtitle="Current section grouped by product and SDLC stage."
      mode="lead"
    />,
  );
}

describe("StatusSlideDeck lead layout", () => {
  it("renders the unified by-section layout", () => {
    renderLeadDeck([slide()]);

    expect(screen.getByTestId("lead-unified-slide")).toBeInTheDocument();
    // Item content visible in Current work section
    expect(
      screen.getByText("Completed authentication module refactor"),
    ).toBeInTheDocument();
    // Product attribution chip visible
    expect(screen.getAllByText("Marketing Portal").length).toBeGreaterThan(0);
  });

  it("shows items from all products in the same unified section", () => {
    renderLeadDeck([
      slide([
        product(),
        product({
          id: PRODUCT_TWO_ID,
          name: "Data Portal",
          status: "yellow",
          currentItems: ["Close API parity"],
          decisions: ["Keep one release train"],
          priorities: ["Protect launch date"],
        }),
      ]),
    ]);

    // Both products' current items appear in unified Current work section
    expect(
      screen.getByText("Completed authentication module refactor"),
    ).toBeInTheDocument();
    expect(screen.getByText("Close API parity")).toBeInTheDocument();
    // Both product names appear as attribution chips
    expect(screen.getAllByText("Marketing Portal").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Data Portal").length).toBeGreaterThan(0);
    // Cross-section content also visible
    expect(screen.getByText("Keep one release train")).toBeInTheDocument();
  });

  it("shows all items without count-based truncation", () => {
    const currentItems = [
      "Completed authentication module refactor",
      "Validated production migration checklist",
      "Fixed extremely long integration description that should wrap inside the slide instead of being clipped by the story cell",
      "Coordinated release notes with support",
    ];
    renderLeadDeck([slide([product({ currentItems })])]);

    expect(
      screen.getByText(
        "Fixed extremely long integration description that should wrap inside the slide instead of being clipped by the story cell",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Coordinated release notes with support"),
    ).toBeInTheDocument();
    // No count-based truncation at item level ("+N more" only appears in emptyForBand)
    expect(screen.queryByText("+3 more")).not.toBeInTheDocument();
  });

  it("renders product content without score header or slide checks strip", () => {
    renderLeadDeck([slide()]);

    // Flat by-section article: no score/completion header, no checks strip
    expect(screen.queryByText("Completion")).not.toBeInTheDocument();
    expect(screen.queryByText("Slide checks")).not.toBeInTheDocument();
    expect(screen.queryByText("Readiness")).not.toBeInTheDocument();
    expect(screen.queryByText("Readiness checks")).not.toBeInTheDocument();
    // Item content is visible
    expect(
      screen.getByText("Completed authentication module refactor"),
    ).toBeInTheDocument();
  });

  it("shows empty-for band when a product has no items in a section", () => {
    renderLeadDeck([
      slide([
        product({ currentItems: ["My item"] }),
        product({
          id: PRODUCT_TWO_ID,
          name: "Data Portal",
          status: "green",
          currentItems: [],
        }),
      ]),
    ]);

    // My item visible; Data Portal has no current items → empty-for band
    expect(screen.getByText("My item")).toBeInTheDocument();
    expect(screen.getByText(/empty for:.*Data Portal/)).toBeInTheDocument();
  });
});
