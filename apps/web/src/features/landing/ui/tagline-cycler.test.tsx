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

  // VA-0a: p element has implicit paragraph role — no role="text" override present
  it("p element has no explicit role attribute (implicit paragraph role only)", () => {
    render(<TaglineCycler />);
    const el = screen.getByRole("paragraph");
    expect(el).not.toHaveAttribute("role");
  });

  // VA-0a: getByRole('paragraph') resolves after role="text" removal
  it("getByRole('paragraph') locates the element without a role override", () => {
    render(<TaglineCycler />);
    // If role="text" were still present, 'paragraph' query would fail
    expect(() => screen.getByRole("paragraph")).not.toThrow();
    const el = screen.getByRole("paragraph");
    expect(el.tagName.toLowerCase()).toBe("p");
  });

  it("cycles to a different phrase after the visible+fade interval", () => {
    render(<TaglineCycler />);
    const first = screen.getByRole("paragraph").textContent;
    // Advance past visible period + fade-out + swap
    act(() => {
      vi.advanceTimersByTime(3000 + 250 + 1);
    });
    const second = screen.getByRole("paragraph").textContent;
    expect(LANDING_TAGLINES).toContain(second);
    expect(second).not.toBe(first);
  });

  it("opacity is 1 initially and 0 during fade-out", () => {
    render(<TaglineCycler />);
    const el = screen.getByRole("paragraph");
    expect(el).toHaveStyle({ opacity: "1" });
    // Advance into fade-out window (visible period elapsed but fade not done)
    act(() => {
      vi.advanceTimersByTime(3001);
    });
    expect(el).toHaveStyle({ opacity: "0" });
  });
});
