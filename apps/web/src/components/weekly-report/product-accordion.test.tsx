/**
 * Regression for fix-sweep-ui-findings: the priority list keyed on
 * `key={p.rank}`, so when a merged report carried duplicate ranks React logged
 * "Encountered two children with the same key" (226 occurrences in the
 * 2026-06-07 behavioral UI sweep) and could drop/duplicate items. The key now
 * disambiguates with the render index.
 *
 * VA-0a/VA-0b: verify-a11y regression catalog — unit-rtl high + snapshot rows
 * for ChevronDown aria-hidden, rotation transform, priorities ol structure,
 * and accordion expand/collapse grid behavior.
 */
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ProductReport } from "../dashboard/mock-data";
import { ProductAccordion } from "./product-accordion";

function makeReport(overrides?: Partial<ProductReport>): ProductReport {
  return {
    id: "p1",
    initials: "PA",
    name: "Product Alpha",
    status: "on-track",
    statusLabel: "On track",
    leads: "Alice",
    currentWeek: [],
    nextWeek: [],
    risks: [],
    decisions: [],
    priorities: [],
    ...overrides,
  };
}

/** Report with at least one content item so hasContent=true and ChevronDown renders. */
const reportWithContent = makeReport({
  priorities: [{ rank: 1, text: "Ship it" }],
});

describe("ProductAccordion priority keys", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders duplicate-rank priorities without a React key warning", () => {
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    render(
      <ProductAccordion
        defaultOpen
        report={makeReport({
          priorities: [
            { rank: 1, text: "First priority" },
            { rank: 1, text: "Second priority" },
            { rank: 2, text: "Third priority" },
          ],
        })}
      />,
    );

    expect(screen.getByText("First priority")).toBeInTheDocument();
    expect(screen.getByText("Second priority")).toBeInTheDocument();
    expect(screen.getByText("Third priority")).toBeInTheDocument();

    const sameKeyWarning = errorSpy.mock.calls.find((call) =>
      call.some((arg) => String(arg).includes("same key")),
    );
    expect(sameKeyWarning).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// VA-0a unit-rtl high: ChevronDown SVG aria-hidden
// ---------------------------------------------------------------------------

describe("ProductAccordion — ChevronDown SVG aria-hidden", () => {
  it("ChevronDown svg has aria-hidden=true when accordion has content", () => {
    const { container } = render(
      <ProductAccordion report={reportWithContent} />,
    );
    const button = container.querySelector("button");
    const svg = button?.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });
});

// ---------------------------------------------------------------------------
// VA-0a unit-rtl high: ChevronDown rotation transform
// ---------------------------------------------------------------------------

describe("ProductAccordion — ChevronDown rotation transform", () => {
  it("svg has rotate(-90deg) when accordion is collapsed (defaultOpen=false)", () => {
    const { container } = render(
      <ProductAccordion report={reportWithContent} defaultOpen={false} />,
    );
    const button = container.querySelector("button");
    const svg = button?.querySelector("svg");
    expect(svg).not.toBeNull();
    expect((svg as SVGElement).style.transform).toBe("rotate(-90deg)");
  });

  it("svg has rotate(0deg) when accordion is expanded (defaultOpen=true)", () => {
    const { container } = render(
      <ProductAccordion report={reportWithContent} defaultOpen={true} />,
    );
    const button = container.querySelector("button");
    const svg = button?.querySelector("svg");
    expect(svg).not.toBeNull();
    expect((svg as SVGElement).style.transform).toBe("rotate(0deg)");
  });
});

// ---------------------------------------------------------------------------
// VA-0a unit-rtl high: Priorities list items key stability
// (composite rank+index key means same-rank items all render without warning)
// ---------------------------------------------------------------------------

describe("ProductAccordion — Priorities list key stability", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("all priorities render in order even when ranks are unique", () => {
    render(
      <ProductAccordion
        defaultOpen
        report={makeReport({
          priorities: [
            { rank: 1, text: "Alpha" },
            { rank: 2, text: "Beta" },
            { rank: 3, text: "Gamma" },
          ],
        })}
      />,
    );

    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Alpha");
    expect(items[1]).toHaveTextContent("Beta");
    expect(items[2]).toHaveTextContent("Gamma");
  });
});

// ---------------------------------------------------------------------------
// VA-0a unit-rtl high: Accordion expand/collapse grid behavior
// ---------------------------------------------------------------------------

describe("ProductAccordion — expand/collapse grid", () => {
  it("gridTemplateRows=1fr when expanded (defaultOpen=true)", () => {
    const { container } = render(
      <ProductAccordion report={reportWithContent} defaultOpen={true} />,
    );
    // React serialises gridTemplateRows as "grid-template-rows" in the style attr
    const gridDiv = container.querySelector<HTMLElement>(
      "[style*='grid-template-rows']",
    );
    expect(gridDiv).not.toBeNull();
    expect(gridDiv?.style.gridTemplateRows).toBe("1fr");
  });

  it("gridTemplateRows=0fr when collapsed (defaultOpen=false)", () => {
    const { container } = render(
      <ProductAccordion report={reportWithContent} defaultOpen={false} />,
    );
    const gridDiv = container.querySelector<HTMLElement>(
      "[style*='grid-template-rows']",
    );
    expect(gridDiv).not.toBeNull();
    expect(gridDiv?.style.gridTemplateRows).toBe("0fr");
  });
});

// ---------------------------------------------------------------------------
// VA-0b snapshot: ChevronDown SVG stroke and path rendering
// ---------------------------------------------------------------------------

describe("ProductAccordion — ChevronDown SVG snapshot", () => {
  it("ChevronDown svg structure matches snapshot (stroke, path, viewBox)", () => {
    const { container } = render(
      <ProductAccordion report={reportWithContent} defaultOpen={false} />,
    );
    const button = container.querySelector("button");
    const svg = button?.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toMatchSnapshot();
  });
});

// ---------------------------------------------------------------------------
// VA-0b snapshot: Priorities ol semantic structure
// ---------------------------------------------------------------------------

describe("ProductAccordion — Priorities ol snapshot", () => {
  it("priorities section renders an ol element with correct structure", () => {
    const { container } = render(
      <ProductAccordion
        defaultOpen
        report={makeReport({
          priorities: [
            { rank: 1, text: "Top item" },
            { rank: 2, text: "Second item" },
          ],
        })}
      />,
    );
    const ol = container.querySelector("ol");
    expect(ol).not.toBeNull();
    expect(ol).toMatchSnapshot();
  });
});
