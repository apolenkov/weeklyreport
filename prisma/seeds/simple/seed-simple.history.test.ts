import { type PrismaClient, ReportStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { archiveHistoryRowIds, historyRowId } from "./seed-simple.history.js";
import { LEADS } from "./seed-simple.leads.js";
import { EXTRA_REPORTS } from "./seed-simple.period.js";
import {
  deterministicSeedRecordId,
  seedActiveSections,
} from "./seed-simple.sections.js";

interface SeedRecordIdentity {
  readonly id: string;
  readonly stableId: string;
}

const captureActiveRecordIdentities = async () => {
  const items: SeedRecordIdentity[] = [];
  const risks: SeedRecordIdentity[] = [];
  const decisions: SeedRecordIdentity[] = [];
  const ignoredCreate = () => Promise.resolve({});
  const ignoredCreateMany = () => Promise.resolve({ count: 0 });
  const prisma = {
    reportSection: { create: ignoredCreate },
    projectStatus: { create: ignoredCreate },
    stageStatus: { createMany: ignoredCreateMany },
    item: {
      createMany: (input: { readonly data: readonly SeedRecordIdentity[] }) => {
        items.push(...input.data);
        return Promise.resolve({ count: input.data.length });
      },
    },
    risk: {
      create: (input: { readonly data: SeedRecordIdentity }) => {
        risks.push(input.data);
        return Promise.resolve(input.data);
      },
    },
    decision: {
      createMany: (input: { readonly data: readonly SeedRecordIdentity[] }) => {
        decisions.push(...input.data);
        return Promise.resolve({ count: input.data.length });
      },
    },
  } as unknown as PrismaClient;

  await seedActiveSections(prisma);
  return { items, risks, decisions };
};

describe("simple active record identity", () => {
  it("keeps kind, lead, and ordinal identities stable and unique", () => {
    const ids = [
      deterministicSeedRecordId("item", 0, 1),
      deterministicSeedRecordId("item", 0, 2),
      deterministicSeedRecordId("risk", 0, 1),
      deterministicSeedRecordId("decision", 0, 1),
      deterministicSeedRecordId("decision", 1, 1),
    ];

    expect(ids).toEqual([
      "a0000000-0000-4000-8000-000000500001",
      "a0000000-0000-4000-8000-000000500002",
      "a0000000-0000-4000-8000-000000900001",
      "a0000000-0000-4000-8000-000000700001",
      "a0000000-0000-4000-8000-000000701001",
    ]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(
      ids.every((id) => /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(id)),
    ).toBe(true);
  });

  it("emits identical primary and durable identities on equivalent rebuilds", async () => {
    const first = await captureActiveRecordIdentities();
    const second = await captureActiveRecordIdentities();

    expect(second).toEqual(first);
    for (const collection of [first.items, first.risks, first.decisions]) {
      expect(collection.length).toBeGreaterThan(0);
      expect(collection.every((record) => record.id && record.stableId)).toBe(
        true,
      );
      expect(new Set(collection.map((record) => record.stableId)).size).toBe(
        collection.length,
      );
    }
  });
});

describe("seed-simple history row identity", () => {
  it("derives the same id from the same tail on every call", () => {
    expect(historyRowId(0x6_00)).toBe("c0000000-0000-4000-8000-000000000600");
    expect(historyRowId(0x6_00)).toBe(historyRowId(0x6_00));
  });

  it("keeps ids unique across the published and archive ranges", () => {
    const ids = new Set(
      [
        0x6_00,
        0x6_10,
        0x6_20, // published block (lead 0)
        0x7_00,
        0x7_10,
        0x7_20, // archive period 0, lead 0
        0x7_41,
        0x7_51,
        0x7_61, // archive period 1, lead 1
      ].map(historyRowId),
    );
    expect(ids.size).toBe(9);
  });

  it("keeps every generated archive row id unique across all shapes", () => {
    const archivedPeriods = EXTRA_REPORTS.filter(
      ({ status }) => status === ReportStatus.published,
    );
    const ids = archivedPeriods.flatMap((_, periodIdx) =>
      LEADS.flatMap((_, leadIdx) => {
        const { currentItemId, nextItemId, statusId } = archiveHistoryRowIds(
          periodIdx,
          leadIdx,
        );
        return [currentItemId, nextItemId, statusId];
      }),
    );

    expect(ids).toHaveLength(archivedPeriods.length * LEADS.length * 3);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("produces a well-formed uuid-shaped id", () => {
    const id = historyRowId(0x7_00);
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });
});
