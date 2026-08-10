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

  it("omits unifiedActivityView when the key is absent", () => {
    const parsed = appSettingsUpdateSchema.parse({ defaultDeadlineDays: 7 });
    expect("unifiedActivityView" in parsed).toBe(false);
    expect(parsed.unifiedActivityView).toBeUndefined();
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
