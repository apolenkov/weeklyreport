import { describe, expect, it } from "vitest";

import { reminderPolicySchema } from "@customreport/shared";

/**
 * UFB-036 (Phase 44-05): wire-format contract tests for ReminderPolicy.
 *
 * These tests pin the zod schema on the wire boundary so a malicious
 * admin client cannot drift the audience/kind enums or smuggle an
 * incoherent validity window past the API. The router uses
 * `reminderPolicySchema` as `.input(...)` on `admin.savePolicy`, so
 * everything asserted here also holds for the live tRPC endpoint.
 *
 * Pure zod tests — no Prisma, no DI, no HTTP. They live next to the
 * other reminder contract tests so test discovery picks them up under
 * the same `reminders/` glob.
 */
describe("reminderPolicySchema (Phase 44-05)", () => {
  const baseId = "11111111-1111-4111-8111-111111111111";
  const validFrom = new Date("2026-05-01T00:00:00.000Z");
  const validUntil = new Date("2026-12-31T23:59:59.000Z");

  it("parses a fully-specified valid payload", () => {
    const parsed = reminderPolicySchema.parse({
      id: baseId,
      kind: "deadline",
      offsetMinutes: -1440,
      timezone: "Europe/Moscow",
      audience: "lead-with-draft",
      active: true,
      validFrom: validFrom.toISOString(),
      validUntil: validUntil.toISOString(),
    });

    expect(parsed.id).toBe(baseId);
    expect(parsed.kind).toBe("deadline");
    expect(parsed.offsetMinutes).toBe(-1440);
    expect(parsed.audience).toBe("lead-with-draft");
    expect(parsed.validFrom).toBeInstanceOf(Date);
    expect(parsed.validUntil).toBeInstanceOf(Date);
    expect(parsed.validFrom.getTime()).toBe(validFrom.getTime());
    expect(parsed.validUntil?.getTime()).toBe(validUntil.getTime());
  });

  it('default-fills validFrom to "now" when omitted', () => {
    const before = Date.now();
    const parsed = reminderPolicySchema.parse({
      id: baseId,
      kind: "follow_up",
      offsetMinutes: 60,
      timezone: "Europe/Moscow",
      audience: "lead-with-draft",
      active: true,
      // validFrom omitted on purpose
      validUntil: null,
    });
    const after = Date.now();

    expect(parsed.validFrom).toBeInstanceOf(Date);
    expect(parsed.validFrom.getTime()).toBeGreaterThanOrEqual(before);
    expect(parsed.validFrom.getTime()).toBeLessThanOrEqual(after);
  });

  it("default-fills validUntil to null when omitted", () => {
    const parsed = reminderPolicySchema.parse({
      id: baseId,
      kind: "deadline",
      offsetMinutes: -60,
      timezone: "Europe/Moscow",
      audience: "lead-with-draft",
      active: true,
      validFrom: validFrom.toISOString(),
      // validUntil omitted on purpose
    });

    expect(parsed.validUntil).toBeNull();
  });

  it("accepts validUntil === validFrom (boundary inclusive)", () => {
    const same = new Date("2026-06-01T12:00:00.000Z");
    const parsed = reminderPolicySchema.parse({
      id: baseId,
      kind: "deadline",
      offsetMinutes: -1440,
      timezone: "Europe/Moscow",
      audience: "lead-with-draft",
      active: true,
      validFrom: same.toISOString(),
      validUntil: same.toISOString(),
    });
    expect(parsed.validFrom.getTime()).toBe(same.getTime());
    expect(parsed.validUntil?.getTime()).toBe(same.getTime());
  });

  it("rejects validUntil < validFrom (incoherent window)", () => {
    const result = reminderPolicySchema.safeParse({
      id: baseId,
      kind: "deadline",
      offsetMinutes: -1440,
      timezone: "Europe/Moscow",
      audience: "lead-with-draft",
      active: true,
      validFrom: validUntil.toISOString(), // swapped
      validUntil: validFrom.toISOString(),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.path.includes("validUntil")),
      ).toBe(true);
    }
  });

  it("rejects empty timezone", () => {
    const result = reminderPolicySchema.safeParse({
      id: baseId,
      kind: "deadline",
      offsetMinutes: -1440,
      timezone: "",
      audience: "lead-with-draft",
      active: true,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("timezone"))).toBe(
        true,
      );
    }
  });

  it("rejects unknown audience", () => {
    const result = reminderPolicySchema.safeParse({
      id: baseId,
      kind: "deadline",
      offsetMinutes: -1440,
      timezone: "Europe/Moscow",
      audience: "every-lead",
      active: true,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("audience"))).toBe(
        true,
      );
    }
  });

  it("rejects non-integer offsetMinutes", () => {
    const result = reminderPolicySchema.safeParse({
      id: baseId,
      kind: "deadline",
      offsetMinutes: 30.5,
      timezone: "Europe/Moscow",
      audience: "lead-with-draft",
      active: true,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.path.includes("offsetMinutes")),
      ).toBe(true);
    }
  });

  it("rejects unknown kind", () => {
    const result = reminderPolicySchema.safeParse({
      id: baseId,
      kind: "reminder",
      offsetMinutes: -1440,
      timezone: "Europe/Moscow",
      audience: "lead-with-draft",
      active: true,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("kind"))).toBe(
        true,
      );
    }
  });

  it("rejects malformed UUID id", () => {
    const result = reminderPolicySchema.safeParse({
      id: "not-a-uuid",
      kind: "deadline",
      offsetMinutes: -1440,
      timezone: "Europe/Moscow",
      audience: "lead-with-draft",
      active: true,
    });
    expect(result.success).toBe(false);
  });

  it("accepts head-of-late audience for escalation kind", () => {
    const parsed = reminderPolicySchema.parse({
      id: baseId,
      kind: "escalation",
      offsetMinutes: 120,
      timezone: "Europe/Moscow",
      audience: "head-of-late",
      active: true,
    });
    expect(parsed.kind).toBe("escalation");
    expect(parsed.audience).toBe("head-of-late");
  });
});
