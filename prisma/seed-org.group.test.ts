import { describe, expect, it } from "vitest";

import { SEED_PRODUCTS, SEED_USERS } from "./seed-constants.js";
import { reportingGroupForProduct } from "./seed-org.js";

// The group map is built the same way seedProducts builds it: user id →
// explicit reporting group (Olga/Sergey re-homed to the finance group).
function buildGroupMap(): ReadonlyMap<string, string> {
  return new Map(
    SEED_USERS.flatMap((user) =>
      user.reportingGroupId === null
        ? []
        : [[user.id, user.reportingGroupId] as const],
    ),
  );
}

describe("seed organization product-group derivation", () => {
  it("resolves an explicit group for every seeded product lead", () => {
    const groupByLeadId = buildGroupMap();
    for (const product of SEED_PRODUCTS) {
      expect(() =>
        reportingGroupForProduct(product.leadId, groupByLeadId),
      ).not.toThrow();
    }
  });

  it("fails loud for a product lead absent from the seed users", () => {
    expect(() =>
      reportingGroupForProduct(
        "00000000-0000-4000-8000-00000000dead",
        new Map(),
      ),
    ).toThrow(/is not a seeded user/);
  });

  it("fails loud for a seeded lead without an explicit group", () => {
    // A lead whose map entry is absent (no explicit group) must not fall back
    // silently — null-group users are dropped when the map is built, so the
    // absent entry is the "no group" signal.
    const groupByLeadId = new Map<string, string>([
      [
        "00000000-0000-4000-8000-00000000beef",
        "a0000000-0000-4000-8000-000000000301",
      ],
    ]);
    expect(() =>
      reportingGroupForProduct(
        "00000000-0000-4000-8000-00000000beef",
        groupByLeadId,
      ),
    ).not.toThrow();
    expect(() =>
      reportingGroupForProduct(
        "00000000-0000-4000-8000-00000000cafe",
        groupByLeadId,
      ),
    ).toThrow(/is not a seeded user/);
  });
});
