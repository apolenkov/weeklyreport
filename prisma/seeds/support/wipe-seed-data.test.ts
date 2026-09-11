import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { wipeSeedData } from "./wipe-seed-data.js";

const TABLES = [
  "recordComment",
  "item",
  "risk",
  "decision",
  "activityStatus",
  "projectActivityLead",
  "projectActivityProduct",
  "projectActivity",
  "stageStatus",
  "projectStatus",
  "sectionReview",
  "reopenRequest",
  "reportSection",
  "reminderExecution",
  "reminderRule",
  "reminderPolicy",
  "pdfExportJob",
  "carryOverRecord",
  "carryOverExecution",
  "publishedSectionScope",
  "publishedSearchDocument",
  "reviewAcknowledgement",
  "report",
  "stageAssignment",
  "viewerGroupAccess",
  "groupProduct",
  "project",
  "stage",
  "userActionLog",
  "agentationThreadMessage",
  "agentationEvent",
  "agentationAnnotation",
  "agentationSession",
  "user",
  "reportingGroup",
  "appSettings",
  "organization",
] as const;

describe("wipeSeedData", () => {
  it("owns the complete graph and deletes it child-first", async () => {
    const calls: string[] = [];
    const prisma = Object.fromEntries(
      TABLES.map((table) => [
        table,
        {
          deleteMany: vi.fn(() => {
            calls.push(table);
          }),
        },
      ]),
    ) as unknown as PrismaClient;

    await wipeSeedData(prisma);

    expect(calls).toEqual(TABLES);
    expect(calls).toContain("viewerGroupAccess");
    expect(calls).toContain("activityStatus");
    for (const table of TABLES) {
      expect(prisma[table].deleteMany).toHaveBeenCalledWith({});
    }
  });
});
