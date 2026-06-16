import "@testing-library/jest-dom/vitest";

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LeadProductGrid } from "./lead-product-grid";
import type { SlideProduct } from "./section-slide-utils";

function product(overrides: Partial<SlideProduct> = {}): SlideProduct {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Marketing Portal",
    status: "green",
    stages: [],
    currentItems: [],
    nextItems: [],
    risks: [],
    decisions: [],
    priorities: [],
    ...overrides,
  };
}

describe("LeadProductGrid", () => {
  it("renders the actual risk and decision content, not only the counts", () => {
    render(
      <LeadProductGrid
        products={[
          product({
            risks: ["Vendor outage blocks the build"],
            decisions: ["Move to the new IdP this month"],
          }),
        ]}
      />,
    );

    // 2.1: the card surfaces the risk/decision TITLES on the body.
    expect(
      screen.getByText("Vendor outage blocks the build"),
    ).toBeInTheDocument();
    // The decision bullet renders with a leading "· " marker, so match loosely.
    expect(
      screen.getByText(/Move to the new IdP this month/),
    ).toBeInTheDocument();
  });

  it("folds the count into the section header", () => {
    render(
      <LeadProductGrid
        products={[product({ risks: ["A", "B"], decisions: ["C"] })]}
      />,
    );

    expect(screen.getByText("Risks")).toBeInTheDocument();
    // Risk count (2) and decision count (1) live in the headers.
    expect(screen.getByText("(2)")).toBeInTheDocument();
    expect(screen.getByText("(1)")).toBeInTheDocument();
  });

  it("caps the risk list with a +N more row", () => {
    render(
      <LeadProductGrid
        products={[
          product({
            risks: ["risk one", "risk two", "risk three", "risk four"],
          }),
        ]}
      />,
    );

    expect(screen.getByText("risk one")).toBeInTheDocument();
    expect(screen.getByText("risk three")).toBeInTheDocument();
    // The 4th risk collapses into the overflow row, not a bullet.
    expect(screen.queryByText("risk four")).not.toBeInTheDocument();
    expect(screen.getByText("+1 more")).toBeInTheDocument();
  });

  it("draws each status badge color from a named token, not a status hex", () => {
    render(
      <LeadProductGrid
        products={[
          product({ id: "r", name: "Red", status: "red" }),
          product({ id: "y", name: "Yellow", status: "yellow" }),
          product({ id: "g", name: "Green", status: "green" }),
        ]}
      />,
    );

    const blocked = screen.getByText("Blocked");
    expect(blocked.className).toContain("bg-[var(--color-status-blocked-bg)]");
    expect(blocked.className).toContain("text-[var(--color-destructive)]");

    const atRisk = screen.getByText("At risk");
    expect(atRisk.className).toContain("bg-[var(--color-status-at-risk-bg)]");
    expect(atRisk.className).toContain("text-[var(--color-status-at-risk-fg)]");

    const onTrack = screen.getByText("On track");
    expect(onTrack.className).toContain("bg-[var(--color-success)]");

    // No raw status hex leaks into any badge — convergence to one token set.
    const statusHex = /#(?:fee2e2|fff1f0|fff7df|fef3c7|7f1d1d|78350f|725313)/i;
    for (const badge of [blocked, atRisk, onTrack]) {
      expect(badge.className).not.toMatch(statusHex);
    }
  });

  it("keeps the cross-product entry without a status badge", () => {
    render(
      <LeadProductGrid
        products={[
          product({
            id: "cross-product",
            name: "Cross-product",
            status: null,
            risks: ["Shared blocker"],
          }),
        ]}
      />,
    );

    expect(screen.queryByText("No status")).not.toBeInTheDocument();
    expect(screen.getByText("Shared blocker")).toBeInTheDocument();
  });

  it("gives each card the h-full equal-height contract and a bottom-pinned footer", () => {
    // jsdom has no layout engine, so we assert the MECHANISM that produces
    // equal-height cards: the CSS-grid cell already stretches its child
    // (align-items: stretch is the grid default), so a card with `h-full`
    // fills the tallest cell in its row, and `mt-auto` pins the risk/decision
    // footer to the bottom. We assert the classes, not computed pixels.
    const { container } = render(
      <LeadProductGrid
        products={[
          product({ name: "Tall", risks: ["x"], decisions: ["y"] }),
          product({ id: "short", name: "Short" }),
        ]}
      />,
    );

    const tall = screen.getByText("Tall").closest("div.h-full");
    const short = screen.getByText("Short").closest("div.h-full");
    expect(tall).toHaveClass("h-full", "flex-col");
    expect(short).toHaveClass("h-full", "flex-col");

    // The footer (risk/decision block) is pinned to the bottom via mt-auto.
    const footer = within(tall as HTMLElement)
      .getByText("Risks")
      .closest("div.mt-auto");
    expect(footer).not.toBeNull();

    // Sanity: the grid root carries the responsive multi-column layout.
    const grid = container.querySelector("div.grid");
    expect(grid).toHaveClass("lg:grid-cols-3");
  });
});
