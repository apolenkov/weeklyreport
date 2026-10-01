import { describe, expect, it } from "vitest";

import { appSettingsSchema } from "../report.js";

const validSettings = () => ({
  autoCreatePeriods: false,
  defaultDeadlineDays: 5,
  periodLengthDays: 7,
  workingDays: "mon-fri" as const,
  gracePeriodHours: 24,
  allowLateSubmissions: true,
  autoPublishAfterDeadline: false,
  autoArchiveWeeksAfterPublish: 0,
  defaultTimezone: "Europe/Moscow",
  defaultReminderAudience: "lead-with-draft" as const,
  notificationFromEmail: null,
  deadlineTime: "18:00",
  allowReopenAfterPublish: true,
  reopenWindowHours: 72,
  unifiedActivityView: false,
});

describe("appSettingsSchema", () => {
  it("accepts valid settings", () => {
    const result = appSettingsSchema.safeParse(validSettings());
    expect(result.success).toBe(true);
  });

  it.each(["Europe/Moscow", "UTC", "Etc/UTC", "Asia/Tokyo"])(
    "accepts the resolvable default time zone %s",
    (defaultTimezone) => {
      expect(
        appSettingsSchema.safeParse({
          ...validSettings(),
          defaultTimezone,
        }).success,
      ).toBe(true);
    },
  );

  it.each(["Not/A_Timezone", "UTC+3", "MSK"])(
    "rejects invalid default time zone %s at the settings boundary",
    (defaultTimezone) => {
      const result = appSettingsSchema.safeParse({
        ...validSettings(),
        defaultTimezone,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toContainEqual(
          expect.objectContaining({
            message: "timezone must be a valid IANA time zone identifier",
            path: ["defaultTimezone"],
          }),
        );
      }
    },
  );

  it("rejects defaultDeadlineDays below 1", () => {
    const result = appSettingsSchema.safeParse({
      ...validSettings(),
      autoCreatePeriods: true,
      defaultDeadlineDays: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects defaultDeadlineDays above 30", () => {
    const result = appSettingsSchema.safeParse({
      ...validSettings(),
      autoCreatePeriods: true,
      defaultDeadlineDays: 31,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-boolean autoCreatePeriods", () => {
    const result = appSettingsSchema.safeParse({
      ...validSettings(),
      autoCreatePeriods: "yes",
    });
    expect(result.success).toBe(false);
  });

  it("accepts max boundary values", () => {
    const result = appSettingsSchema.safeParse({
      ...validSettings(),
      autoCreatePeriods: true,
      defaultDeadlineDays: 30,
    });
    expect(result.success).toBe(true);
  });

  it("rejects every omitted persisted setting instead of inventing a default", () => {
    for (const key of Object.keys(validSettings())) {
      const missing = Object.fromEntries(
        Object.entries(validSettings()).filter(([name]) => name !== key),
      );
      expect(appSettingsSchema.safeParse(missing).success, key).toBe(false);
    }
  });

  it("rejects periodLengthDays out of [1..31]", () => {
    expect(
      appSettingsSchema.safeParse({
        ...validSettings(),
        periodLengthDays: 0,
      }).success,
    ).toBe(false);
    expect(
      appSettingsSchema.safeParse({
        ...validSettings(),
        periodLengthDays: 32,
      }).success,
    ).toBe(false);
  });

  it("rejects unknown workingDays enum value", () => {
    expect(
      appSettingsSchema.safeParse({
        ...validSettings(),
        workingDays: "mon-thu",
      }).success,
    ).toBe(false);
  });

  it("rejects gracePeriodHours out of [0..168]", () => {
    expect(
      appSettingsSchema.safeParse({
        ...validSettings(),
        gracePeriodHours: -1,
      }).success,
    ).toBe(false);
    expect(
      appSettingsSchema.safeParse({
        ...validSettings(),
        gracePeriodHours: 169,
      }).success,
    ).toBe(false);
  });

  it("rejects autoArchiveWeeksAfterPublish > 52", () => {
    expect(
      appSettingsSchema.safeParse({
        ...validSettings(),
        autoArchiveWeeksAfterPublish: 53,
      }).success,
    ).toBe(false);
  });

  it("accepts notificationFromEmail null and a valid address", () => {
    expect(
      appSettingsSchema.safeParse({
        ...validSettings(),
        notificationFromEmail: null,
      }).success,
    ).toBe(true);
    expect(
      appSettingsSchema.safeParse({
        ...validSettings(),
        notificationFromEmail: "reports@example.com",
      }).success,
    ).toBe(true);
  });

  it("rejects malformed notificationFromEmail", () => {
    expect(
      appSettingsSchema.safeParse({
        ...validSettings(),
        notificationFromEmail: "not-an-email",
      }).success,
    ).toBe(false);
  });

  it("rejects unknown defaultReminderAudience", () => {
    expect(
      appSettingsSchema.safeParse({
        ...validSettings(),
        defaultReminderAudience: "everyone",
      }).success,
    ).toBe(false);
  });

  it("rejects malformed deadlineTime (must be HH:MM 24h)", () => {
    expect(
      appSettingsSchema.safeParse({
        ...validSettings(),
        deadlineTime: "25:00",
      }).success,
    ).toBe(false);
    expect(
      appSettingsSchema.safeParse({
        ...validSettings(),
        deadlineTime: "9:30",
      }).success,
    ).toBe(false);
    expect(
      appSettingsSchema.safeParse({
        ...validSettings(),
        deadlineTime: "noon",
      }).success,
    ).toBe(false);
    expect(
      appSettingsSchema.safeParse({
        ...validSettings(),
        deadlineTime: "00:00",
      }).success,
    ).toBe(true);
    expect(
      appSettingsSchema.safeParse({
        ...validSettings(),
        deadlineTime: "23:59",
      }).success,
    ).toBe(true);
  });

  it("rejects reopenWindowHours out of [0..168]", () => {
    expect(
      appSettingsSchema.safeParse({
        ...validSettings(),
        reopenWindowHours: -1,
      }).success,
    ).toBe(false);
    expect(
      appSettingsSchema.safeParse({
        ...validSettings(),
        reopenWindowHours: 169,
      }).success,
    ).toBe(false);
  });
});
