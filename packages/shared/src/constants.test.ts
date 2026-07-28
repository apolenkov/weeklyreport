import { describe, expect, it } from "vitest";

import { MAX_PRODUCTS_PER_LEAD } from "./constants";

describe("slide-capacity soft caps", () => {
  it("matches the agreed advisory value (6 products)", () => {
    expect(MAX_PRODUCTS_PER_LEAD).toBe(6);
  });
});
