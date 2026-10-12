import { describe, expect, it } from "vitest";

import {
  itemId,
  projectStatusId,
  stageAssignmentId,
} from "./seed-advanced.ids.js";

const validUuid =
  /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-8[\da-f]{3}-[\da-f]{12}$/u;

describe("advanced deterministic IDs", () => {
  it.each([
    [itemId("1", 1, 10), "item slot10"],
    [projectStatusId("1", 1, 10), "project slot10"],
    [stageAssignmentId(16, 2), "assignment index16"],
  ])("emits a valid UUID for %s (%s)", (id) => {
    expect(id).toHaveLength(36);
    expect(id).toMatch(validUuid);
  });

  it("keeps previous valid UUID bytes", () => {
    expect(itemId("1", 0, 0)).toBe("a0000000-0000-4000-8000-000000005100");
    expect(itemId("5", 9, 9)).toBe("a0000000-0000-4000-8000-000000005599");
    expect(projectStatusId("1", 0, 0)).toBe(
      "a0000000-0000-4000-8000-000000006100",
    );
    expect(projectStatusId("5", 9, 9)).toBe(
      "a0000000-0000-4000-8000-000000006599",
    );
    expect(stageAssignmentId(0, 0)).toBe(
      "a0000000-0000-4000-8000-00000000b000",
    );
    expect(stageAssignmentId(15, 2)).toBe(
      "a0000000-0000-4000-8000-00000000b0f2",
    );
    expect(stageAssignmentId(15, 9)).toBe(
      "a0000000-0000-4000-8000-00000000b0f9",
    );
  });

  it("keeps boundary tuples injective and categories disjoint", () => {
    const ids = [
      ...[0, 9, 10, 255].flatMap((lead) =>
        [0, 9, 10, 4095].flatMap((seq) => [
          itemId("1", lead, seq),
          itemId("5", lead, seq),
          projectStatusId("1", lead, seq),
        ]),
      ),
      ...[0, 15, 16, 4095].flatMap((product) =>
        [0, 2, 9, 15].map((stage) => stageAssignmentId(product, stage)),
      ),
    ];
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(validUuid);
  });

  it.each([-1, 0.5, NaN, Infinity, 256])(
    "rejects invalid lead field %s",
    (lead) => {
      expect(() => itemId("1", lead, 1)).toThrow(RangeError);
      expect(() => projectStatusId("1", lead, 1)).toThrow(RangeError);
    },
  );
  it.each([-1, 0.5, NaN, Infinity, 4096])(
    "rejects invalid sequence/product field %s",
    (value) => {
      expect(() => itemId("1", 1, value)).toThrow(RangeError);
      expect(() => projectStatusId("1", 1, value)).toThrow(RangeError);
      expect(() => stageAssignmentId(value, 0)).toThrow(RangeError);
    },
  );
  it.each([-1, 0.5, NaN, Infinity, 16])(
    "rejects invalid stage field %s",
    (stage) => {
      expect(() => stageAssignmentId(0, stage)).toThrow(RangeError);
    },
  );
});
