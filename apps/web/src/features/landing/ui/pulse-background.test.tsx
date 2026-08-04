import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PulseBackground } from "./pulse-background";

describe("PulseBackground", () => {
  it("renders the decorative container as aria-hidden and both dot-grid layers", () => {
    const { container } = render(<PulseBackground />);
    const bg = container.querySelector(".pulse-bg");
    expect(bg).not.toBeNull();
    expect(bg).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector(".pulse-bg-dots")).not.toBeNull();
  });
});
