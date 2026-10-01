import { describe, expect, it } from "vitest";

import { searchQueryInputSchema } from "./search.js";

const NULL_BYTE = String.fromCharCode(0);
const ZERO_WIDTH = String.fromCharCode(0x20_0b);

describe("searchQueryInputSchema — safeText guard on `q`", () => {
  it("defaults scope to mine and limit to 20", () => {
    const parsed = searchQueryInputSchema.parse({ q: "PR" });
    expect(parsed.scope).toBe("mine");
    expect(parsed.limit).toBe(20);
  });

  it("accepts a normal two-character query (min-2 floor)", () => {
    const ok = searchQueryInputSchema.safeParse({ q: "PR" });
    expect(ok.success).toBe(true);
  });

  it("rejects a single-character query (min-2 floor preserved)", () => {
    const bad = searchQueryInputSchema.safeParse({ q: "a" });
    expect(bad.success).toBe(false);
  });

  it("rejects a query containing a null byte", () => {
    const bad = searchQueryInputSchema.safeParse({ q: `ab${NULL_BYTE}cd` });
    expect(bad.success).toBe(false);
  });

  it("rejects an invisible-only query (zero-width chars)", () => {
    const bad = searchQueryInputSchema.safeParse({
      q: `${ZERO_WIDTH}${ZERO_WIDTH}`,
    });
    expect(bad.success).toBe(false);
  });

  it.each([1, 50])("accepts limit boundary %i", (limit) => {
    expect(searchQueryInputSchema.safeParse({ q: "PR", limit }).success).toBe(
      true,
    );
  });

  it.each([0, 51])("rejects out-of-range limit %i", (limit) => {
    expect(searchQueryInputSchema.safeParse({ q: "PR", limit }).success).toBe(
      false,
    );
  });

  it("rejects an unknown scope", () => {
    expect(
      searchQueryInputSchema.safeParse({ q: "PR", scope: "team" }).success,
    ).toBe(false);
  });
});
