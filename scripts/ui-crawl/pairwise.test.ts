import { describe, expect, it } from "vitest";

import { pairwise } from "./pairwise.ts";

type Factor = Readonly<{ id: string; values: readonly string[] }>;
type Assignment = Readonly<Record<string, string>>;

function expectPairCovered(
  left: Factor,
  right: Factor,
  rows: readonly Assignment[],
): void {
  for (const a of left.values) {
    for (const b of right.values) {
      expect(
        rows.some((row) => row[left.id] === a && row[right.id] === b),
        `Missing pair ${JSON.stringify([
          [left.id, a],
          [right.id, b],
        ])}`,
      ).toBe(true);
    }
  }
}

function expectCoverage(
  factors: readonly Factor[],
  rows: readonly Assignment[],
): void {
  for (const row of rows) {
    expect(Object.keys(row).sort()).toEqual(factors.map(({ id }) => id).sort());
    for (const factor of factors)
      expect(factor.values).toContain(row[factor.id]);
  }
  for (const [index, factor] of factors.entries()) {
    expect(new Set(rows.map((row) => row[factor.id]))).toEqual(
      new Set(factor.values),
    );
    for (const other of factors.slice(index + 1))
      expectPairCovered(factor, other, rows);
  }
}

describe("pairwise filter assignments", () => {
  it.each([
    [3, 2, 4, 2],
    [1, 3, 1, 2],
    [5, 1],
  ])("covers every value pair for factor sizes %j", (...sizes) => {
    const factors = sizes.map((size, index) =>
      Object.freeze({
        id: `filter-${index}`,
        values: Object.freeze(
          Array.from({ length: size }, (_, value) => `option-${value}`),
        ),
      }),
    );
    const frozen = Object.freeze(factors);
    const rows = pairwise(frozen);
    expectCoverage(frozen, rows);
    expect(pairwise(frozen)).toEqual(rows);
    expect(
      new Set(
        rows.map((row) => JSON.stringify(factors.map(({ id }) => row[id]))),
      ).size,
    ).toBe(rows.length);
  });

  it("keeps a large binary filter space bounded while covering every pair", () => {
    const factors = Array.from({ length: 20 }, (_, index) => ({
      id: `filter-${index}`,
      values: ["off", "on"],
    }));
    const rows = pairwise(factors);
    expectCoverage(factors, rows);
    expect(rows.length).toBeLessThan(100);
  });

  it.each<{ factors: readonly Factor[]; expected: readonly Assignment[] }>([
    { factors: [], expected: [{}] },
    {
      factors: [{ id: "status", values: ["", "open", "open", "closed"] }],
      expected: [{ status: "" }, { status: "open" }, { status: "closed" }],
    },
    { factors: [{ id: "empty", values: [] }], expected: [] },
    {
      factors: [
        { id: "empty", values: [] },
        { id: "status", values: ["open"] },
      ],
      expected: [],
    },
  ])("handles degenerate factors: $factors", ({ factors, expected }) => {
    expect(pairwise(factors)).toEqual(expected);
  });

  it("distinguishes arbitrary ids and values without separator collisions", () => {
    const factors = [
      { id: "__proto__", values: ["", "a:b", "a:b"] },
      { id: 'a"b', values: ["c:d", "c", "d"] },
      { id: "a", values: ['b"c', "b:c"] },
    ];
    expectCoverage(factors, pairwise(factors));
  });

  it("rejects repeated factor ids instead of losing one assignment", () => {
    expect(() =>
      pairwise([
        { id: "status", values: ["open"] },
        { id: "status", values: ["closed"] },
      ]),
    ).toThrow(/unique ids/);
  });
});
