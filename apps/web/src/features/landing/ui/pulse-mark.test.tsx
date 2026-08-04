import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PulseMark } from "./pulse-mark";

afterEach(() => {
  cleanup();
});

describe("PulseMark", () => {
  it("exposes the composite wordmark as a single image named by its aria-label", () => {
    render(<PulseMark />);

    const img = screen.getByRole("img", { name: "Weekly Report" });
    expect(img.getAttribute("aria-label")).toBe("Weekly Report");
    expect(screen.getAllByRole("img")).toHaveLength(1);
  });

  it("hides the text layers from the a11y tree while rendering the two-tier wordmark", () => {
    const { container } = render(<PulseMark />);

    expect(container.querySelector(".pulse-word")?.textContent).toBe("WEEKLY");
    expect(container.querySelector(".pulse-strong")?.textContent).toBe(
      "REPORT",
    );
    const wordSpan = container.querySelector(".pulse-word");
    expect(wordSpan).not.toBeNull();
    expect(wordSpan).toHaveAttribute("aria-hidden", "true");
    const strongSpan = container.querySelector(".pulse-strong");
    expect(strongSpan).not.toBeNull();
    expect(strongSpan).toHaveAttribute("aria-hidden", "true");
  });
});
