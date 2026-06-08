/**
 * Regression tests for PulseBackground — catalog: verify-a11y-recommended-flip
 *
 * NOTE: The catalog header claims "aria-hidden='true' was added to the first
 * SVG path element (ECG primary track)". The current source hides the entire
 * decorative subtree at the container level (div.pulse-bg aria-hidden + svg
 * aria-hidden), not on individual path elements. Assertions reflect the actual
 * source; catalog prose about the path-level attribute is not implemented.
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
  });

  describe("SVG accessibility hierarchy", () => {
    it("svg.pulse-bg-ecg has aria-hidden='true'", () => {
      const { container } = render(<PulseBackground />);
      const svg = container.querySelector("svg.pulse-bg-ecg");
      expect(svg).not.toBeNull();
      expect(svg).toHaveAttribute("aria-hidden", "true");
    });
  });

  describe("ECG path elements remain in the DOM", () => {
    it("primary ECG path is rendered and present in the DOM", () => {
      const { container } = render(<PulseBackground />);
      const svg = container.querySelector("svg.pulse-bg-ecg");
      const paths = svg?.querySelectorAll("path");
      expect(paths?.length).toBeGreaterThanOrEqual(1);
      // First path (primary track) is in the DOM despite container aria-hidden
      expect(paths?.[0]).not.toBeNull();
    });

    it("secondary ECG path is rendered and present in the DOM", () => {
      const { container } = render(<PulseBackground />);
      const svg = container.querySelector("svg.pulse-bg-ecg");
      const paths = svg?.querySelectorAll("path");
      expect(paths?.length).toBeGreaterThanOrEqual(2);
      expect(paths?.[1]).not.toBeNull();
    });
  });

  describe("component snapshot", () => {
    it("matches DOM snapshot (aria-hidden on container and svg, no path-level aria-hidden)", () => {
      const { container } = render(<PulseBackground />);
      expect(container.firstChild).toMatchSnapshot();
    });
  });
});
