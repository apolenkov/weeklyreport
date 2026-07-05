import { describe, expect, it } from "vitest";

import { MAX_PRODUCTS_PER_LEAD } from "./constants";

describe("slide-capacity soft caps", () => {
  it("exports a positive advisory constant", () => {
    expect(MAX_PRODUCTS_PER_LEAD).toBeGreaterThan(0);
  });

  it("matches the agreed advisory value (6 products)", () => {
    expect(MAX_PRODUCTS_PER_LEAD).toBe(6);
  });
});
