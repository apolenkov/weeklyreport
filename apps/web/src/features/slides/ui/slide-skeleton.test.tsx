// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SlideSkeleton } from "./slide-skeleton";

describe("SlideSkeleton", () => {
  it.each([
    ["head", "fullscreen", "fullscreen"],
    ["lead", "density", "density"],
    ["head", "none", null],
    ["lead", "none", null],
    ["lead", "fullscreen", "fullscreen"],
  ] as const)("matches the %s deck toolbar %s", (mode, toolbar, expected) => {
    render(<SlideSkeleton mode={mode} toolbar={toolbar} />);

    for (const kind of ["density", "fullscreen"] as const) {
      expect(screen.queryByTestId(`slide-skeleton-${kind}`) !== null).toBe(
        kind === expected,
      );
    }
  });

  it("exposes the loading status region with busy state and label", () => {
    render(<SlideSkeleton mode="head" toolbar="fullscreen" />);

    const status = screen.getByRole("status", { name: "Loading slides" });
    expect(status).toHaveAttribute("aria-busy", "true");
  });

  it("mirrors the mobile canvas while retaining desktop column headers", () => {
    render(<SlideSkeleton mode="head" toolbar="fullscreen" />);

    expect(screen.getByTestId("slide-skeleton-scroll-owner")).toHaveClass(
      "min-w-0",
      "max-w-full",
      "overflow-x-auto",
    );
    expect(screen.getByTestId("slide-skeleton-article")).toHaveClass(
      "slide-canvas",
      "min-w-0",
      "sm:min-w-[var(--slide-canvas-min-w)]",
      "max-w-[var(--slide-canvas-max-w)]",
    );
    const columnHeaders = screen.getByTestId("slide-skeleton-column-headers");
    expect(columnHeaders).toHaveClass(
      "hidden",
      "sm:grid",
      "sm:grid-cols-[1.35fr_1.25fr_0.85fr_0.85fr]",
    );
    expect(columnHeaders.children).toHaveLength(4);
    for (const cell of columnHeaders.children) {
      expect(cell).toHaveAttribute("data-slot", "skeleton");
      expect(cell).toHaveClass("w-full", "max-w-full");
    }
    expect(screen.getByTestId("slide-skeleton")).toHaveAttribute(
      "data-layout-key",
      "status-slide-deck",
    );
    expect(screen.getByTestId("slide-skeleton-article")).toHaveAttribute(
      "data-layout-key",
      "slide-article",
    );
  });

  it("renders the head selector in the full-width skeleton layout", () => {
    const { container } = render(
      <SlideSkeleton mode="head" toolbar="fullscreen" />,
    );

    expect(screen.getByTestId("slide-skeleton-head-carousel")).toBeVisible();
    expect(screen.queryByTestId("slide-skeleton-lead-carousel")).toBeNull();
    expect(container.innerHTML).not.toContain(
      "lg:grid-cols-[minmax(220px,300px)_1fr]",
    );
    const selectorLines = screen
      .getByTestId("slide-skeleton-head-carousel")
      .querySelectorAll('[data-slot="skeleton"]');
    expect(selectorLines[0]).toHaveClass("h-5");
    expect(selectorLines[1]).toHaveClass("h-4");
    expect(selectorLines[2]).toHaveClass("h-4");
  });

  it("renders lead carousel controls instead of head selector cards", () => {
    render(<SlideSkeleton mode="lead" toolbar="density" />);

    expect(screen.getByTestId("slide-skeleton-lead-carousel")).toBeVisible();
    expect(screen.queryByTestId("slide-skeleton-head-carousel")).toBeNull();
  });

  it("can be composed without adding a nested status region", () => {
    render(<SlideSkeleton announce={false} toolbar="fullscreen" />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByTestId("slide-skeleton")).not.toHaveAttribute(
      "aria-busy",
    );
  });
});
