import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { LEAD_1_ID } from "../support/seed-constants.js";
import { endOfDayUTC } from "../support/utc-period-dates.js";
import {
  UX_ONE_DAY_REPORT_ID,
  seedUxFixtures,
} from "./seed-advanced.ux-fixtures.js";

function capture() {
  const reportUpsert = vi.fn();
  const sectionUpsert = vi.fn();
  const itemUpdate = vi.fn();
  const prisma = {
    report: { upsert: reportUpsert },
    reportSection: { upsert: sectionUpsert },
    item: { update: itemUpdate },
  } as unknown as PrismaClient;
  return { prisma, reportUpsert, sectionUpsert, itemUpdate };
}

describe("seedUxFixtures", () => {
  it("creates a published one-day period where the primary lead never submitted", async () => {
    const { prisma, reportUpsert, sectionUpsert } = capture();
    await seedUxFixtures(prisma);

    const report = reportUpsert.mock.calls[0]?.[0] as {
      create: {
        id: string;
        periodStart: Date;
        periodEnd: Date;
        status: string;
      };
    };
    expect(report.create.id).toBe(UX_ONE_DAY_REPORT_ID);
    expect(report.create.status).toBe("published");
    expect(report.create.periodEnd).toEqual(
      endOfDayUTC(report.create.periodStart),
    );

    const section = sectionUpsert.mock.calls[0]?.[0] as {
      create: { authorId: string; status: string; submittedAt: Date | null };
    };
    expect(section.create).toMatchObject({
      authorId: LEAD_1_ID,
      status: "draft",
      submittedAt: null,
    });
  });

  it("gives the open draft an item whose stableId exists in the published period", async () => {
    const { prisma, itemUpdate } = capture();
    await seedUxFixtures(prisma);

    const call = itemUpdate.mock.calls[0]?.[0] as {
      where: { id: string };
      data: { stableId: string };
    };
    expect(call.data.stableId).not.toBe(call.where.id);
    expect(call.data.stableId).toMatch(/^a0000000-0000-4000-8000-0000000052/u);
  });
});
