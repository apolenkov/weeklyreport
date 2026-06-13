import { describe, expect, it } from "vitest";

import { pluralize } from "./pluralize";

describe("pluralize", () => {
  it("returns the singular form for exactly 1", () => {
    expect(pluralize(1, "item", "items")).toBe("item");
  });

  it("returns the plural form for 0", () => {
    expect(pluralize(0, "item", "items")).toBe("items");
  });

  it("returns the plural form for N > 1", () => {
    expect(pluralize(5, "item", "items")).toBe("items");
  });
});
