import { describe, expect, it } from "vitest";

import { appSettingsUpdateSchema } from "../report";

describe("appSettingsUpdateSchema", () => {
  it("accepts partial and empty updates", () => {
    expect(
      appSettingsUpdateSchema.safeParse({ defaultDeadlineDays: 7 }).success,
    ).toBe(true);
    expect(appSettingsUpdateSchema.safeParse({}).success).toBe(true);
  });

  it("validates constraints on partial updates", () => {
    expect(
      appSettingsUpdateSchema.safeParse({ defaultDeadlineDays: 0 }).success,
    ).toBe(false);
    expect(
      appSettingsUpdateSchema.safeParse({ periodLengthDays: 0 }).success,
    ).toBe(false);
    expect(
      appSettingsUpdateSchema.safeParse({ deadlineTime: "25:00" }).success,
    ).toBe(false);
  });

  it.each(["Europe/Moscow", "UTC", "Etc/UTC", "Asia/Tokyo", "Etc/GMT+3"])(
    "accepts the resolvable default time zone %s in a partial update",
    (defaultTimezone) => {
      expect(
        appSettingsUpdateSchema.parse({ defaultTimezone }).defaultTimezone,
      ).toBe(defaultTimezone);
    },
  );

  it.each([
    "Not/A_Timezone",
    "UTC+3",
    "MSK",
    "+03:00",
    "+0300",
    "+03",
    "-05:30",
  ])(
    "rejects invalid default time zone %s in a partial update",
    (defaultTimezone) => {
      const result = appSettingsUpdateSchema.safeParse({ defaultTimezone });

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

  it("omits optional settings when their keys are absent", () => {
    const parsed = appSettingsUpdateSchema.parse({ defaultDeadlineDays: 7 });
    expect("unifiedActivityView" in parsed).toBe(false);
    expect(parsed.unifiedActivityView).toBeUndefined();
    expect("defaultTimezone" in parsed).toBe(false);
    expect(parsed.defaultTimezone).toBeUndefined();
  });

  it("keeps explicit values", () => {
    expect(
      appSettingsUpdateSchema.parse({ unifiedActivityView: false })
        .unifiedActivityView,
    ).toBe(false);
    expect(
      appSettingsUpdateSchema.parse({ unifiedActivityView: true })
        .unifiedActivityView,
    ).toBe(true);
    expect(
      appSettingsUpdateSchema.parse({ periodLengthDays: 14 }).periodLengthDays,
    ).toBe(14);
    expect(
      appSettingsUpdateSchema.parse({ notificationFromEmail: null })
        .notificationFromEmail,
    ).toBeNull();
  });
});
