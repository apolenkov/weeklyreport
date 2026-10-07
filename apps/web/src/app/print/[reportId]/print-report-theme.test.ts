import { describe, expect, it } from "vitest";

import { printStatusColor, TEXT_TERTIARY } from "./print-report-theme";

// WCAG 2.x relative luminance helpers.
function luminanceChannel(channel255: number): number {
  const channel = channel255 / 255;
  return channel <= 0.03928
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}

function contrastOnWhite(hex: string): number {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  const luminance =
    0.2126 * luminanceChannel(r) +
    0.7152 * luminanceChannel(g) +
    0.0722 * luminanceChannel(b);
  return 1.05 / (luminance + 0.05);
}

// Black ink at alpha `a` over white paper.
function alphaContrastOnWhite(rgba: string): number {
  const alpha = Number(/,([\d.]+)\)$/.exec(rgba)?.[1]);
  const channel = 1 - alpha;
  const lin =
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  return 1.05 / (lin + 0.05);
}

describe("print palette", () => {
  it("keeps muted text at WCAG AA (4.5:1) for small footer/meta text", () => {
    expect(alphaContrastOnWhite(TEXT_TERTIARY)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(["on-track", "at-risk", "blocked", "empty"] as const)(
    "keeps %s status ink at WCAG AA on white paper",
    (status) => {
      expect(contrastOnWhite(printStatusColor(status))).toBeGreaterThanOrEqual(
        4.5,
      );
    },
  );
});
