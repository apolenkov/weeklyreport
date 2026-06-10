import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

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

function renderLeadDeckWith(
  slides: readonly SectionSlideModel[],
  selectedIndex: number,
  onSelect: (index: number) => void,
) {
  render(
    <StatusSlideDeck
      slides={slides}
      selectedIndex={selectedIndex}
      onSelect={onSelect}
      title="My Status Slide"
      subtitle="Current section grouped by product and SDLC stage."
      mode="lead"
    />,
  );
}

function slideWithId(
  id: string,
  productSlides: readonly SlideProduct[] = [product()],
): SectionSlideModel {
  return { ...slide(productSlides), id };
}

describe("StatusSlideDeck lead layout", () => {
  it("renders the unified by-section layout", () => {
    renderLeadDeck([slide()]);

    expect(screen.getByTestId("lead-unified-slide")).toBeInTheDocument();
    // Item content visible in Current work section
    expect(
      screen.getByText("Completed authentication module refactor"),
    ).toBeInTheDocument();
    // Single product: no per-row attribution dot (lead-slide-quadrants)
    expect(screen.queryByTestId("row-product-dot")).not.toBeInTheDocument();
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
    // Both product names appear as dot title attributes (row-product-dot, multi-product mode)
    expect(screen.getAllByTitle("Marketing Portal").length).toBeGreaterThan(0);
    expect(screen.getAllByTitle("Data Portal").length).toBeGreaterThan(0);
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
    // No count-based truncation at item level ("+N more" appears only when items exceed MAX_ITEMS_PER_SECTION)
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

  it("does not show empty-for bands when a product has no items in a section", () => {
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

    // My item visible; "empty for:" noise band is suppressed
    expect(screen.getByText("My item")).toBeInTheDocument();
    expect(screen.queryByText(/empty for:/)).not.toBeInTheDocument();
  });
});

describe("StatusSlideDeck a11y — section ARIA attributes", () => {
  it("section has aria-label describing keyboard navigation", () => {
    renderLeadDeck([slide()]);

    const section = screen.getByTestId("lead-slides-deck");
    expect(section.tagName.toLowerCase()).toBe("section");
    expect(section).toHaveAttribute(
      "aria-label",
      "Status slide deck (use arrow keys to navigate slides)",
    );
  });

  it("section has tabIndex=0 making it a keyboard-focusable region", () => {
    renderLeadDeck([slide()]);

    const section = screen.getByTestId("lead-slides-deck");
    expect(section).toHaveAttribute("tabIndex", "0");
  });
});

describe("StatusSlideDeck a11y — keyboard navigation", () => {
  it("ArrowRight on section calls onSelect with selectedIndex+1", () => {
    const onSelect = vi.fn();
    // Two slides so ArrowRight can advance from index 0 to 1
    renderLeadDeckWith(
      [slideWithId("section-1"), slideWithId("section-2")],
      0,
      onSelect,
    );

    const section = screen.getByTestId("lead-slides-deck");
    fireEvent.keyDown(section, { key: "ArrowRight" });

    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it("ArrowLeft on section calls onSelect with selectedIndex-1", () => {
    const onSelect = vi.fn();
    renderLeadDeckWith(
      [slideWithId("section-1"), slideWithId("section-2")],
      1,
      onSelect,
    );

    const section = screen.getByTestId("lead-slides-deck");
    fireEvent.keyDown(section, { key: "ArrowLeft" });

    expect(onSelect).toHaveBeenCalledWith(0);
  });
});

describe("StatusSlideDeck a11y — carousel controls group", () => {
  it("carousel controls div has role='group'", () => {
    // showLeadControls = mode===lead && slides.length > 1
    renderLeadDeckWith(
      [slideWithId("section-1"), slideWithId("section-2")],
      0,
      () => undefined,
    );

    expect(screen.getByRole("group")).toBeInTheDocument();
  });

  it("carousel controls group has aria-label='Slide carousel controls'", () => {
    renderLeadDeckWith(
      [slideWithId("section-1"), slideWithId("section-2")],
      0,
      () => undefined,
    );

    const group = screen.getByRole("group");
    expect(group).toHaveAttribute("aria-label", "Slide carousel controls");
  });
});

describe("StatusSlideDeck a11y — LeadSlideArticle click-to-exit-fullscreen", () => {
  afterEach(() => {
    // Restore fullscreenElement and exitFullscreen after each test
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      value: null,
    });
    Reflect.deleteProperty(document, "exitFullscreen");
  });

  it("Escape keydown on article does not have defaultPrevented=true (keyboard close not suppressed)", () => {
    renderLeadDeck([slide()]);

    const article = screen.getByTestId("lead-unified-slide").closest("article");
    expect(article).not.toBeNull();

    const event = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- asserted above
    article!.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });

  it("clicking article calls exitFullscreen when document.fullscreenElement is set", () => {
    const exitFullscreen = vi.fn(() => Promise.resolve());
    document.exitFullscreen = exitFullscreen;
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      value: document.body,
    });

    renderLeadDeck([slide()]);

    const article = screen.getByTestId("lead-unified-slide").closest("article");
    expect(article).not.toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- asserted above
    fireEvent.click(article!);

    expect(exitFullscreen).toHaveBeenCalledTimes(1);
  });

  it("clicking article does NOT call exitFullscreen when document.fullscreenElement is null", () => {
    const exitFullscreen = vi.fn(() => Promise.resolve());
    document.exitFullscreen = exitFullscreen;
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      value: null,
    });

    renderLeadDeck([slide()]);

    const article = screen.getByTestId("lead-unified-slide").closest("article");
    expect(article).not.toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- asserted above
    fireEvent.click(article!);

    expect(exitFullscreen).not.toHaveBeenCalled();
  });
});
