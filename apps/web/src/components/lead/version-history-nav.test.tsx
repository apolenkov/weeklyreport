/**
 * @vitest-environment jsdom
 *
 * VA-0a / VA-0b: a11y regression tests for VersionHistoryNav.
 * Source: openspec/changes/verify-a11y-recommended-flip/design.md
 * Section: apps/web/src/components/lead/version-history-nav.tsx
 *
 * Change: ChevronLeft and ChevronRight SVG icons gained aria-hidden="true"
 * to mark them as decorative and exclude them from the accessibility tree.
 */
import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { VersionSnapshot } from "./mock-data";
import { VersionHistoryNav } from "./version-history-nav";

const VERSIONS: VersionSnapshot[] = [
  {
    version: 3,
    timestamp: "2026-06-01 10:00",
    itemCount: 5,
    riskCount: 2,
    decisionCount: 1,
    pinned: false,
  },
  {
    version: 2,
    timestamp: "2026-05-28 09:00",
    itemCount: 4,
    riskCount: 1,
    decisionCount: 1,
    pinned: false,
  },
  {
    version: 1,
    timestamp: "2026-05-21 08:00",
    itemCount: 3,
    riskCount: 1,
    decisionCount: 0,
    pinned: false,
  },
];

// ---------------------------------------------------------------------------
// VA-0a — high-priority unit-rtl rows
// ---------------------------------------------------------------------------

describe("VersionHistoryNav — VA-0a: ChevronLeft and ChevronRight aria-hidden", () => {
  it("ChevronLeft SVG has aria-hidden='true'", () => {
    render(<VersionHistoryNav versions={VERSIONS} />);
    const prevButton = screen.getByRole("button", { name: "Previous version" });
    const svg = prevButton.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("ChevronRight SVG has aria-hidden='true'", () => {
    render(<VersionHistoryNav versions={VERSIONS} />);
    const nextButton = screen.getByRole("button", { name: "Next version" });
    const svg = nextButton.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("Previous button (ChevronLeft) has type='button' and aria-label='Previous version'", () => {
    render(<VersionHistoryNav versions={VERSIONS} />);
    const prevButton = screen.getByRole("button", { name: "Previous version" });
    expect(prevButton).toHaveAttribute("type", "button");
    expect(prevButton).toHaveAttribute("aria-label", "Previous version");
  });

  it("Next button (ChevronRight) has type='button' and aria-label='Next version'", () => {
    render(<VersionHistoryNav versions={VERSIONS} />);
    const nextButton = screen.getByRole("button", { name: "Next version" });
    expect(nextButton).toHaveAttribute("type", "button");
    expect(nextButton).toHaveAttribute("aria-label", "Next version");
  });

  it("Previous button accessible name is 'Previous version' — SVG does not leak content into accessible name", () => {
    render(<VersionHistoryNav versions={VERSIONS} />);
    // getByRole resolves by accessible name; if SVG leaked text content the
    // query would fail or return a different element.
    const prevButton = screen.getByRole("button", { name: "Previous version" });
    expect(prevButton).toBeInTheDocument();
    const svg = prevButton.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    // Confirm no role on SVG that would surface it to the accessibility tree.
    expect(svg).not.toHaveAttribute("role");
  });

  it("Next button accessible name is 'Next version' — SVG does not leak content into accessible name", () => {
    render(<VersionHistoryNav versions={VERSIONS} />);
    const nextButton = screen.getByRole("button", { name: "Next version" });
    expect(nextButton).toBeInTheDocument();
    const svg = nextButton.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).not.toHaveAttribute("role");
  });

  it("modal dialog renders with aria-hidden SVGs in nav buttons and correct dialog ARIA attrs", () => {
    render(<VersionHistoryNav versions={VERSIONS} />);
    // Open the modal via the version pill button.
    const versionPill = screen.getByRole("button", {
      name: /Version .* — open history/,
    });
    fireEvent.click(versionPill);

    // Dialog is accessible.
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-label", "Version history");

    // The nav buttons outside the modal still have aria-hidden SVGs.
    const prevButton = screen.getByRole("button", { name: "Previous version" });
    const prevSvg = prevButton.querySelector("svg");
    expect(prevSvg).toHaveAttribute("aria-hidden", "true");

    const nextButton = screen.getByRole("button", { name: "Next version" });
    const nextSvg = nextButton.querySelector("svg");
    expect(nextSvg).toHaveAttribute("aria-hidden", "true");
  });
});

// ---------------------------------------------------------------------------
// VA-0b — snapshot rows (medium priority)
// ChevronLeft and ChevronRight SVG interior structure, including path element
// inheriting aria-hidden from the parent SVG.
// ---------------------------------------------------------------------------

describe("VersionHistoryNav — VA-0b snapshots: ChevronLeft and ChevronRight SVG interior", () => {
  it("ChevronLeft SVG interior elements — path inherits aria-hidden from parent (snapshot)", () => {
    render(<VersionHistoryNav versions={VERSIONS} />);
    const prevButton = screen.getByRole("button", { name: "Previous version" });
    const svg = prevButton.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toMatchSnapshot();
  });

  it("ChevronRight SVG interior elements — path inherits aria-hidden from parent (snapshot)", () => {
    render(<VersionHistoryNav versions={VERSIONS} />);
    const nextButton = screen.getByRole("button", { name: "Next version" });
    const svg = nextButton.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toMatchSnapshot();
  });
});
