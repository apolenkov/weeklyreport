import { describe, expect, it } from "vitest";

import { TEXT_TERTIARY } from "./print-report-theme";

// WCAG 2.x contrast of black at alpha `a` over white paper.
function contrastOnWhite(rgba: string): number {
  const alpha = Number(/,([\d.]+)\)$/.exec(rgba)?.[1]);
  const channel = 1 - alpha;
  const lin =
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  return 1.05 / (lin + 0.05);
}

describe("print palette", () => {
  it("keeps muted text at or above 3:1 on white", () => {
    expect(contrastOnWhite(TEXT_TERTIARY)).toBeGreaterThanOrEqual(3);
  });
});
