import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PulseBackground } from "./pulse-background";

describe("PulseBackground", () => {
  describe("pulse-bg container — aria-hidden", () => {
    it("div.pulse-bg has aria-hidden='true'", () => {
      const { container } = render(<PulseBackground />);
      const bg = container.querySelector(".pulse-bg");
      expect(bg).not.toBeNull();
      expect(bg).toHaveAttribute("aria-hidden", "true");
    });

    it("renders the static dot-grid layer", () => {
      const { container } = render(<PulseBackground />);
      expect(container.querySelector(".pulse-bg-dots")).not.toBeNull();
    });
  });

  describe("component snapshot", () => {
    it("matches DOM snapshot (static gradient + dot grid)", () => {
      const { container } = render(<PulseBackground />);
      expect(container.firstChild).toMatchSnapshot();
    });
  });
});
