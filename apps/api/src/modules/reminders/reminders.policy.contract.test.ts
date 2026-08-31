import { reminderPolicySchema } from "@customreport/shared";
import { describe, expect, it } from "vitest";

// Pins reminderPolicySchema so a client cannot drift audience/kind or
// smuggle an incoherent validity window past admin.savePolicy.
describe("reminderPolicySchema", () => {
  const baseId = "11111111-1111-4111-8111-111111111111";
  const validFrom = new Date("2026-05-01T00:00:00.000Z");
  const validUntil = new Date("2026-12-31T23:59:59.000Z");

  function payload(overrides: Record<string, unknown> = {}) {
    return {
      id: baseId,
      kind: "deadline",
      offsetMinutes: -1440,
      timezone: "Europe/Moscow",
      audience: "lead-with-draft",
      active: true,
      ...overrides,
    };
  }

  it("parses a fully-specified valid payload", () => {
    const parsed = reminderPolicySchema.parse(
      payload({
        validFrom: validFrom.toISOString(),
        validUntil: validUntil.toISOString(),
      }),
    );

    expect(parsed.id).toBe(baseId);
    expect(parsed.kind).toBe("deadline");
    expect(parsed.offsetMinutes).toBe(-1440);
    expect(parsed.audience).toBe("lead-with-draft");
    expect(parsed.validFrom).toBeInstanceOf(Date);
    expect(parsed.validUntil).toBeInstanceOf(Date);
    expect(parsed.validFrom.getTime()).toBe(validFrom.getTime());
    expect(parsed.validUntil?.getTime()).toBe(validUntil.getTime());
  });

  it("default-fills validUntil to null when omitted", () => {
    const parsed = reminderPolicySchema.parse(
      payload({ validFrom: validFrom.toISOString() }),
    );

    expect(parsed.validUntil).toBeNull();
  });

  it("accepts validUntil === validFrom (boundary inclusive)", () => {
    const same = new Date("2026-06-01T12:00:00.000Z");
    const parsed = reminderPolicySchema.parse(
      payload({
        validFrom: same.toISOString(),
        validUntil: same.toISOString(),
      }),
    );
    expect(parsed.validFrom.getTime()).toBe(same.getTime());
    expect(parsed.validUntil?.getTime()).toBe(same.getTime());
  });

  it("accepts head-of-late audience for escalation kind", () => {
    const parsed = reminderPolicySchema.parse(
      payload({
        kind: "escalation",
        offsetMinutes: 120,
        audience: "head-of-late",
        validFrom,
      }),
    );
    expect(parsed.kind).toBe("escalation");
    expect(parsed.audience).toBe("head-of-late");
  });

  describe("rejects an incoherent or invalid field", () => {
    const rejectedCases: {
      readonly label: string;
      readonly overrides: Record<string, unknown>;
      readonly path: readonly string[];
    }[] = [
      {
        label: "omitted validFrom",
        overrides: { kind: "deadline", offsetMinutes: 60, validUntil: null },
        path: ["validFrom"],
      },
      {
        label: "validUntil < validFrom (swapped)",
        overrides: {
          validFrom: validUntil.toISOString(),
          validUntil: validFrom.toISOString(),
        },
        path: ["validUntil"],
      },
      {
        label: "empty timezone",
        overrides: { timezone: "" },
        path: ["timezone"],
      },
      {
        label: "unknown audience",
        overrides: { audience: "every-lead" },
        path: ["audience"],
      },
      {
        label: "non-integer offsetMinutes",
        overrides: { offsetMinutes: 30.5 },
        path: ["offsetMinutes"],
      },
      {
        label: "unknown kind",
        overrides: { kind: "reminder" },
        path: ["kind"],
      },
    ];

    it.each(rejectedCases)("$label", ({ overrides, path }) => {
      const result = reminderPolicySchema.safeParse(payload(overrides));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((i) =>
            path.includes(String(i.path[0] ?? "")),
          ),
        ).toBe(true);
      }
    });

    it("rejects malformed UUID id (not merely a missing required field)", () => {
      const result = reminderPolicySchema.safeParse(
        payload({ id: "not-a-uuid" }),
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        // The rejection must be a format issue ON the id — a missing-field
        // failure would pass this assertion without exercising the UUID check.
        expect(
          result.error.issues.some((i) => String(i.path[0] ?? "") === "id"),
        ).toBe(true);
      }
    });
  });
});
