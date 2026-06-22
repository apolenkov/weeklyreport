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

  it("aligns bands via subgrid: every card spans the 5 shared row tracks, no mt-auto", () => {
    // jsdom has no layout engine, so we assert the MECHANISM that aligns the
    // bands across cards: each card is a `grid-rows-subgrid` participant
    // spanning 5 shared row tracks (`row-span-5`) — header + Current + Next +
    // Risks + Decisions, each its own track — replacing the old `flex`/`h-full`/
    // `mt-auto` bottom-pin and the merged 4th Risks+Decisions band that let a
    // missing-Risks card float its Decisions up. True horizontal alignment is
    // proven only by the live check.
    const { container } = render(
      <LeadProductGrid
        products={[
          product({ name: "Tall", risks: ["x"], decisions: ["y"] }),
          product({ id: "short", name: "Short" }),
        ]}
      />,
    );

    const tall = screen.getByText("Tall").closest("div.grid-rows-subgrid");
    const short = screen.getByText("Short").closest("div.grid-rows-subgrid");
    expect(tall).toHaveClass("row-span-5", "grid-rows-subgrid");
    expect(short).toHaveClass("row-span-5", "grid-rows-subgrid");
    // The old flex bottom-pin mechanism is gone.
    expect(tall?.className).not.toContain("mt-auto");
    expect(tall?.className).not.toContain("h-full");
    expect(short?.className).not.toContain("mt-auto");
    expect(container.querySelector(".mt-auto")).toBeNull();

    // The empty-content card STILL renders BOTH its Risks and Decisions rows as
    // quiet placeholders so each track is held and neighbours stay aligned.
    expect(
      within(short as HTMLElement).getByText("No risks raised"),
    ).toBeInTheDocument();
    expect(
      within(short as HTMLElement).getByText("No decisions"),
    ).toBeInTheDocument();

    // Sanity: the outer grid root carries the responsive multi-column layout.
    const grid = container.querySelector("div.grid:not(.grid-rows-subgrid)");
    expect(grid).toHaveClass("lg:grid-cols-3");
  });

  it("renders all five bands on every card, including empty Risks and Decisions placeholders", () => {
    render(<LeadProductGrid products={[product({ name: "Solo" })]} />);

    expect(screen.getByText("Solo")).toBeInTheDocument(); // header band
    expect(screen.getByText("Current")).toBeInTheDocument(); // Current band
    expect(screen.getByText("Next")).toBeInTheDocument(); // Next band
    // Risks and Decisions are now distinct always-rendered bands.
    expect(screen.getByText("Risks")).toBeInTheDocument();
    expect(screen.getByText("Decisions")).toBeInTheDocument();
    expect(screen.getByText("No risks raised")).toBeInTheDocument();
    expect(screen.getByText("No decisions")).toBeInTheDocument();
  });

  it("caps the decisions list with a +N more row so the band stays bounded", () => {
    render(
      <LeadProductGrid
        products={[
          product({
            decisions: ["d one", "d two", "d three", "d four", "d five"],
          }),
        ]}
      />,
    );

    expect(screen.getByText(/d one/)).toBeInTheDocument();
    expect(screen.getByText(/d three/)).toBeInTheDocument();
    // The 4th and 5th decisions collapse into the overflow row.
    expect(screen.queryByText(/d four/)).not.toBeInTheDocument();
    expect(screen.getByText("+2 more")).toBeInTheDocument();
  });
});
