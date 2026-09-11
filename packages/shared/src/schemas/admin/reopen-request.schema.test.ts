import { describe, expect, expectTypeOf, it } from "vitest";

import {
  type ReopenRequestCursor,
  type ReopenRequestListInput,
  reopenRequestListInputSchema,
} from "../../index";

const CURSOR = {
  id: "11111111-1111-4111-8111-111111111111",
  createdAt: "2026-09-06T08:30:00.000Z",
} as const;

describe("reopenRequestListInputSchema", () => {
  it("normalizes an omitted request to the first pending page", () => {
    const input = reopenRequestListInputSchema.parse(undefined);

    expect(input).toEqual({ status: "pending", limit: 50 });
    expectTypeOf(input).toEqualTypeOf<ReopenRequestListInput>();
  });

  it("accepts the actual forward transport input with a compound cursor", () => {
    const input = reopenRequestListInputSchema.parse({
      status: "all",
      limit: 100,
      cursor: CURSOR,
      search: "  Weekly 36  ",
      direction: "forward",
    });

    expect(input).toEqual({
      status: "all",
      limit: 100,
      cursor: CURSOR,
      search: "Weekly 36",
      direction: "forward",
    });
    expectTypeOf(input.cursor).toEqualTypeOf<
      ReopenRequestCursor | null | undefined
    >();
  });

  it.each([
    ["zero limit", { limit: 0 }],
    ["oversized limit", { limit: 101 }],
    ["fractional limit", { limit: 1.5 }],
    ["malformed cursor id", { cursor: { ...CURSOR, id: "request-1" } }],
    ["malformed cursor time", { cursor: { ...CURSOR, createdAt: "today" } }],
    ["oversized search", { search: "x".repeat(501) }],
    ["backward traversal", { cursor: CURSOR, direction: "backward" }],
    ["unknown property", { totalCount: true }],
  ])("rejects %s", (_label, candidate) => {
    expect(reopenRequestListInputSchema.safeParse(candidate).success).toBe(
      false,
    );
  });
});
