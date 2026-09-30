import { describe, expect, it } from "vitest";

import {
  leadVelocityRowSchema,
  periodComparisonInputSchema,
  periodComparisonOutputSchema,
  trafficLightHistoryInputSchema,
  trafficLightHistoryOutputSchema,
} from "./analytics";

// The ISO date rule is unexported; exercise it through every public alias that
// uses it, including both dates in response periods.
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
    trafficLightHistoryOutputSchema.safeParse({
      periods: [{ periodStart: v, periodEnd: v }],
      rows: [],
    }),
  periodStart: (v: unknown) =>
    leadVelocityRowSchema.safeParse({
      periodStart: v,
      periodEnd: v,
      leads: [],
    }),
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

  // The public aliases expose one consistent date-format diagnostic for an
  // impossible calendar day.
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

describe("trafficLightHistoryOutputSchema", () => {
  const row = {
    projectId: "6af1931e-bb02-4a16-b4f5-bd03208bf729",
    projectName: "Payments",
  };

  it("accepts a rectangular period-by-project matrix", () => {
    expect(
      trafficLightHistoryOutputSchema.safeParse({
        periods: [
          { periodStart: "2026-06-13", periodEnd: "2026-06-19" },
          { periodStart: "2026-06-20", periodEnd: "2026-06-26" },
        ],
        rows: [{ ...row, statuses: ["green", null] }],
      }).success,
    ).toBe(true);
  });

  it.each([
    { label: "missing", statuses: ["green"] },
    { label: "excess", statuses: ["green", null, "red"] },
  ])("rejects a row with $label status cells", ({ statuses }) => {
    const result = trafficLightHistoryOutputSchema.safeParse({
      periods: [
        { periodStart: "2026-06-13", periodEnd: "2026-06-19" },
        { periodStart: "2026-06-20", periodEnd: "2026-06-26" },
      ],
      rows: [{ ...row, statuses }],
    });

    expect(result.error?.issues).toEqual([
      expect.objectContaining({
        path: ["rows", 0, "statuses"],
        message: "Status count must match period count.",
      }),
    ]);
  });
});

describe("frozen analytics period contracts", () => {
  it("rejects old nonempty history and submission response shapes", () => {
    expect(
      trafficLightHistoryOutputSchema.safeParse({
        periods: ["2026-06-19"],
        rows: [],
      }).success,
    ).toBe(false);
    expect(
      leadVelocityRowSchema.safeParse({ periodLabel: "2026-06-19", leads: [] })
        .success,
    ).toBe(false);
  });
  it("requires comparison metadata even when no projects exist", () => {
    expect(periodComparisonOutputSchema.safeParse({ rows: [] }).success).toBe(
      false,
    );
    expect(
      periodComparisonOutputSchema.safeParse({
        periodA: null,
        periodB: null,
        rows: [],
      }).success,
    ).toBe(true);
  });
  it.each([
    { periodStart: "2026-06-17", periodEnd: "2026-06-17" },
    { periodStart: "2026-06-17", periodEnd: "2026-06-23" },
    { periodStart: "2026-06-17", periodEnd: "2026-07-16" },
    { periodStart: "2026-06-17", periodEnd: "2026-07-17" },
    { periodStart: "2026-12-20", periodEnd: "2027-01-19" },
    { periodStart: "2026-06-17", periodEnd: "2027-06-17" },
  ])(
    "accepts a manual frozen range $periodStart through $periodEnd",
    (period) => {
      expect(
        trafficLightHistoryOutputSchema.safeParse({
          periods: [period],
          rows: [],
        }).success,
      ).toBe(true);
      expect(
        leadVelocityRowSchema.safeParse({ ...period, leads: [] }).success,
      ).toBe(true);
      expect(
        periodComparisonOutputSchema.safeParse({
          periodA: period,
          periodB: null,
          rows: [],
        }).success,
      ).toBe(true);
    },
  );
});
