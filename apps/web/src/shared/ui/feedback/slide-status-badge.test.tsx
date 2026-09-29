import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SlideStatusBadge } from "./slide-status-badge";

describe("SlideStatusBadge", () => {
  it("renders the worstPill label and the alert glyph for blocked", () => {
    const { container } = render(
      <SlideStatusBadge status="blocked" labelVariant="worstPill" />,
    );
    expect(screen.getByText("Blockers")).toBeInTheDocument();
    // AlertTriangle renders an svg; on-track/empty carry none.
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("omits the alert glyph for on-track", () => {
    const { container } = render(
      <SlideStatusBadge status="on-track" labelVariant="worstPill" />,
    );
    expect(screen.getByText("On track")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeNull();
  });

  it("carries the canonical tone chip classes", () => {
    const { container } = render(
      <SlideStatusBadge status="at-risk" labelVariant="worstPill" />,
    );
    const badge = container.firstElementChild;
    expect(badge?.className).toContain("bg-[var(--color-chip-at-risk-bg)]");
    expect(badge?.className).toContain("rounded-[var(--radius-pill)]");
  });
});
