import { describe, expect, it } from "vitest";

import { fixtures } from "./preflight-reveal-pair-diagnosis-fixtures.ts";

describe("pair-level directed-order fixtures", () => {
  it("freezes every directed order for a three-toggle suffix", () => {
    const orders = fixtures().pairs.map(({ path }) =>
      path.steps.map(({ controlKey }) => controlKey).join("->"),
    );

    expect(orders).toEqual(["a->b", "b->a", "a->c", "c->a", "b->c", "c->b"]);
  });
});
