import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { getSettings, updateSettings } from "./admin-settings.queries";

// Regression: a settings READ must fail loud on a missing singleton row, never
// upsert-created configured defaults on the fly (no-fallback policy).
describe("admin-settings.queries.getSettings", () => {
  it("throws when the AppSettings singleton row is missing", async () => {
    const prisma = {
      appSettings: {
        findUnique: () => Promise.resolve(null),
      },
    } as unknown as PrismaService;

    await expect(getSettings(prisma)).rejects.toThrow(
      /AppSettings singleton row 'singleton' is missing/,
    );
  });

  it("returns parsed settings when the row exists", async () => {
    const prisma = {
      appSettings: {
        findUnique: () =>
          Promise.resolve({
            id: "singleton",
            autoCreatePeriods: true,
            defaultDeadlineDays: 5,
            periodLengthDays: 7,
            workingDays: "MON_FRI",
            gracePeriodHours: 24,
            defaultTimezone: "Europe/Moscow",
            defaultReminderAudience: "LEAD_WITH_DRAFT",
            notificationFromEmail: null,
            allowLateSubmissions: true,
            autoPublishAfterDeadline: false,
            autoArchiveWeeksAfterPublish: 0,
            deadlineTime: "18:00",
            allowReopenAfterPublish: true,
            reopenWindowHours: 72,
            unifiedActivityView: false,
          }),
      },
    } as unknown as PrismaService;

    const settings = await getSettings(prisma);
    expect(settings.autoCreatePeriods).toBe(true);
    expect(settings.workingDays).toBe("mon-fri");
    expect(settings.deadlineTime).toBe("18:00");
  });
});

describe("admin-settings.queries.updateSettings", () => {
  it("uses a fixed-id update and never creates a missing singleton", async () => {
    const missing = new Error("Record to update not found");
    const update = vi.fn().mockRejectedValue(missing);
    const upsert = vi.fn();
    const prisma = {
      appSettings: { update, upsert },
    } as unknown as PrismaService;

    await expect(
      updateSettings(prisma, { defaultDeadlineDays: 7 }),
    ).rejects.toBe(missing);
    expect(update).toHaveBeenCalledWith({
      where: { id: "singleton" },
      data: { defaultDeadlineDays: 7 },
    });
    expect(upsert).not.toHaveBeenCalled();
  });
});
