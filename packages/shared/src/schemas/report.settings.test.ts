import { describe, expect, it } from "vitest";
import { z } from "zod";

import { appSettingsSchema, appSettingsUpdateSchema } from "./report";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// draftSaveSchema boundaries
// ---------------------------------------------------------------------------

describe("appSettingsSchema", () => {
  it("accepts valid settings", () => {
    const result = appSettingsSchema.safeParse({
      autoCreatePeriods: false,
      defaultDeadlineDays: 5,
    });
    expect(result.success).toBe(true);
  });

  it("rejects defaultDeadlineDays below 1", () => {
    const result = appSettingsSchema.safeParse({
      autoCreatePeriods: true,
      defaultDeadlineDays: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects defaultDeadlineDays above 30", () => {
    const result = appSettingsSchema.safeParse({
      autoCreatePeriods: true,
      defaultDeadlineDays: 31,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-boolean autoCreatePeriods", () => {
    const result = appSettingsSchema.safeParse({
      autoCreatePeriods: "yes",
      defaultDeadlineDays: 5,
    });
    expect(result.success).toBe(false);
  });

  it("accepts max boundary values", () => {
    const result = appSettingsSchema.safeParse({
      autoCreatePeriods: true,
      defaultDeadlineDays: 30,
    });
    expect(result.success).toBe(true);
  });

  it("applies defaults for the 9 new fields when omitted", () => {
    const result = appSettingsSchema.safeParse({
      autoCreatePeriods: false,
      defaultDeadlineDays: 5,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.periodLengthDays).toBe(7);
    expect(result.data.workingDays).toBe("mon-fri");
    expect(result.data.gracePeriodHours).toBe(24);
    expect(result.data.defaultTimezone).toBe("Europe/Moscow");
    expect(result.data.defaultReminderAudience).toBe("lead-with-draft");
    expect(result.data.notificationFromEmail).toBeNull();
    expect(result.data.allowLateSubmissions).toBe(true);
    expect(result.data.autoPublishAfterDeadline).toBe(false);
    expect(result.data.autoArchiveWeeksAfterPublish).toBe(0);
  });

  it("rejects periodLengthDays out of [1..31]", () => {
    expect(
      appSettingsSchema.safeParse({
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        periodLengthDays: 0,
      }).success,
    ).toBe(false);
    expect(
      appSettingsSchema.safeParse({
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        periodLengthDays: 32,
      }).success,
    ).toBe(false);
  });

  it("rejects unknown workingDays enum value", () => {
    expect(
      appSettingsSchema.safeParse({
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        workingDays: "mon-thu",
      }).success,
    ).toBe(false);
  });

  it("rejects gracePeriodHours out of [0..168]", () => {
    expect(
      appSettingsSchema.safeParse({
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        gracePeriodHours: -1,
      }).success,
    ).toBe(false);
    expect(
      appSettingsSchema.safeParse({
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        gracePeriodHours: 169,
      }).success,
    ).toBe(false);
  });

  it("rejects autoArchiveWeeksAfterPublish > 52", () => {
    expect(
      appSettingsSchema.safeParse({
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        autoArchiveWeeksAfterPublish: 53,
      }).success,
    ).toBe(false);
  });

  it("accepts notificationFromEmail null and a valid address", () => {
    expect(
      appSettingsSchema.safeParse({
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        notificationFromEmail: null,
      }).success,
    ).toBe(true);
    expect(
      appSettingsSchema.safeParse({
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        notificationFromEmail: "reports@example.com",
      }).success,
    ).toBe(true);
  });

  it("rejects malformed notificationFromEmail", () => {
    expect(
      appSettingsSchema.safeParse({
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        notificationFromEmail: "not-an-email",
      }).success,
    ).toBe(false);
  });

  it("rejects unknown defaultReminderAudience", () => {
    expect(
      appSettingsSchema.safeParse({
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        defaultReminderAudience: "everyone",
      }).success,
    ).toBe(false);
  });

  it("applies defaults for the period-cycle fields when omitted", () => {
    const result = appSettingsSchema.safeParse({
      autoCreatePeriods: false,
      defaultDeadlineDays: 5,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.deadlineTime).toBe("18:00");
    expect(result.data.allowReopenAfterPublish).toBe(true);
    expect(result.data.reopenWindowHours).toBe(72);
  });

  it("rejects malformed deadlineTime (must be HH:MM 24h)", () => {
    // Hour out of range
    expect(
      appSettingsSchema.safeParse({
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        deadlineTime: "25:00",
      }).success,
    ).toBe(false);
    // Missing leading zero
    expect(
      appSettingsSchema.safeParse({
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        deadlineTime: "9:30",
      }).success,
    ).toBe(false);
    // Garbage
    expect(
      appSettingsSchema.safeParse({
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        deadlineTime: "noon",
      }).success,
    ).toBe(false);
    // Valid corner cases pass
    expect(
      appSettingsSchema.safeParse({
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        deadlineTime: "00:00",
      }).success,
    ).toBe(true);
    expect(
      appSettingsSchema.safeParse({
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        deadlineTime: "23:59",
      }).success,
    ).toBe(true);
  });

  it("rejects reopenWindowHours out of [0..168]", () => {
    expect(
      appSettingsSchema.safeParse({
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        reopenWindowHours: -1,
      }).success,
    ).toBe(false);
    expect(
      appSettingsSchema.safeParse({
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

  // Every field carrying a Zod `.default()` must be ABSENT from a partial parse
  // that omits it — otherwise the write path (persists any non-undefined key)
  // silently resets an unspecified setting. Hardcoded (not derived from
  // `.shape`) so this guard shares no logic with the schema's strip helper and
  // stays a real oracle rather than a tautology.
  const DEFAULTED_FIELDS = [
    "periodLengthDays",
    "workingDays",
    "gracePeriodHours",
    "allowLateSubmissions",
    "autoPublishAfterDeadline",
    "autoArchiveWeeksAfterPublish",
    "defaultTimezone",
    "defaultReminderAudience",
    "notificationFromEmail",
    "deadlineTime",
    "allowReopenAfterPublish",
    "reopenWindowHours",
    "unifiedActivityView",
  ] as const;

  it("omits every defaulted field from a partial parse that does not mention it", () => {
    const parsed = appSettingsUpdateSchema.parse({ defaultDeadlineDays: 7 });
    for (const field of DEFAULTED_FIELDS) {
      expect(field in parsed).toBe(false);
    }
  });

  it("tripwire: the hardcoded defaulted-field list matches the schema", () => {
    const actual = Object.entries(appSettingsSchema.shape)
      .filter(([, field]) => field instanceof z.ZodDefault)
      .map(([key]) => key)
      .sort();
    expect(actual).toEqual([...DEFAULTED_FIELDS].sort());
  });

  it("keeps explicit values for defaulted fields and still enforces constraints", () => {
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

// ---------------------------------------------------------------------------
// weeklyReportReadModelSchema
// ---------------------------------------------------------------------------
