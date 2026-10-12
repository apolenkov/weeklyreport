import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  compiledHistoryEntrySchema,
  compiledHistoryInputSchema,
  groupProductEdgeInputSchema,
  groupProductSchema,
  myHistoryEntrySchema,
} from "../report.js";

const uuid = () => randomUUID();

describe("groupProductSchema", () => {
  it("accepts a well-formed row and coerces its timestamp", () => {
    const row = groupProductSchema.parse({
      id: uuid(),
      groupId: uuid(),
      productId: uuid(),
      createdAt: "2026-05-11T00:00:00.000Z",
    });
    expect(row.createdAt).toBeInstanceOf(Date);
  });

  it.each([
    ["group id", { groupId: "not-a-uuid", productId: uuid() }],
    ["product id", { groupId: uuid(), productId: "not-a-uuid" }],
  ])("rejects an invalid %s", (_label, ids) => {
    expect(
      groupProductSchema.safeParse({
        id: uuid(),
        ...ids,
        createdAt: new Date(),
      }).success,
    ).toBe(false);
  });
});

describe("groupProductEdgeInputSchema", () => {
  it("accepts a group and product UUID pair", () => {
    const edge = { groupId: uuid(), productId: uuid() };
    expect(groupProductEdgeInputSchema.parse(edge)).toEqual(edge);
  });

  it.each([
    { groupId: uuid() },
    { productId: uuid() },
    { groupId: "not-a-uuid", productId: uuid() },
  ])("rejects incomplete or invalid edge %#", (edge) => {
    expect(groupProductEdgeInputSchema.safeParse(edge).success).toBe(false);
  });
});

describe("myHistoryEntrySchema", () => {
  it("accepts aggregates and coerces timestamp strings", () => {
    const parsed = myHistoryEntrySchema.parse({
      sectionId: uuid(),
      reportId: uuid(),
      periodStart: "2026-05-11T00:00:00.000Z",
      periodEnd: "2026-05-17T23:59:59.000Z",
      reportStatus: "draft",
      sectionStatus: "draft",
      archived: false,
      submittedAt: null,
      publishedAt: null,
      createdAt: "2026-05-15T17:33:11.159Z",
      updatedAt: "2026-05-15T17:35:11.159Z",
      lastEditAt: "2026-05-15T17:36:11.159Z",
      itemCount: 5,
      riskCount: 1,
      decisionCount: 2,
      priorityCount: 3,
      productCount: 3,
      trafficLights: { green: 2, yellow: 0, red: 1 },
    });

    expect(parsed.createdAt).toBeInstanceOf(Date);
    expect(parsed.lastEditAt).toBeInstanceOf(Date);
    expect(parsed.itemCount).toBe(5);
    expect(parsed.riskCount).toBe(1);
    expect(parsed.archived).toBe(false);
    expect(parsed.trafficLights).toEqual({ green: 2, yellow: 0, red: 1 });
  });
});

describe("compiledHistoryInputSchema", () => {
  it.each([
    [{}, {}],
    [{ includeArchive: true }, { includeArchive: true }],
  ])("parses input %#", (input, expected) => {
    expect(compiledHistoryInputSchema.parse(input)).toEqual(expected);
  });
});

describe("compiledHistoryEntrySchema", () => {
  const validEntry = () => ({
    reportId: uuid(),
    periodStart: "2026-04-06T00:00:00.000Z",
    periodEnd: "2026-04-12T23:59:59.000Z",
    publishedAt: "2026-04-13T09:00:00.000Z",
    archived: true,
    reopened: false,
    publishedByName: "Head User",
    trafficLights: { green: 3, yellow: 1, red: 0 },
    itemCount: 4,
    riskCount: 1,
    decisionCount: 2,
    priorityCount: 1,
    sectionCount: 2,
    productCount: 3,
  });

  it("accepts a compiled history entry", () => {
    const parsed = compiledHistoryEntrySchema.parse(validEntry());
    expect(parsed.publishedAt).toBeInstanceOf(Date);
    expect(parsed.archived).toBe(true);
    expect(parsed.trafficLights.yellow).toBe(1);
  });

  it("requires the reopened flag", () => {
    const { reopened: _reopened, ...withoutFlag } = validEntry();
    expect(compiledHistoryEntrySchema.safeParse(withoutFlag).success).toBe(
      false,
    );
  });

  it("rejects a negative aggregate count", () => {
    expect(
      compiledHistoryEntrySchema.safeParse({
        ...validEntry(),
        itemCount: -1,
      }).success,
    ).toBe(false);
  });
});

describe("myHistoryEntrySchema — Report period date format", () => {
  const entry = {
    sectionId: "10000000-0000-4000-8000-000000000001",
    reportId: "10000000-0000-4000-8000-000000000002",
    periodStart: "2000-01-01T00:00:00.000Z",
    periodEnd: "2000-01-01T00:00:00.000Z",
    reportStatus: "draft",
    sectionStatus: "draft",
    submittedAt: null,
    publishedAt: null,
  };
  it.each(["periodStart", "periodEnd"] as const)(
    "rejects pre-2000 %s",
    (field) => {
      const result = myHistoryEntrySchema.safeParse({
        ...entry,
        [field]: "1999-12-31T23:59:59.999Z",
      });
      expect(result.success).toBe(false);
      if (!result.success)
        expect(result.error.issues).toContainEqual(
          expect.objectContaining({ path: [field] }),
        );
    },
  );
  it("keeps boundary, optional totals, nullable publication and nonperiod timestamps", () => {
    const result = myHistoryEntrySchema.parse({
      ...entry,
      submittedAt: "1999-12-31T23:59:59.999Z",
    });
    expect(result.periodStart.toISOString()).toBe("2000-01-01T00:00:00.000Z");
    expect(result.periodEnd.toISOString()).toBe("2000-01-01T00:00:00.000Z");
    expect(result.publishedAt).toBeNull();
    expect(result.itemCount).toBeUndefined();
    expect(result.submittedAt?.toISOString()).toBe("1999-12-31T23:59:59.999Z");
  });
});
