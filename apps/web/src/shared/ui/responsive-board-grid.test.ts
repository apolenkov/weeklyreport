import { describe, expect, it } from "vitest";

import { responsiveBoardGridClassName } from "./responsive-board-grid";

describe("responsiveBoardGridClassName", () => {
  it.each([
    [0, "grid gap-4 grid-cols-1"],
    [1, "grid gap-4 grid-cols-1"],
    [2, "grid gap-4 grid-cols-1 md:grid-cols-2"],
    [3, "grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3"],
    [5, "grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3"],
  ] as const)(
    "maps %i columns to an overflow-safe layout",
    (count, expected) => {
      expect(responsiveBoardGridClassName(count)).toBe(expected);
    },
  );
});
