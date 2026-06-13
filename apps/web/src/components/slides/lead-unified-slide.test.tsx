import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LeadUnifiedSlide } from "./lead-unified-slide";
import type {
  UnifiedSectionRow,
  UnifiedSlideModel,
} from "./section-slide-utils";

function makeModel(
  overrides: Partial<UnifiedSlideModel> = {},
): UnifiedSlideModel {
  return {
    current: [],
    next: [],
    risks: [],
    priorities: [],
    decisions: [],
    emptyProducts: {
      current: [],
      next: [],
      risks: [],
      priorities: [],
      decisions: [],
    },
    ...overrides,
  };
}

function makeRow(
  text: string,
  productName: string,
  priorityRank?: number,
): UnifiedSectionRow {
  return priorityRank !== undefined
    ? { text, productName, priorityRank }
    : { text, productName };
}

describe("LeadUnifiedSlide — quadrant empty states", () => {
  it("an empty quadrant renders its dashed placeholder, not a bare header", () => {
    const model = makeModel({
      current: [makeRow("Ship feature", "Atlas")],
    });
    render(<LeadUnifiedSlide model={model} />);

    expect(screen.getByText("Nothing queued")).toBeInTheDocument();
    expect(screen.getByText("No risks raised")).toBeInTheDocument();
    expect(screen.getByText("No decisions recorded")).toBeInTheDocument();
    expect(screen.queryByText("Nothing in flight")).not.toBeInTheDocument();
  });

  it("all four quadrant headers render even when every section is empty", () => {
    render(<LeadUnifiedSlide model={makeModel()} />);

    for (const label of ["Current work", "Next focus", "Risks", "Decisions"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText("Nothing in flight")).toBeInTheDocument();
  });
});

describe("LeadUnifiedSlide — product attribution (neutral badges)", () => {
  const multiProduct = makeModel({
    current: [makeRow("Ship auth flow", "Atlas"), makeRow("QA pass", "Vega")],
    risks: [makeRow("Vendor SLA slip", "Atlas")],
  });

  it("multi-product rows lead with a neutral badge naming the product", () => {
    render(<LeadUnifiedSlide model={multiProduct} />);

    const badges = screen.getAllByTestId("row-product-badge");
    expect(badges).toHaveLength(3);
    expect(badges[0]).toHaveAttribute("title", "Atlas");
    expect(badges[0]?.textContent).toBe("Atlas");
    // Feedback round 3: identity only — no status color classes on the badge.
    for (const badge of badges) {
      expect(badge.className).not.toMatch(/destructive|status-dot|primary/);
    }
  });

  it("single-product slides render rows without badges", () => {
    const model = makeModel({
      current: [makeRow("Ship feature", "Atlas")],
      next: [makeRow("Draft RFC", "Atlas")],
    });
    render(<LeadUnifiedSlide model={model} />);

    expect(screen.queryByTestId("row-product-badge")).not.toBeInTheDocument();
  });

  it("cross-product rows do not flip a single-product slide into badge mode", () => {
    const model = makeModel({
      current: [makeRow("Ship feature", "Atlas")],
      decisions: [makeRow("Align analytics API", "Shared context")],
    });
    render(<LeadUnifiedSlide model={model} />);

    expect(screen.queryByTestId("row-product-badge")).not.toBeInTheDocument();
  });
});

describe("LeadUnifiedSlide — frame fill (slides-product-autofit)", () => {
  it("the grid sizes from the frame (flex-1/min-h-0), not the viewport", () => {
    render(<LeadUnifiedSlide model={makeModel()} />);

    const grid = screen.getByTestId("lead-unified-slide");
    expect(grid.className).toContain("flex-1");
    expect(grid.className).toContain("min-h-0");
    // The old viewport-relative floor must not size the framed surface.
    expect(grid.className).not.toContain("52dvh");
    // Even distribution and the fullscreen dvh floor stay.
    expect(grid.className).toContain("auto-rows-fr");
    expect(grid.className).toContain("[:fullscreen_&]:min-h-[60dvh]");
  });
});

describe("LeadUnifiedSlide — priorityChip a11y", () => {
  it("priority chip span has role='img'", () => {
    const model = makeModel({
      current: [makeRow("Implement OAuth", "Auth Service", 1)],
    });
    render(<LeadUnifiedSlide model={model} />);

    const chip = screen.getByRole("img", { name: /priority/i });
    expect(chip).toBeInTheDocument();
  });

  it("priority chip span has aria-label matching 'Priority {rank}'", () => {
    const model = makeModel({
      current: [makeRow("Implement OAuth", "Auth Service", 2)],
    });
    render(<LeadUnifiedSlide model={model} />);

    const chip = screen.getByRole("img", { name: "Priority 2" });
    expect(chip).toHaveAttribute("aria-label", "Priority 2");
  });

  it("priority chip span renders with correct rank in aria-label for rank 1", () => {
    const model = makeModel({
      risks: [makeRow("Database latency", "Backend", 1)],
    });
    render(<LeadUnifiedSlide model={model} />);

    const chip = screen.getByRole("img", { name: "Priority 1" });
    expect(chip).toHaveAttribute("aria-label", "Priority 1");
  });

  it("no priority chip rendered when priorityRank is absent", () => {
    const model = makeModel({
      current: [makeRow("No priority item", "Some Product")],
    });
    render(<LeadUnifiedSlide model={model} />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});

describe("LeadUnifiedSlide — priorityChip semantic structure snapshot", () => {
  it("priority chip span renders as img equivalent in accessibility tree (snapshot)", () => {
    const model = makeModel({
      current: [makeRow("Ship feature", "Product A", 3)],
    });
    const { container } = render(<LeadUnifiedSlide model={model} />);

    // Snapshot of the priority chip element to catch future structural regressions
    const chip = container.querySelector('[role="img"]');
    expect(chip).not.toBeNull();
    expect(chip).toMatchInlineSnapshot(`
      <span
        aria-label="Priority 3"
        class="inline-flex shrink-0 items-center justify-center rounded-sm bg-[var(--color-starbucks-gold)] px-1 text-[10px] font-bold leading-4 text-white"
        role="img"
        title="Priority rank 3"
      >
        P
        3
      </span>
    `);
  });
});
