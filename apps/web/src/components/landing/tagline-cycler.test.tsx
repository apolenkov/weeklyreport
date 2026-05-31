import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LANDING_TAGLINES } from "./landing-page.constants";
import { TaglineCycler } from "./tagline-cycler";

vi.useFakeTimers();

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
});

describe("LANDING_TAGLINES", () => {
  it("has between 4 and 6 phrases", () => {
    expect(LANDING_TAGLINES.length).toBeGreaterThanOrEqual(4);
    expect(LANDING_TAGLINES.length).toBeLessThanOrEqual(6);
  });

  it("has no duplicate phrases", () => {
    const unique = new Set(LANDING_TAGLINES);
    expect(unique.size).toBe(LANDING_TAGLINES.length);
  });
});

describe("TaglineCycler", () => {
  it("renders one of the taglines on mount", () => {
    render(<TaglineCycler />);
    const el = screen.getByRole("paragraph");
    expect(LANDING_TAGLINES).toContain(el.textContent);
  });

  it("cycles to a different phrase after the visible+fade interval", () => {
    render(<TaglineCycler />);
    // Advance past visible period + fade-out + swap
    act(() => {
      vi.advanceTimersByTime(3_000 + 250 + 1);
    });
    const second = screen.getByRole("paragraph").textContent;
    expect(LANDING_TAGLINES).toContain(second);
  });

  it("opacity is 1 initially and 0 during fade-out", () => {
    render(<TaglineCycler />);
    const el = screen.getByRole("paragraph");
    expect(el).toHaveStyle({ opacity: "1" });
    // Advance into fade-out window (visible period elapsed but fade not done)
    act(() => {
      vi.advanceTimersByTime(3_001);
    });
    expect(el).toHaveStyle({ opacity: "0" });
  });
});
