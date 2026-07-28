import { describe, expect, it } from "vitest";

import { appSettingsSchema, appSettingsUpdateSchema } from "./report";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

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
    const result = appSettingsSchema.safeParse({
      ...validSettings(),
      autoCreatePeriods: false,
      defaultDeadlineDays: 5,
    });
    expect(result.success).toBe(true);
  });

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
      defaultDeadlineDays: 5,
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
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        periodLengthDays: 0,
      }).success,
    ).toBe(false);
    expect(
      appSettingsSchema.safeParse({
        ...validSettings(),
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        periodLengthDays: 32,
      }).success,
    ).toBe(false);
  });

  it("rejects unknown workingDays enum value", () => {
    expect(
      appSettingsSchema.safeParse({
        ...validSettings(),
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        workingDays: "mon-thu",
      }).success,
    ).toBe(false);
  });

  it("rejects gracePeriodHours out of [0..168]", () => {
    expect(
      appSettingsSchema.safeParse({
        ...validSettings(),
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        gracePeriodHours: -1,
      }).success,
    ).toBe(false);
    expect(
      appSettingsSchema.safeParse({
        ...validSettings(),
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        gracePeriodHours: 169,
      }).success,
    ).toBe(false);
  });

  it("rejects autoArchiveWeeksAfterPublish > 52", () => {
    expect(
      appSettingsSchema.safeParse({
        ...validSettings(),
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        autoArchiveWeeksAfterPublish: 53,
      }).success,
    ).toBe(false);
  });

  it("accepts notificationFromEmail null and a valid address", () => {
    expect(
      appSettingsSchema.safeParse({
        ...validSettings(),
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        notificationFromEmail: null,
      }).success,
    ).toBe(true);
    expect(
      appSettingsSchema.safeParse({
        ...validSettings(),
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        notificationFromEmail: "reports@example.com",
      }).success,
    ).toBe(true);
  });

  it("rejects malformed notificationFromEmail", () => {
    expect(
      appSettingsSchema.safeParse({
        ...validSettings(),
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        notificationFromEmail: "not-an-email",
      }).success,
    ).toBe(false);
  });

  it("rejects unknown defaultReminderAudience", () => {
    expect(
      appSettingsSchema.safeParse({
        ...validSettings(),
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        defaultReminderAudience: "everyone",
      }).success,
    ).toBe(false);
  });

  it("rejects malformed deadlineTime (must be HH:MM 24h)", () => {
    // Hour out of range
    expect(
      appSettingsSchema.safeParse({
        ...validSettings(),
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        deadlineTime: "25:00",
      }).success,
    ).toBe(false);
    // Missing leading zero
    expect(
      appSettingsSchema.safeParse({
        ...validSettings(),
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        deadlineTime: "9:30",
      }).success,
    ).toBe(false);
    // Garbage
    expect(
      appSettingsSchema.safeParse({
        ...validSettings(),
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        deadlineTime: "noon",
      }).success,
    ).toBe(false);
    // Valid corner cases pass
    expect(
      appSettingsSchema.safeParse({
        ...validSettings(),
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        deadlineTime: "00:00",
      }).success,
    ).toBe(true);
    expect(
      appSettingsSchema.safeParse({
        ...validSettings(),
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        deadlineTime: "23:59",
      }).success,
    ).toBe(true);
  });

  it("rejects reopenWindowHours out of [0..168]", () => {
    expect(
      appSettingsSchema.safeParse({
        ...validSettings(),
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        reopenWindowHours: -1,
      }).success,
    ).toBe(false);
    expect(
      appSettingsSchema.safeParse({
        ...validSettings(),
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        reopenWindowHours: 169,
      }).success,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// appSettingsUpdateSchema (partial)
// ---------------------------------------------------------------------------

describe("appSettingsUpdateSchema", () => {
  it("accepts partial update with one field", () => {
    const result = appSettingsUpdateSchema.safeParse({
      defaultDeadlineDays: 7,
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty object (no fields)", () => {
    const result = appSettingsUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("still validates field constraints on partial", () => {
    const result = appSettingsUpdateSchema.safeParse({
      defaultDeadlineDays: 0,
    });
    expect(result.success).toBe(false);
  });

  it("omits unifiedActivityView from the parsed output when the key is absent", () => {
    // Guards the Zod-4 `.partial()`-keeps-defaults hazard: an update that does
    // not mention the flag must not materialize `false`, or the write path
    // (persists any non-undefined key) would reset a department that enabled it.
    const parsed = appSettingsUpdateSchema.parse({ defaultDeadlineDays: 7 });
    expect("unifiedActivityView" in parsed).toBe(false);
    expect(parsed.unifiedActivityView).toBeUndefined();
  });

  it("keeps an explicit unifiedActivityView value", () => {
    expect(
      appSettingsUpdateSchema.parse({ unifiedActivityView: false })
        .unifiedActivityView,
    ).toBe(false);
    expect(
      appSettingsUpdateSchema.parse({ unifiedActivityView: true })
        .unifiedActivityView,
    ).toBe(true);
  });

  it("keeps explicit values and still enforces constraints", () => {
    expect(
      appSettingsUpdateSchema.parse({ periodLengthDays: 14 }).periodLengthDays,
    ).toBe(14);
    expect(
      appSettingsUpdateSchema.parse({ notificationFromEmail: null })
        .notificationFromEmail,
    ).toBeNull();
    expect(
      appSettingsUpdateSchema.safeParse({ periodLengthDays: 0 }).success,
    ).toBe(false);
    expect(
      appSettingsUpdateSchema.safeParse({ deadlineTime: "25:00" }).success,
    ).toBe(false);
  });
});
