/**
 * Regression for fix-sweep-ui-findings + apply-status-palette: the separate
 * TOP PRIORITIES section duplicated current-week items 1:1 and was removed
 * (user feedback 2026-06-10) — prioritized items now sort first in Current
 * Week and carry an inline PriorityRankBadge. Duplicate ranks must render
 * without React key warnings (rows key on item.id).
 *
 * VA-0a/VA-0b: verify-a11y regression catalog — unit-rtl high + snapshot rows
 * for ChevronDown aria-hidden, rotation transform, prioritized-row structure,
 * and accordion expand/collapse grid behavior.
 */
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ProductReport, ReportItem } from "../dashboard/mock-data";
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

function makeItem(overrides: Partial<ReportItem> & { id: string }): ReportItem {
  return {
    stageLead: "Dev · AL",
    text: `Item ${overrides.id}`,
    status: "in-progress",
    ...overrides,
  };
}

/** Report with at least one content item so hasContent=true and ChevronDown renders. */
const reportWithContent = makeReport({
  currentWeek: [makeItem({ id: "c1", text: "Ship it", priorityRank: 1 })],
});

describe("ProductAccordion prioritized items", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders duplicate-rank prioritized items without a React key warning", () => {
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    render(
      <ProductAccordion
        defaultOpen
        report={makeReport({
          currentWeek: [
            makeItem({ id: "a", text: "First priority", priorityRank: 1 }),
            makeItem({ id: "b", text: "Second priority", priorityRank: 1 }),
            makeItem({ id: "c", text: "Third priority", priorityRank: 2 }),
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

  it("sorts prioritized items first (rank asc), unranked keep their order", () => {
    const { container } = render(
      <ProductAccordion
        defaultOpen
        report={makeReport({
          currentWeek: [
            makeItem({ id: "u1", text: "Unranked one" }),
            makeItem({ id: "r2", text: "Rank two", priorityRank: 2 }),
            makeItem({ id: "r1", text: "Rank one", priorityRank: 1 }),
            makeItem({ id: "u2", text: "Unranked two" }),
          ],
        })}
      />,
    );

    const texts = [...container.querySelectorAll("div.space-y-1 > div")].map(
      (row) => row.textContent,
    );
    expect(texts[0]).toContain("Rank one");
    expect(texts[1]).toContain("Rank two");
    expect(texts[2]).toContain("Unranked one");
    expect(texts[3]).toContain("Unranked two");
  });

  it("prioritized item carries a rank badge; unranked items carry none", () => {
    render(
      <ProductAccordion
        defaultOpen
        report={makeReport({
          currentWeek: [
            makeItem({ id: "r1", text: "Ranked", priorityRank: 1 }),
            makeItem({ id: "u1", text: "Unranked" }),
          ],
        })}
      />,
    );

    expect(screen.getByTitle("Priority 1")).toHaveTextContent("1");
    expect(screen.queryByTitle("Priority 2")).not.toBeInTheDocument();
  });

  it("pluralizes the Current Week count: '1 item' at one, 'N items' otherwise", () => {
    const { rerender } = render(
      <ProductAccordion
        defaultOpen
        report={makeReport({
          currentWeek: [makeItem({ id: "c1", text: "Only item" })],
        })}
      />,
    );
    // Driver finding 5: a single-item Current Week must read "1 item", not
    // the always-plural "1 items".
    expect(screen.getByText(/Current Week · 1 item$/)).toBeInTheDocument();

    rerender(
      <ProductAccordion
        defaultOpen
        report={makeReport({
          currentWeek: [
            makeItem({ id: "c1", text: "First" }),
            makeItem({ id: "c2", text: "Second" }),
          ],
        })}
      />,
    );
    expect(screen.getByText(/Current Week · 2 items$/)).toBeInTheDocument();
  });

  it("pluralizes the Next Week count: '1 item' at one, 'N items' otherwise", () => {
    const { rerender } = render(
      <ProductAccordion
        defaultOpen
        report={makeReport({
          nextWeek: [makeItem({ id: "n1", text: "Only next" })],
        })}
      />,
    );
    expect(screen.getByText(/Next Week · 1 item$/)).toBeInTheDocument();

    rerender(
      <ProductAccordion
        defaultOpen
        report={makeReport({
          nextWeek: [
            makeItem({ id: "n1", text: "Next one" }),
            makeItem({ id: "n2", text: "Next two" }),
          ],
        })}
      />,
    );
    expect(screen.getByText(/Next Week · 2 items$/)).toBeInTheDocument();
  });

  it("does not render the removed TOP PRIORITIES section even when priorities data is present", () => {
    render(
      <ProductAccordion
        defaultOpen
        report={makeReport({
          currentWeek: [makeItem({ id: "c1" })],
          priorities: [{ rank: 1, text: "Legacy priority entry" }],
        })}
      />,
    );

    expect(screen.queryByText("Top Priorities")).not.toBeInTheDocument();
    expect(screen.queryByText("Legacy priority entry")).not.toBeInTheDocument();
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
// VA-0b snapshot: prioritized current-week row structure (replaces the
// removed Priorities ol snapshot — the ol no longer exists)
// ---------------------------------------------------------------------------

describe("ProductAccordion — prioritized row snapshot", () => {
  it("rank-1 current-week row structure matches snapshot", () => {
    const { container } = render(
      <ProductAccordion
        defaultOpen
        report={makeReport({
          currentWeek: [
            makeItem({ id: "r1", text: "Top item", priorityRank: 1 }),
          ],
        })}
      />,
    );
    const row = container.querySelector("div.space-y-1 > div");
    expect(row).not.toBeNull();
    expect(row).toMatchSnapshot();
  });
});
