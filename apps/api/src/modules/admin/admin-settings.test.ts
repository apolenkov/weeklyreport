import { describe, expect, it } from "vitest";

import { createNullLogger } from "../../lib/logger.js";
import {
  buildAdminCaller,
  createRepository,
  defaultSettings,
  initialSnapshot,
  leadSession,
} from "./__tests__/focused-admin-harness.js";
import { SnapshotAdminService as ProductionSnapshotAdminService } from "./snapshot-admin.service.js";

class SnapshotAdminService extends ProductionSnapshotAdminService {
  constructor(
    repository: ConstructorParameters<typeof ProductionSnapshotAdminService>[0],
  ) {
    super(repository, createNullLogger());
  }
}

describe("SnapshotAdminService — settings", () => {
  it("propagates the missing-settings error when nothing has been configured", async () => {
    const repository = createRepository(initialSnapshot);
    repository.getSettings = () =>
      Promise.reject(
        new Error(
          "AppSettings singleton row 'singleton' is missing — apply the canonical init migration or restore the row.",
        ),
      );
    const service = new SnapshotAdminService(repository);

    await expect(service.getSettings()).rejects.toThrow(
      /AppSettings singleton row 'singleton' is missing/,
    );
  });

  it("round-trips the extended AppSettings fields", async () => {
    const service = new SnapshotAdminService(createRepository(initialSnapshot));

    const result = await service.updateSettings({
      periodLengthDays: 14,
      workingDays: "mon-sat",
      gracePeriodHours: 48,
      defaultTimezone: "Asia/Yekaterinburg",
      defaultReminderAudience: "head-of-late",
      notificationFromEmail: "reports@example.com",
      allowLateSubmissions: false,
      autoPublishAfterDeadline: true,
      autoArchiveWeeksAfterPublish: 12,
    });

    expect(result.periodLengthDays).toBe(14);
    expect(result.workingDays).toBe("mon-sat");
    expect(result.gracePeriodHours).toBe(48);
    expect(result.defaultTimezone).toBe("Asia/Yekaterinburg");
    expect(result.defaultReminderAudience).toBe("head-of-late");
    expect(result.notificationFromEmail).toBe("reports@example.com");
    expect(result.allowLateSubmissions).toBe(false);
    expect(result.autoPublishAfterDeadline).toBe(true);
    expect(result.autoArchiveWeeksAfterPublish).toBe(12);
    expect(result.defaultDeadlineDays).toBe(5);
  });

  it("toggles autoCreatePeriods", async () => {
    const service = new SnapshotAdminService(createRepository(initialSnapshot));

    const result = await service.updateSettings({
      autoCreatePeriods: true,
    });

    expect(result.autoCreatePeriods).toBe(true);
  });

  it("changes defaultDeadlineDays", async () => {
    const service = new SnapshotAdminService(createRepository(initialSnapshot));

    const result = await service.updateSettings({
      defaultDeadlineDays: 10,
    });

    expect(result.defaultDeadlineDays).toBe(10);
  });

  it("round-trips the period-cycle AppSettings fields", async () => {
    const service = new SnapshotAdminService(createRepository(initialSnapshot));

    const result = await service.updateSettings({
      deadlineTime: "09:30",
      allowReopenAfterPublish: false,
      reopenWindowHours: 24,
    });

    expect(result.deadlineTime).toBe("09:30");
    expect(result.allowReopenAfterPublish).toBe(false);
    expect(result.reopenWindowHours).toBe(24);
    expect(result.defaultDeadlineDays).toBe(5);
    expect(result.periodLengthDays).toBe(7);
    expect(result.allowLateSubmissions).toBe(true);
  });

  it("reads configured period-cycle defaults", async () => {
    const service = new SnapshotAdminService(
      createRepository(initialSnapshot, defaultSettings),
    );
    const result = await service.getSettings();

    expect(result.deadlineTime).toBe("18:00");
    expect(result.allowReopenAfterPublish).toBe(true);
    expect(result.reopenWindowHours).toBe(72);
  });

  it("rejects non-admin access at the live procedure gate", async () => {
    const service = new SnapshotAdminService(createRepository(initialSnapshot));

    await expect(
      buildAdminCaller(service, leadSession).admin.snapshot(),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
