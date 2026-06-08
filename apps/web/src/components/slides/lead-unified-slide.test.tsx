import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LeadUnifiedSlide } from "./lead-unified-slide";
import type { UnifiedSlideModel } from "./section-slide-utils";

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
): { text: string; productName: string; priorityRank?: number } {
  return priorityRank !== undefined
    ? { text, productName, priorityRank }
    : { text, productName };
}

describe("LeadUnifiedSlide — inlineProductMarker a11y", () => {
  it("product marker outer span has title attribute equal to productName", () => {
    const model = makeModel({
      current: [makeRow("Completed refactor", "Marketing Portal")],
    });
    render(<LeadUnifiedSlide model={model} />);

    const markers = screen.getAllByTitle("Marketing Portal");
    expect(markers.length).toBeGreaterThan(0);
  });

  it("product marker outer span does not have an aria-label attribute", () => {
    const model = makeModel({
      current: [makeRow("Completed refactor", "Marketing Portal")],
    });
    const { container } = render(<LeadUnifiedSlide model={model} />);

    // The outer wrapper span has title={productName} but no aria-label
    const markers = container.querySelectorAll(
      'span[title="Marketing Portal"]',
    );
    expect(markers.length).toBeGreaterThan(0);
    for (const marker of markers) {
      expect(marker).not.toHaveAttribute("aria-label");
    }
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
