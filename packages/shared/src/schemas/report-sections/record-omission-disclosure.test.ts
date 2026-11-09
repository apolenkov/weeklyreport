import { describe, expect, it } from "vitest";

import {
  leadVelocityRowSchema,
  periodComparisonOutputSchema,
  trafficLightHistoryOutputSchema,
} from "../analytics/analytics.js";
import { reportAssistantOutcomeSchema } from "../report-assistant.js";
import { searchQueryOutputSchema } from "../search/search.js";
import {
  recordOmissionSchema,
  recordOmissionSummarySchema,
  summarizeRecordOmissions,
} from "./record-omission.schema.js";

const PRODUCT_ID = "10000000-0000-4000-8000-000000000003";
const KNOWN_ZERO = { risks: 0, decisions: 0, unknown: false };
const TWO_RISKS = { risks: 2, decisions: 0, unknown: false };
const PERIOD = { periodStart: "2026-11-02", periodEnd: "2026-11-08" };

const accepts =
  (schema: { safeParse: (v: unknown) => { success: boolean } }) =>
  (value: unknown): boolean =>
    schema.safeParse(value).success;

describe("public omission summary", () => {
  it("carries totals and the unknown flag only", () => {
    const ok = accepts(recordOmissionSummarySchema);

    expect(ok(KNOWN_ZERO)).toBe(true);
    expect(ok({ risks: 1, decisions: 3, unknown: true })).toBe(true);
    expect(ok({ ...KNOWN_ZERO, risks: -1 })).toBe(false);
    expect(ok({ ...KNOWN_ZERO, decisions: 0.5 })).toBe(false);
    expect(ok({ risks: 0, decisions: 0 })).toBe(false);
    expect(ok({ ...KNOWN_ZERO, buckets: [] })).toBe(false);
  });

  it("reads missing legacy metadata as unknown and present metadata as known", () => {
    const section = recordOmissionSchema.parse({
      version: 1,
      buckets: [
        {
          kind: "risk",
          parentKind: "product",
          parentId: PRODUCT_ID,
          stageNames: ["Analysis"],
          count: 2,
        },
      ],
    });

    expect(summarizeRecordOmissions([section])).toEqual(TWO_RISKS);
    expect(
      recordOmissionSummarySchema.parse(
        summarizeRecordOmissions([section, undefined]),
      ),
    ).toEqual({ ...TWO_RISKS, unknown: true });
    expect(summarizeRecordOmissions([])).toEqual(KNOWN_ZERO);
  });

  it("rejects malformed present metadata instead of calling it unknown", () => {
    const ok = accepts(recordOmissionSchema);

    expect(ok({ version: 2, buckets: [] })).toBe(false);
    expect(ok({ version: 1 })).toBe(false);
    expect(
      ok({
        version: 1,
        buckets: [
          {
            kind: "risk",
            parentKind: "product",
            parentId: PRODUCT_ID,
            stageNames: ["Analysis"],
            count: 0,
          },
        ],
      }),
    ).toBe(false);
  });
});

describe("search disclosure", () => {
  it("keeps the notice on a response with no hits", () => {
    expect(
      searchQueryOutputSchema.parse({ hits: [], omissions: TWO_RISKS }),
    ).toEqual({ hits: [], omissions: TWO_RISKS });
  });

  it("rejects the bare hit array and a response without the notice", () => {
    const ok = accepts(searchQueryOutputSchema);

    expect(ok([])).toBe(false);
    expect(ok({ hits: [] })).toBe(false);
    expect(ok({ hits: [], omissions: KNOWN_ZERO, total: 0 })).toBe(false);
  });
});

describe("assistant coverage", () => {
  it("requires coverage on answers and on no-results", () => {
    const ok = accepts(reportAssistantOutcomeSchema);
    const answer = {
      kind: "ok",
      answerMarkdown: "Answer",
      citations: [],
      metadata: { truncated: false, insufficientEvidence: false },
    };

    expect(ok({ kind: "no_results", coverage: TWO_RISKS })).toBe(true);
    expect(ok({ kind: "no_results" })).toBe(false);
    expect(ok({ ...answer, coverage: KNOWN_ZERO })).toBe(true);
    expect(ok(answer)).toBe(false);
  });

  it("keeps coverage off outcomes that selected no corpus", () => {
    expect(
      accepts(reportAssistantOutcomeSchema)({
        kind: "invalid_plan",
        coverage: KNOWN_ZERO,
      }),
    ).toBe(false);
  });
});

describe("analytics disclosure", () => {
  it("rejects a cached period without the disclosure", () => {
    expect(
      accepts(trafficLightHistoryOutputSchema)({ periods: [PERIOD], rows: [] }),
    ).toBe(false);
    expect(accepts(leadVelocityRowSchema)({ ...PERIOD, leads: [] })).toBe(
      false,
    );
    expect(
      accepts(periodComparisonOutputSchema)({
        periodA: PERIOD,
        periodB: null,
        rows: [],
      }),
    ).toBe(false);
  });

  it("keeps a period whose only content is its disclosure", () => {
    const period = { ...PERIOD, omissions: TWO_RISKS };

    expect(
      trafficLightHistoryOutputSchema.parse({ periods: [period], rows: [] })
        .periods[0]?.omissions,
    ).toEqual(TWO_RISKS);
    expect(
      leadVelocityRowSchema.parse({ ...period, leads: [] }).omissions,
    ).toEqual(TWO_RISKS);
  });

  it("makes no omission claim for an absent comparison side", () => {
    const parsed = periodComparisonOutputSchema.parse({
      periodA: { ...PERIOD, omissions: { ...KNOWN_ZERO, unknown: true } },
      periodB: null,
      rows: [],
    });

    expect(parsed.periodB).toBeNull();
    expect(parsed.periodA?.omissions.unknown).toBe(true);
  });
});
