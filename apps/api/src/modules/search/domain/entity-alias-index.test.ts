import { describe, expect, it } from "vitest";

import {
  buildEntityAliasIndex,
  normalizeEntityReference,
  resolveExactAlias,
} from "./entity-alias-index";

describe("normalizeEntityReference", () => {
  it("normalizes NFKC, dashes, whitespace, and case", () => {
    expect(normalizeEntityReference("  ＯＰＳ—Team\n")).toBe("ops-team");
  });
});

describe("buildEntityAliasIndex", () => {
  const index = buildEntityAliasIndex([
    { kind: "author", id: "author-1", aliases: ["Анна  Лид"] },
    { kind: "product", id: "product-1", aliases: ["Platform API"] },
    { kind: "activity", id: "activity-1", aliases: ["On-call", "OPS—TEAM"] },
    { kind: "period", id: "period-1", aliases: ["Week 31"] },
  ]);

  it("resolves exact aliases for every authorized entity kind", () => {
    expect(resolveExactAlias(index, "анна лид")).toHaveLength(1);
    expect(resolveExactAlias(index, "platform api")[0]?.id).toBe("product-1");
    expect(resolveExactAlias(index, "ops-team")[0]?.id).toBe("activity-1");
    expect(resolveExactAlias(index, "week 31")[0]?.id).toBe("period-1");
  });

  it("does not fuzzy-match a reference", () => {
    expect(resolveExactAlias(index, "platform")).toEqual([]);
  });

  it("retains ambiguity instead of selecting a first match", () => {
    const ambiguous = buildEntityAliasIndex([
      { kind: "author", id: "a", aliases: ["Alex"] },
      { kind: "author", id: "b", aliases: ["alex"] },
    ]);
    expect(resolveExactAlias(ambiguous, "ALEX").map(({ id }) => id)).toEqual([
      "a",
      "b",
    ]);
  });
});
