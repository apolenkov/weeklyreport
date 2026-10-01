import { describe, expect, it } from "vitest";

import { reminderPolicySchema } from "./reminder-policy.schema.js";

const validPolicy = {
  id: "fe24a020-2071-4b24-a26b-dd01292c9123",
  kind: "deadline",
  offsetMinutes: -1440,
  timezone: "Europe/Moscow",
  audience: "lead-with-draft",
  active: true,
  validFrom: new Date("2026-07-01T00:00:00.000Z"),
  validUntil: new Date("2026-07-31T00:00:00.000Z"),
} as const;

describe("reminderPolicySchema time zones", () => {
  it.each(["Europe/Moscow", "UTC", "Etc/UTC", "Etc/GMT+3"])(
    "accepts the resolvable time zone %s",
    (timezone) => {
      const result = reminderPolicySchema.safeParse({
        ...validPolicy,
        timezone,
      });

      expect(result.success).toBe(true);
    },
  );

  it.each(["Not/AZone", "UTC+3", "MSK", "+03:00", "+0300", "+03", "-05:30"])(
    "rejects invalid time zone %s at the timezone path",
    (timezone) => {
      const result = reminderPolicySchema.safeParse({
        ...validPolicy,
        timezone,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toContainEqual(
          expect.objectContaining({
            message: "timezone must be a valid IANA time zone identifier",
            path: ["timezone"],
          }),
        );
      }
    },
  );
});

describe("reminderPolicySchema validity window", () => {
  it("preserves validUntil validation for a valid time zone", () => {
    const result = reminderPolicySchema.safeParse({
      ...validPolicy,
      validFrom: new Date("2026-07-31T00:00:00.000Z"),
      validUntil: new Date("2026-07-01T00:00:00.000Z"),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          message: "validUntil must be on or after validFrom",
          path: ["validUntil"],
        }),
      );
    }
  });

  it("accepts a policy that remains valid forever", () => {
    const result = reminderPolicySchema.safeParse({
      ...validPolicy,
      validUntil: null,
    });

    expect(result.success).toBe(true);
  });

  it("accepts equal validity-window boundaries", () => {
    const boundary = new Date("2026-07-01T00:00:00.000Z");
    const result = reminderPolicySchema.safeParse({
      ...validPolicy,
      validFrom: boundary,
      validUntil: boundary,
    });

    expect(result.success).toBe(true);
  });

  it("rejects an omitted validFrom at its own path", () => {
    const { validFrom: _validFrom, ...withoutValidFrom } = validPolicy;
    const result = reminderPolicySchema.safeParse(withoutValidFrom);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({ path: ["validFrom"] }),
      );
    }
  });
});

describe("reminderPolicySchema kind and audience", () => {
  it.each([
    ["deadline", "lead-with-draft"],
    ["escalation", "head-of-late"],
  ] as const)("accepts the %s to %s contract", (kind, audience) => {
    expect(
      reminderPolicySchema.safeParse({ ...validPolicy, kind, audience })
        .success,
    ).toBe(true);
  });

  it.each([
    ["deadline", "head-of-late", "lead-with-draft"],
    ["escalation", "lead-with-draft", "head-of-late"],
  ] as const)(
    "rejects %s with %s instead of %s",
    (kind, audience, expectedAudience) => {
      const result = reminderPolicySchema.safeParse({
        ...validPolicy,
        kind,
        audience,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toContainEqual(
          expect.objectContaining({
            path: ["audience"],
            message: `${kind} policies require the ${expectedAudience} audience`,
          }),
        );
      }
    },
  );
});
