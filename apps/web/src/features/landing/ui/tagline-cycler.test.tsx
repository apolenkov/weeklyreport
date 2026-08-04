import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LANDING_TAGLINES } from "./landing-page.constants";
import {
  TAGLINE_FADE_MS,
  TAGLINE_VISIBLE_MS,
  TaglineCycler,
} from "./tagline-cycler";

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

  it("renders a plain <p> with its implicit paragraph role, no role override", () => {
    render(<TaglineCycler />);
    const el = screen.getByRole("paragraph");
    expect(el.tagName.toLowerCase()).toBe("p");
    expect(el).not.toHaveAttribute("role");
  });

  it("omits the tagline element entirely when the curated array is empty", async () => {
    // Spec landing-page-hero, "Tagline array is empty (defensive)".
    vi.resetModules();
    vi.doMock("./landing-page.constants", () => ({ LANDING_TAGLINES: [] }));
    const { TaglineCycler: EmptyCycler } = await import("./tagline-cycler");
    const { container } = render(<EmptyCycler />);
    expect(container).toBeEmptyDOMElement();
    vi.doUnmock("./landing-page.constants");
    vi.resetModules();
  });

  it("cycles to a different phrase after the visible+fade interval", () => {
    render(<TaglineCycler />);
    const first = screen.getByRole("paragraph").textContent;
    // Advance past visible period + fade-out + swap
    act(() => {
      vi.advanceTimersByTime(TAGLINE_VISIBLE_MS + TAGLINE_FADE_MS + 1);
    });
    const second = screen.getByRole("paragraph").textContent;
    expect(LANDING_TAGLINES).toContain(second);
    expect(second).not.toBe(first);
  });

  it("opacity is 1 initially and 0 during fade-out", () => {
    render(<TaglineCycler />);
    const el = screen.getByRole("paragraph");
    expect(el).toHaveStyle({
      opacity: "1",
      transitionDuration: `${TAGLINE_FADE_MS}ms`,
    });
    // Advance into fade-out window (visible period elapsed but fade not done)
    act(() => {
      vi.advanceTimersByTime(TAGLINE_VISIBLE_MS + 1);
    });
    expect(el).toHaveStyle({ opacity: "0" });
  });
});
