import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PulseMark } from "./pulse-mark";

afterEach(() => {
  cleanup();
});

describe("PulseMark", () => {
  it("root container has role='img'", () => {
    render(<PulseMark />);
    const img = screen.getByRole("img");
    expect(img).toBeInTheDocument();
  });

  it("root container has aria-label='Your PULSE'", () => {
    render(<PulseMark />);
    const img = screen.getByRole("img", { name: "Your PULSE" });
    expect(img).toBeInTheDocument();
  });

  it("span.pulse-word has aria-hidden='true'", () => {
    const { container } = render(<PulseMark />);
    const wordSpan = container.querySelector(".pulse-word");
    expect(wordSpan).not.toBeNull();
    expect(wordSpan).toHaveAttribute("aria-hidden", "true");
  });

  it("span.pulse-strong has aria-hidden='true'", () => {
    const { container } = render(<PulseMark />);
    const strongSpan = container.querySelector(".pulse-strong");
    expect(strongSpan).not.toBeNull();
    expect(strongSpan).toHaveAttribute("aria-hidden", "true");
  });

  it("role=img with aria-label exposes a single composite image — accessible name comes from aria-label only", () => {
    render(<PulseMark />);
    // The only accessible element is the single role=img container.
    const imgs = screen.getAllByRole("img");
    expect(imgs).toHaveLength(1);
    // Its accessible name comes from aria-label, not from text children.
    expect(imgs[0]).toHaveAccessibleName("Your PULSE");
    // The aria-hidden spans are present in the DOM but excluded from the
    // accessible name computation — the name must not contain raw "YOUR PULSE"
    // concatenated from children (it is driven by aria-label instead).
    const img = imgs[0];
    expect(img.getAttribute("aria-label")).toBe("Your PULSE");
    // Confirm the text children carry aria-hidden so AT ignores them.
    const wordSpan = img.querySelector(".pulse-word");
    const strongSpan = img.querySelector(".pulse-strong");
    expect(wordSpan).toHaveAttribute("aria-hidden", "true");
    expect(strongSpan).toHaveAttribute("aria-hidden", "true");
  });

  it("component render tree matches snapshot", () => {
    const { container } = render(<PulseMark />);
    expect(container.firstChild).toMatchSnapshot();
  });
});
