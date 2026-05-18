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
  it("uses the full product grid for a single real product", () => {
    renderLeadDeck([slide()]);

    expect(screen.getByTestId("lead-slide-products")).not.toHaveClass(
      "xl:grid-cols-2",
    );
    expect(
      screen.getByTestId("lead-slide-product-" + PRODUCT_ID),
    ).not.toHaveClass("xl:col-span-2");
    expect(screen.getByText("Marketing Portal")).toBeInTheDocument();
  });

  it("groups multiple products while keeping shared context full width", () => {
    renderLeadDeck([
      slide([
        product(),
        product({
          id: PRODUCT_TWO_ID,
          name: "Data Portal",
          status: "yellow",
          currentItems: ["Close API parity"],
        }),
        product({
          id: "cross-product",
          name: "Cross-product",
          status: null,
          stages: [],
          currentItems: [],
          nextItems: [],
          risks: [],
          decisions: ["Keep one release train"],
          priorities: ["Protect launch date"],
        }),
      ]),
    ]);

    expect(screen.getByTestId("lead-slide-products")).toHaveClass(
      "xl:grid-cols-2",
    );
    expect(screen.getByTestId("lead-slide-product-cross-product")).toHaveClass(
      "xl:col-span-2",
    );
    expect(screen.getByText("Marketing Portal")).toBeInTheDocument();
    expect(screen.getByText("Data Portal")).toBeInTheDocument();
    expect(screen.getByText("Keep one release train")).toBeInTheDocument();
  });

  it("keeps long lead story content visible instead of clipping or summarizing it", () => {
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
    expect(screen.queryByText("+1 more")).not.toBeInTheDocument();
    expect(
      screen.getByTestId("lead-slide-story-" + PRODUCT_ID + "-current"),
    ).not.toHaveClass("overflow-hidden");
  });

  it("renders product content directly without score header or slide checks strip", () => {
    renderLeadDeck([slide()]);

    // Flat read-only article: no score/completion header, no checks strip
    expect(screen.queryByText("Completion")).not.toBeInTheDocument();
    expect(screen.queryByText("Slide checks")).not.toBeInTheDocument();
    expect(screen.queryByText("Readiness")).not.toBeInTheDocument();
    expect(screen.queryByText("Readiness checks")).not.toBeInTheDocument();
    // Product content is visible via ProductSdlcGroups
    expect(screen.getByText("Marketing Portal")).toBeInTheDocument();
  });

  it("renders SDLC stages as dot-separated inline text instead of chip buttons", () => {
    renderLeadDeck([slide()]);

    // Inline text "Planning · Development" (no chip buttons)
    expect(screen.getByText("Planning · Development")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Planning/i }),
    ).not.toBeInTheDocument();
  });
});
