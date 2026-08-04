import { describe, expect, it } from "vitest";

import { appSettingsSchema } from "../packages/shared/src/schemas/period.schema.js";
import { MANUAL_UAT_SETTINGS } from "./wipe-manual-uat.seed-baseline.js";

describe("manual UAT settings fixture", () => {
  it("parses against the shared policy schema", () => {
    expect(() => appSettingsSchema.parse(MANUAL_UAT_SETTINGS)).not.toThrow();
  });

  it("is deterministic across parses (reseed reproduces the same policy)", () => {
    const first = appSettingsSchema.parse(MANUAL_UAT_SETTINGS);
    const second = appSettingsSchema.parse(MANUAL_UAT_SETTINGS);
    expect(second).toEqual(first);
  });

  it("declares every policy knob the schema requires", () => {
    const parsed = appSettingsSchema.parse(MANUAL_UAT_SETTINGS);
    expect(parsed.unifiedActivityView).toBe(false);
    expect(parsed.allowReopenAfterPublish).toBe(true);
    expect(parsed.reopenWindowHours).toBe(72);
    expect(parsed.deadlineTime).toMatch(/^\d{2}:\d{2}$/);
  });
});
