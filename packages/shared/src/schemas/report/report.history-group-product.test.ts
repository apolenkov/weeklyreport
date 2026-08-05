import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  compiledHistoryEntrySchema,
  compiledHistoryInputSchema,
  groupProductEdgeInputSchema,
  groupProductSchema,
  myHistoryEntrySchema,
} from "../report";

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

  it("rejects a negative aggregate count", () => {
    expect(
      compiledHistoryEntrySchema.safeParse({
        ...validEntry(),
        itemCount: -1,
      }).success,
    ).toBe(false);
  });
});
