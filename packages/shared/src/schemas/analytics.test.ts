import { describe, expect, it } from "vitest";

import {
  leadVelocityRowSchema,
  periodComparisonInputSchema,
  trafficLightHistoryInputSchema,
  trafficLightHistoryOutputSchema,
} from "./analytics";

// The ISO date rule is unexported; exercise it through every public alias that
// uses it — the two scalar inputs, the periods[] array element, periodLabel.
const parseByAlias = {
  periodFrom: (v: unknown) =>
    trafficLightHistoryInputSchema.safeParse({
      periodFrom: v,
      periodTo: "2026-06-30",
    }),
  periodTo: (v: unknown) =>
    trafficLightHistoryInputSchema.safeParse({
      periodFrom: "2026-06-26",
      periodTo: v,
    }),
  periodA: (v: unknown) =>
    periodComparisonInputSchema.safeParse({
      periodA: v,
      periodB: "2026-06-30",
    }),
  "periods[]": (v: unknown) =>
    trafficLightHistoryOutputSchema.safeParse({ periods: [v], rows: [] }),
  periodLabel: (v: unknown) =>
    leadVelocityRowSchema.safeParse({ periodLabel: v, leads: [] }),
} as const;

const aliases = Object.keys(parseByAlias) as (keyof typeof parseByAlias)[];

const accepted = [
  "2026-06-26",
  "2026-01-31",
  "2026-12-31",
  "2026-02-28",
  "2024-02-29", // leap year
  "2000-02-29", // century divisible by 400
  "0000-01-01",
  "9999-12-31",
];

const rejected = [
  "2026-02-29", // 2026 is not a leap year
  "2023-02-29",
  "1900-02-29", // century not divisible by 400
  "2100-02-29",
  "2026-02-30",
  "2026-04-31",
  "2026-06-31",
  "2026-09-31",
  "2026-11-31",
  "2026-01-32",
  "2026-00-01",
  "2026-01-00",
  "2026-13-01",
  "2026-13-45",
  "2026-1-1", // shape: unpadded
  "20260626", // shape: no separators
  "2026-06-26T00:00:00Z", // shape: datetime, not date
  " 2026-06-26", // shape: leading space
  "2026-06-26 ", // shape: trailing space
  "not-a-date",
];

describe.each(aliases)("ISO date rule via %s", (alias) => {
  const parse = parseByAlias[alias];

  it.each(accepted)("accepts %s", (value) => {
    expect(parse(value).success).toBe(true);
  });

  it.each(rejected)("rejects %s", (value) => {
    expect(parse(value).success).toBe(false);
  });

  it.each([42, null, true, {}])("rejects the non-string %s", (value) => {
    expect(parse(value).success).toBe(false);
  });
});

describe("ISO date rule diagnostic surface", () => {
  it("reports a non-string as invalid_type with the standard message", () => {
    const result = parseByAlias.periodFrom(42);

    expect(result.error?.issues).toEqual([
      {
        expected: "string",
        code: "invalid_type",
        path: ["periodFrom"],
        message: "Invalid input: expected string, received number",
      },
    ]);
  });

  // Diagnostics come from zod's single `date` format check. Before this rule
  // used a regex + refine pair, which emitted two issues for a shape failure
  // and a `custom` "Not a real calendar date" for an impossible day.
  it("reports one invalid_format issue for an impossible calendar day", () => {
    const issues = parseByAlias.periodFrom("2026-02-30").error?.issues ?? [];

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      code: "invalid_format",
      format: "date",
      path: ["periodFrom"],
      message: "Invalid ISO date",
    });
  });

  it("reports one invalid_format issue for a malformed shape", () => {
    const issues = parseByAlias.periodFrom("2026-1-1").error?.issues ?? [];

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      code: "invalid_format",
      format: "date",
      path: ["periodFrom"],
      message: "Invalid ISO date",
    });
  });
});
