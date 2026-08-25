import {
  ItemType,
  ItemWorkflowStatus,
  type PrismaClient,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { type ItemRow, upsertItem } from "./seed-advanced.rows.js";
import { logSeedSummary } from "./seed-advanced.summary.js";

const ITEM_ROW: ItemRow = {
  id: "a0000000-0000-4000-8000-000000000501",
  stableId: "a0000000-0000-4000-8000-000000000501",
  reportSectionId: "a0000000-0000-4000-8000-000000000401",
  projectId: "a0000000-0000-4000-8000-000000000201",
  type: ItemType.current,
  text: "Deterministic item",
  tag: "feature",
  workflowStatus: ItemWorkflowStatus.in_progress,
  stageNames: ["Development"],
};

describe("advanced item row writer", () => {
  it("passes durable identity on both create and update paths", async () => {
    const upsert = vi.fn();
    const prisma = {
      item: { upsert },
    } satisfies {
      readonly item: Pick<PrismaClient["item"], "upsert">;
    };

    await upsertItem(prisma, ITEM_ROW);

    expect(upsert).toHaveBeenCalledWith({
      where: { id: ITEM_ROW.id },
      update: {
        reportSectionId: ITEM_ROW.reportSectionId,
        projectId: ITEM_ROW.projectId,
        type: ITEM_ROW.type,
        text: ITEM_ROW.text,
        tag: ITEM_ROW.tag,
        workflowStatus: ITEM_ROW.workflowStatus,
        stageNames: ITEM_ROW.stageNames,
        stableId: ITEM_ROW.stableId,
      },
      create: ITEM_ROW,
    });
  });
});

describe("logSeedSummary", () => {
  it("prints counts supplied by the seed writers", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    logSeedSummary({
      groups: 3,
      users: 9,
      products: 8,
      stages: 7,
      stageAssignments: 11,
      reports: 5,
      sections: {
        sections: 20,
        items: 30,
        projectStatuses: 22,
        stageStatuses: 14,
      },
      risks: 6,
      decisions: 4,
      reminderPolicies: 3,
      reminderRules: 9,
      viewerGroupAccesses: 2,
      reopenRequests: 1,
      actionLogs: 1,
    });

    expect(log).toHaveBeenCalledWith(
      "Seeded: 3 groups, 9 users, 8 products, 7 stages, 11 assignments, " +
        "5 reports, 20 sections, 30 items, 22 project statuses, 14 stage statuses, 6 risks, " +
        "4 decisions, 3 reminder policies, 9 reminder rules, " +
        "2 viewer group accesses, 1 reopen request, 1 action log",
    );
  });
});
