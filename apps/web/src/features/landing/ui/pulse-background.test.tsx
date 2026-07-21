/**
 * Regression tests for PulseBackground.
 *
 * The background is a static container (gradient + dot grid), with no
 * decorative ECG/heartbeat SVG layer, kept fully out of the a11y tree via
 * aria-hidden on the wrapper.
 */
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

  describe("no decorative pulse motion", () => {
    it("renders no ECG/heartbeat SVG layer", () => {
      const { container } = render(<PulseBackground />);
      expect(container.querySelector("svg.pulse-bg-ecg")).toBeNull();
      expect(container.querySelector("path")).toBeNull();
    });
  });

  describe("component snapshot", () => {
    it("matches DOM snapshot (static gradient + dot grid, no ECG)", () => {
      const { container } = render(<PulseBackground />);
      expect(container.firstChild).toMatchSnapshot();
    });
  });
});
