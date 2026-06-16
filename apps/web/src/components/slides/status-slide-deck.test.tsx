import { fireEvent, render, screen, within } from "@testing-library/react";
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

describe("StatusSlideDeck lead — product chip filter (slides-product-autofit)", () => {
  function twoProducts(): SlideProduct[] {
    return [
      product(),
      product({
        id: PRODUCT_TWO_ID,
        name: "Data Portal",
        status: "yellow",
        currentItems: ["Close API parity"],
        nextItems: ["Draft data contract"],
        risks: ["Schema drift"],
        decisions: ["Keep one release train"],
        priorities: ["Protect launch date"],
      }),
    ];
  }

  it("clicking a chip scopes the quadrants to that product and marks it selected", () => {
    renderLeadDeck([slide(twoProducts())]);

    fireEvent.click(screen.getByRole("tab", { name: "Data Portal" }));

    // Only the picked product's rows remain in the quadrants.
    expect(screen.getByText("Close API parity")).toBeInTheDocument();
    expect(
      screen.queryByText("Completed authentication module refactor"),
    ).not.toBeInTheDocument();
    // The strip still lists every product, with a truthful selection state.
    expect(screen.getByRole("tab", { name: "Data Portal" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByRole("tab", { name: "Marketing Portal" }),
    ).toHaveAttribute("aria-selected", "false");
  });

  it("clicking the active chip again restores the all-products view", () => {
    renderLeadDeck([slide(twoProducts())]);

    const chip = screen.getByRole("tab", { name: "Data Portal" });
    fireEvent.click(chip);
    fireEvent.click(chip);

    expect(screen.getByText("Close API parity")).toBeInTheDocument();
    expect(
      screen.getByText("Completed authentication module refactor"),
    ).toBeInTheDocument();
    expect(screen.queryAllByRole("tab", { selected: true })).toHaveLength(0);
  });

  it("keeps fullscreen active when a chip is clicked during a presentation", () => {
    const exitFullscreen = vi.fn(() => Promise.resolve());
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      get: () => document.body,
    });
    document.exitFullscreen = exitFullscreen;
    try {
      renderLeadDeck([slide(twoProducts())]);

      fireEvent.click(screen.getByRole("tab", { name: "Data Portal" }));

      // The chip applies the filter without ending the presentation...
      expect(exitFullscreen).not.toHaveBeenCalled();
      expect(
        screen.queryByText("Completed authentication module refactor"),
      ).not.toBeInTheDocument();

      // ...while a click elsewhere on the slide still exits fullscreen.
      fireEvent.click(screen.getByRole("article"));
      expect(exitFullscreen).toHaveBeenCalledTimes(1);
    } finally {
      // Both were defined as own properties over jsdom's prototype slots;
      // deleting them restores the untouched prototype behavior.
      Reflect.deleteProperty(document, "exitFullscreen");
      Reflect.deleteProperty(document, "fullscreenElement");
    }
  });

  it("hides cross-product rows while a product is selected", () => {
    renderLeadDeck([
      slide([
        ...twoProducts(),
        product({
          id: "cross-product",
          name: "Cross-product",
          status: null,
          stages: [],
          currentItems: [],
          nextItems: [],
          risks: [],
          decisions: ["Shared platform decision"],
          priorities: [],
        }),
      ]),
    ]);

    expect(screen.getByText("Shared platform decision")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Data Portal" }));

    expect(
      screen.queryByText("Shared platform decision"),
    ).not.toBeInTheDocument();
  });

  it("clears the filter when the visible slide page changes", () => {
    const pages: SectionSlideModel[] = [
      { ...slide(twoProducts()), pageIndex: 0, pageTotal: 2 },
      { ...slide(twoProducts()), pageIndex: 1, pageTotal: 2 },
    ];
    const deck = (selectedIndex: number) => (
      <StatusSlideDeck
        slides={pages}
        selectedIndex={selectedIndex}
        onSelect={() => undefined}
        title="My Status Slide"
        subtitle="Current section grouped by product and SDLC stage."
        mode="lead"
      />
    );
    const { rerender } = render(deck(0));

    fireEvent.click(screen.getByRole("tab", { name: "Data Portal" }));
    expect(
      screen.queryByText("Completed authentication module refactor"),
    ).not.toBeInTheDocument();

    rerender(deck(1));

    // The new page renders unfiltered, with no chip selected.
    expect(
      screen.getByText("Completed authentication module refactor"),
    ).toBeInTheDocument();
    expect(screen.getByText("Close API parity")).toBeInTheDocument();
    expect(screen.queryAllByRole("tab", { selected: true })).toHaveLength(0);
  });
});

function renderHeadDeck(
  slides: readonly SectionSlideModel[],
  selectedIndex = 0,
  onSelect: (index: number) => void = () => undefined,
) {
  render(
    <StatusSlideDeck
      slides={slides}
      selectedIndex={selectedIndex}
      onSelect={onSelect}
      title="Team Status"
      subtitle="Review each lead's slide."
      mode="head"
    />,
  );
}

describe("StatusSlideDeck head layout (head-slide-density)", () => {
  it("renders the four sections as framed, floored cards with token stripes", () => {
    renderHeadDeck([slide()]);

    const cards = screen.getAllByTestId("head-section-card");
    expect(cards).toHaveLength(4);
    // Fixed topology: every card carries the named min-height token.
    for (const card of cards) {
      expect(card.className).toContain("min-h-[var(--slide-quadrant-min)]");
    }
    // Per-card left stripe from the token map, in render order.
    expect(cards[0]?.className).toContain(
      "border-l-[var(--color-chip-on-track-border)]",
    );
    expect(cards[1]?.className).toContain("border-l-[var(--color-primary)]");
    expect(cards[2]?.className).toContain(
      "border-l-[var(--color-chip-at-risk-border)]",
    );
    expect(cards[3]?.className).toContain(
      "border-l-[var(--color-decisions-accent)]",
    );
  });

  it("renders section headers neutral — no red Risks or green Decisions hue", () => {
    renderHeadDeck([slide()]);

    const cards = screen.getAllByTestId("head-section-card");

    const risksHeader = within(cards[2]).getByText("Risks");

    const decisionsHeader = within(cards[3]).getByText("Decisions");
    for (const header of [risksHeader, decisionsHeader]) {
      expect(header.className).toContain(
        "text-[var(--color-muted-foreground)]",
      );
      expect(header.className).not.toContain("destructive");
      expect(header.className).not.toContain("starbucks-accent");
    }
  });

  it("renders an empty section as a framed dashed placeholder, never hidden", () => {
    renderHeadDeck([slide([product({ decisions: [], risks: [] })])]);

    const cards = screen.getAllByTestId("head-section-card");
    expect(cards).toHaveLength(4);

    const decisionsCard = cards[3];
    expect(within(decisionsCard).getByText("Decisions")).toBeInTheDocument();
    const placeholder = within(decisionsCard).getByText(
      "No decisions recorded",
    );
    expect(placeholder.className).toContain("border-dashed");

    expect(within(cards[2]).getByText("No risks raised").className).toContain(
      "border-dashed",
    );
  });

  it("renders every row of a dense section with no count-based truncation", () => {
    const decisions = [
      "Adopt the unified release calendar",
      "Freeze scope for the Q3 launch",
      "Move IdP cutover before month end",
      "Retire the legacy export pipeline",
      "Consolidate staging environments",
      "Fund the accessibility audit",
    ];
    renderHeadDeck([slide([product({ decisions })])]);

    for (const text of decisions) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
    expect(screen.queryByText(/\+\d+ more/)).not.toBeInTheDocument();
  });

  it("shows a neutral product badge on rows only when the slide spans multiple products", () => {
    renderHeadDeck([
      slide([
        product(),
        product({
          id: PRODUCT_TWO_ID,
          name: "Data Portal",
          status: "yellow",
          currentItems: ["Close API parity"],
        }),
      ]),
    ]);

    const badges = screen.getAllByTestId("head-row-product-badge");
    expect(badges.length).toBeGreaterThan(0);
    expect(badges.some((badge) => badge.title === "Marketing Portal")).toBe(
      true,
    );
  });

  it("hides the product badge for a single-product slide", () => {
    renderHeadDeck([slide()]);

    expect(
      screen.queryByTestId("head-row-product-badge"),
    ).not.toBeInTheDocument();
  });

  it("keeps head-specific surfaces distinct and cross-lead navigation working", () => {
    const onSelect = vi.fn();
    renderHeadDeck(
      [slideWithId("section-1"), slideWithId("section-2")],
      0,
      onSelect,
    );

    // Multi-lead sidebar stays a navigable list (framed, neutral header).
    const sidebar = screen.getByLabelText("Slides");
    const leadButtons = within(sidebar).getAllByRole("button");
    expect(leadButtons).toHaveLength(2);

    fireEvent.click(leadButtons[1]);
    expect(onSelect).toHaveBeenCalledWith(1);

    // Readiness aside stays a distinct review affordance.
    expect(screen.getByText("Slide completion")).toBeInTheDocument();
    // Agent-review deferred-feature control keeps its placement.
    expect(screen.getByTestId("agent-review-coming-soon")).toBeInTheDocument();
    // Portfolio metrics render as the segmented capsule labels.
    expect(screen.getByText("Priority")).toBeInTheDocument();
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

describe("StatusSlideDeck head tone pill — colors come from named tokens", () => {
  const STATUS_HEX = /#(?:fee2e2|fff1f0|fff7df|fef3c7|7f1d1d|78350f|725313)/i;

  function renderHeadTone(tone: SectionSlideModel["tone"]): HTMLElement {
    const { container } = render(
      <StatusSlideDeck
        slides={[{ ...slide(), tone }]}
        selectedIndex={0}
        onSelect={() => undefined}
        title="My Status Slide"
        subtitle="Sub"
        mode="head"
      />,
    );
    return container;
  }

  function tonePill(container: HTMLElement, bgToken: string): HTMLElement {
    const pill = [...container.querySelectorAll<HTMLElement>("span")].find(
      (el) => el.className.includes(`bg-[var(${bgToken})]`),
    );
    expect(pill).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- asserted above
    return pill!;
  }

  it("draws the blocked tone pill from the blocked/destructive tokens", () => {
    const pill = tonePill(
      renderHeadTone("blocked"),
      "--color-status-blocked-bg",
    );
    expect(pill.className).toContain("text-[var(--color-destructive)]");
    expect(pill.className).not.toMatch(STATUS_HEX);
  });

  it("draws the at-risk tone pill from the at-risk tokens", () => {
    const pill = tonePill(
      renderHeadTone("warning"),
      "--color-status-at-risk-bg",
    );
    expect(pill.className).toContain("text-[var(--color-status-at-risk-fg)]");
    expect(pill.className).not.toMatch(STATUS_HEX);
  });

  it("draws the ready tone pill from the success/primary tokens", () => {
    const pill = tonePill(renderHeadTone("ready"), "--color-success");
    expect(pill.className).toContain("text-[var(--color-primary)]");
    expect(pill.className).not.toMatch(STATUS_HEX);
  });
});
