import { describe, expect, it } from "vitest";

import { MAX_PRODUCTS_PER_LEAD, SLIDE_SECTION_SOFT_CAP } from "./constants";

describe("slide-capacity soft caps", () => {
  it("exports positive advisory constants", () => {
    expect(MAX_PRODUCTS_PER_LEAD).toBeGreaterThan(0);
    expect(SLIDE_SECTION_SOFT_CAP).toBeGreaterThan(0);
  });

  it("matches the agreed advisory values (6 products / 5 records)", () => {
    expect(MAX_PRODUCTS_PER_LEAD).toBe(6);
    expect(SLIDE_SECTION_SOFT_CAP).toBe(5);
  });
});
