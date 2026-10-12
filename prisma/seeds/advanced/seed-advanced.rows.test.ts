import { itemOutcomeStateSchema } from "@customreport/shared";
import { type Prisma, type PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { type ItemRow, upsertItem } from "./seed-advanced.rows.js";

const row: ItemRow = {
  id: "a0000000-0000-4000-8000-000000000501",
  stableId: "a0000000-0000-4000-8000-000000000502",
  reportSectionId: "a0000000-0000-4000-8000-000000000401",
  projectId: "a0000000-0000-4000-8000-000000000201",
  type: "current",
  text: "Synthetic deterministic item",
  tag: "feature",
  workflowStatus: "in_progress",
  stageNames: ["Development"],
};

const tuple = (value: ItemRow) => ({
  type: value.type,
  workflowStatus: value.workflowStatus,
  pausedReason: value.pausedReason ?? null,
  nextStepText: null,
});

// Storage applies only ordinary supplied-field merge; product invariant checks
// are performed by the real canonical schema in the assertions below.
const store = (initial?: ItemRow) => {
  const records = new Map<string, ItemRow>(
    initial ? [[initial.id, initial]] : [],
  );
  const upsert = vi.fn(({ where, create, update }: Prisma.ItemUpsertArgs) => {
    const previous = records.get(String(where.id));
    const supplied = Object.fromEntries(Object.entries(update));
    const persisted = (
      previous ? { ...previous, ...supplied } : create
    ) as ItemRow;
    records.set(persisted.id, persisted);
    return Promise.resolve(persisted);
  });
  const prisma = { item: { upsert } } as unknown as Pick<PrismaClient, "item">;
  return { prisma, records };
};

describe("advanced item persistence", () => {
  it.each(["planned", "in_progress", "postponed", "done"] as const)(
    "clears a saved pause reason when restoring %s",
    async (workflowStatus) => {
      const paused: ItemRow = {
        ...row,
        workflowStatus: "paused",
        pausedReason: "Synthetic pause restore",
      };
      expect(itemOutcomeStateSchema.safeParse(tuple(paused)).success).toBe(
        true,
      );
      const storage = store(paused);
      await upsertItem(storage.prisma, { ...row, workflowStatus });
      const persisted = storage.records.get(row.id);
      expect(persisted?.pausedReason).toBeNull();
      expect(persisted).toMatchObject({
        id: row.id,
        stableId: row.stableId,
        reportSectionId: row.reportSectionId,
        workflowStatus,
      });
      expect(
        itemOutcomeStateSchema.safeParse(tuple(persisted ?? paused)).success,
      ).toBe(true);
    },
  );

  it("preserves a supplied valid pause reason and creation identity", async () => {
    const paused: ItemRow = {
      ...row,
      workflowStatus: "paused",
      pausedReason: "Still awaiting approval",
    };
    const storage = store();
    await upsertItem(storage.prisma, paused);
    expect(storage.records.get(row.id)).toMatchObject({
      id: row.id,
      stableId: row.stableId,
      reportSectionId: row.reportSectionId,
      pausedReason: paused.pausedReason,
    });
    expect(itemOutcomeStateSchema.safeParse(tuple(paused)).success).toBe(true);
  });

  it.each([
    { ...row, workflowStatus: "paused" as const },
    { ...row, workflowStatus: "paused" as const, pausedReason: " " },
    { ...row, pausedReason: "Stale non-paused reason" },
  ])("does not make invalid supplied tuples legal: %j", (invalid) => {
    expect(itemOutcomeStateSchema.safeParse(tuple(invalid)).success).toBe(
      false,
    );
  });
});
