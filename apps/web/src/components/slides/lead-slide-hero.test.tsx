import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LeadSlideHero } from "./lead-slide-hero";
import type { SectionSlideModel, SlideProduct } from "./section-slide-utils";

// polish-lead-toolbar 3.1 contract: the hero status badge and the metric
// capsule share ONE row height (HERO_ROW_HEIGHT_CLASS = "h-11"), so the badge
// can never read taller than its sibling row elements. The shared height is a
// single named const applied to both boxed elements — no magic-number drift.
const ROW_HEIGHT_CLASS = "h-11";

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
    products: productSlides.map((p) => p.name),
    productSlides: [...productSlides],
    productCount: productSlides.length,
    currentCount: 3,
    nextCount: 2,
    riskCount: 1,
    decisionCount: 0,
    priorityCount: 2,
    blockedCount: 0,
    atRiskCount: 0,
    score: 100,
    tone: "ready",
    readiness: [],
    currentItems: [],
    nextItems: [],
    risks: [],
    decisions: [],
    priorities: [],
  };
}

const TONE_LABELS = new Set(["Blockers", "At risk", "On track", "No status"]);

function toneBadge(): HTMLElement {
  // The tone badge is the rounded pill carrying one of the status labels.
  const span = Array.from(document.querySelectorAll("span")).find(
    (el) =>
      TONE_LABELS.has(el.textContent.trim()) &&
      el.className.includes("rounded"),
  );
  if (!span) throw new Error("tone badge not found");
  return span;
}

function metricCapsule(): HTMLElement {
  const capsule = Array.from(document.querySelectorAll("div")).find((el) =>
    el.className.includes("divide-x"),
  );
  if (!capsule) throw new Error("metric capsule not found");
  return capsule;
}

describe("LeadSlideHero", () => {
  it("renders the tone label matching the worst product status", () => {
    render(<LeadSlideHero slide={slide([product({ status: "red" })])} />);
    expect(screen.getByText("Blockers")).toBeInTheDocument();
  });

  it.each([
    ["blocked", "red", "Blockers"],
    ["at-risk", "yellow", "At risk"],
    ["on-track", "green", "On track"],
  ] as const)(
    "keeps the badge and the metric capsule at one shared row height for %s",
    (_name, status, label) => {
      render(<LeadSlideHero slide={slide([product({ status })])} />);
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(toneBadge().className).toContain(ROW_HEIGHT_CLASS);
      expect(metricCapsule().className).toContain(ROW_HEIGHT_CLASS);
    },
  );

  it("renders the metric counts from the slide model", () => {
    render(<LeadSlideHero slide={slide()} />);
    expect(screen.getByText("Current")).toBeInTheDocument();
    expect(screen.getByText("Risks")).toBeInTheDocument();
    expect(screen.getByText("Priorities")).toBeInTheDocument();
  });
});
