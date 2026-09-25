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
  "productFeedback",
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

  it("clears product feedback before users so the Restrict FK cannot fire", async () => {
    let feedbackRows = 1;
    let userRows = 1;
    const prisma = Object.fromEntries(
      TABLES.map((table) => [
        table,
        {
          deleteMany: vi.fn(() => {
            if (table === "productFeedback") {
              feedbackRows = 0;
            }
            if (table === "user") {
              if (feedbackRows > 0) {
                throw new Error(
                  "Restrict violation: ProductFeedback.authorUserId still referenced",
                );
              }
              userRows = 0;
            }
          }),
        },
      ]),
    ) as unknown as PrismaClient;

    await wipeSeedData(prisma);

    expect(feedbackRows).toBe(0);
    expect(userRows).toBe(0);
    expect(prisma.productFeedback.deleteMany).toHaveBeenCalledWith({});
    expect(prisma.user.deleteMany).toHaveBeenCalledWith({});
  });
});
