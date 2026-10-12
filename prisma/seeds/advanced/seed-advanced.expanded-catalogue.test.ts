import type { Prisma, PrismaClient } from "@prisma/client";
import { expect, it, vi } from "vitest";

vi.mock("../support/seed-constants.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../support/seed-constants.js")>();
  const products = Array.from({ length: 18 }, (_, index) => ({
    id: `a0000000-0000-4000-8000-${(0x20_00 + index).toString(16).padStart(12, "0")}`,
    name: `Synthetic expanded product ${index}`,
    leadId: actual.LEAD_1_ID,
  }));
  return { ...actual, SEED_PRODUCTS: [...actual.SEED_PRODUCTS, ...products] };
});

import { SEED_PRODUCTS, SEED_STAGES } from "../support/seed-constants.js";
import { seedHistoryPeriods } from "./seed-advanced.history.js";
import { seedPublishedSections } from "./seed-advanced.published-sections.js";
import { seedStageAssignments } from "./seed-advanced.stage-assignments.js";

const validUuid =
  /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-8[\da-f]{3}-[\da-f]{12}$/u;

it("keeps expanded assignment, published and history rows valid and repeatable through their real writers", async () => {
  const assignments = new Map<string, Prisma.StageAssignmentCreateManyInput>();
  const items = new Map<string, Prisma.ItemUncheckedCreateInput>();
  const statuses = new Map<string, Prisma.ProjectStatusUncheckedCreateInput>();
  const sections = new Map<string, Prisma.ReportSectionUncheckedCreateInput>();
  function capture<T extends { id?: string }>(rows: Map<string, T>) {
    return {
      upsert: ({ create }: { create: T }) => {
        if (typeof create.id !== "string")
          throw new TypeError("Expected deterministic create identity");
        expect(create.id).toMatch(validUuid);
        rows.set(create.id, create);
        return Promise.resolve(create);
      },
    };
  }
  const prisma = {
    stageAssignment: {
      upsert: ({
        create,
      }: {
        create: Prisma.StageAssignmentCreateManyInput;
      }) => {
        expect(create.id).toMatch(validUuid);
        assignments.set(`${create.projectId}|${create.stageId}`, create);
        return Promise.resolve(create);
      },
      findUnique: ({ where }: Prisma.StageAssignmentFindUniqueArgs) => {
        const key = where.stageId_projectId;
        return Promise.resolve(
          key
            ? (assignments.get(`${key.projectId}|${key.stageId}`) ?? null)
            : null,
        );
      },
      findMany: () => Promise.resolve([...assignments.values()]),
    },
    report: capture(new Map<string, Prisma.ReportUncheckedCreateInput>()),
    reportSection: capture(sections),
    item: { ...capture(items), update: () => Promise.resolve(null) },
    projectStatus: capture(statuses),
  } as unknown as PrismaClient;
  const { ownership, count } = await seedStageAssignments(prisma);
  expect(count).toBe(SEED_PRODUCTS.length * 3);
  await seedPublishedSections(prisma, ownership);
  await seedHistoryPeriods(prisma, ownership);
  const baseline = {
    assignments: [...assignments.values()],
    items: [...items.values()],
    statuses: [...statuses.values()],
    sections: [...sections.values()],
  };
  const combinedIds = [
    ...items.keys(),
    ...statuses.keys(),
    ...sections.keys(),
    ...assignments.values(),
  ].map((value) => (typeof value === "string" ? value : value.id));
  expect(new Set(combinedIds).size).toBe(combinedIds.length);
  expect(items.size).toBe(SEED_PRODUCTS.length * 4);
  expect(statuses.size).toBe(SEED_PRODUCTS.length * 4);
  for (const item of items.values()) {
    const author = sections.get(item.reportSectionId)?.authorId;
    expect(author).toBeDefined();
    const names = Array.isArray(item.stageNames) ? item.stageNames : [];
    expect(names).toHaveLength(1);
    const stage = SEED_STAGES.find((entry) => names.includes(entry.name));
    expect(
      assignments.get(`${String(item.projectId)}|${String(stage?.id)}`)?.userId,
    ).toBe(author);
    expect(item.stableId).toBe(item.id);
  }
  const repeat = await seedStageAssignments(prisma);
  await seedPublishedSections(prisma, repeat.ownership);
  await seedHistoryPeriods(prisma, repeat.ownership);
  expect({
    assignments: [...assignments.values()],
    items: [...items.values()],
    statuses: [...statuses.values()],
    sections: [...sections.values()],
  }).toEqual(baseline);
});
