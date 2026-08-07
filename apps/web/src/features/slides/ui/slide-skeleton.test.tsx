// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SlideSkeleton } from "./slide-skeleton";

describe("SlideSkeleton", () => {
  it("exposes the loading status region with busy state and label", () => {
    render(<SlideSkeleton />);

    const status = screen.getByRole("status", { name: "Loading slides" });
    expect(status).toHaveAttribute("aria-busy", "true");
  });

  it("mirrors the full-width article and its four-column grid", () => {
    render(<SlideSkeleton />);

    expect(screen.getByTestId("slide-skeleton-scroll-owner")).toHaveClass(
      "min-w-0",
      "max-w-full",
      "overflow-x-auto",
    );
    expect(screen.getByTestId("slide-skeleton-article")).toHaveClass(
      "slide-canvas",
      "min-w-[var(--slide-canvas-min-w)]",
      "max-w-[var(--slide-canvas-max-w)]",
    );
    expect(screen.getByTestId("slide-skeleton-column-headers")).toHaveClass(
      "grid-cols-[1.35fr_1.25fr_0.85fr_0.85fr]",
    );
    expect(screen.getByTestId("slide-skeleton")).toHaveAttribute(
      "data-layout-key",
      "status-slide-deck",
    );
    expect(screen.getByTestId("slide-skeleton-article")).toHaveAttribute(
      "data-layout-key",
      "slide-article",
    );
  });

  it("renders the head horizontal selector without the retired sidebar", () => {
    const { container } = render(<SlideSkeleton mode="head" />);

    expect(screen.getByTestId("slide-skeleton-head-carousel")).toBeVisible();
    expect(screen.queryByTestId("slide-skeleton-lead-carousel")).toBeNull();
    expect(container.innerHTML).not.toContain(
      "lg:grid-cols-[minmax(220px,300px)_1fr]",
    );
  });

  it("renders lead carousel controls instead of head selector cards", () => {
    render(<SlideSkeleton mode="lead" />);

    expect(screen.getByTestId("slide-skeleton-lead-carousel")).toBeVisible();
    expect(screen.queryByTestId("slide-skeleton-head-carousel")).toBeNull();
  });

  it("can be composed without adding a nested status region", () => {
    render(<SlideSkeleton announce={false} />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByTestId("slide-skeleton")).not.toHaveAttribute(
      "aria-busy",
    );
  });
});
