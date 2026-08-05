import { describe, expect, it } from "vitest";
import { z } from "zod";

import { searchPlanSchema } from "./report-assistant-search-plan";

const validPlan = () => ({
  periods: {
    includeCurrent: true,
    published: { mode: "latest", count: 3, references: [] },
  },
  authors: { mode: "self", references: [], includeSelf: true },
  subjects: {
    parentKinds: [],
    productReferences: [],
    activityReferences: [],
    linkedActivityMode: "exclude",
  },
  stages: { references: [] },
  recordKinds: [],
  filters: {
    itemTypes: [],
    itemWorkflowStatuses: [],
    riskSeverities: [],
    decisionStates: [],
    decisionTiming: [],
    canonicalHealth: [],
    carriedOver: null,
    hasPriority: null,
    priorityRanks: [],
  },
  retrieval: { mode: "structured", semanticQuery: null },
  output: {
    mode: "list",
    groupBy: [],
    requestedLimit: null,
    exhaustive: false,
  },
});

const invalidPlans = [
  [
    "no period",
    (plan: ReturnType<typeof validPlan>) => ({
      ...plan,
      periods: {
        includeCurrent: false,
        published: { mode: "none", count: null, references: [] },
      },
    }),
  ],
  [
    "invalid latest",
    (plan: ReturnType<typeof validPlan>) => ({
      ...plan,
      periods: {
        ...plan.periods,
        published: { mode: "latest", count: null, references: [] },
      },
    }),
  ],
  [
    "invalid named",
    (plan: ReturnType<typeof validPlan>) => ({
      ...plan,
      periods: {
        ...plan.periods,
        published: { mode: "named", count: null, references: [] },
      },
    }),
  ],
  [
    "invalid self",
    (plan: ReturnType<typeof validPlan>) => ({
      ...plan,
      authors: { mode: "self", references: [], includeSelf: false },
    }),
  ],
  [
    "empty selected authors",
    (plan: ReturnType<typeof validPlan>) => ({
      ...plan,
      authors: { mode: "selected", references: [], includeSelf: false },
    }),
  ],
  [
    "linked activity without product",
    (plan: ReturnType<typeof validPlan>) => ({
      ...plan,
      subjects: { ...plan.subjects, linkedActivityMode: "include" },
    }),
  ],
  [
    "item filter without item",
    (plan: ReturnType<typeof validPlan>) => ({
      ...plan,
      recordKinds: ["risk"],
      filters: { ...plan.filters, itemTypes: ["current"] },
    }),
  ],
  [
    "risk filter without risk",
    (plan: ReturnType<typeof validPlan>) => ({
      ...plan,
      recordKinds: ["item"],
      filters: { ...plan.filters, riskSeverities: ["blocked"] },
    }),
  ],
  [
    "decision filter without decision",
    (plan: ReturnType<typeof validPlan>) => ({
      ...plan,
      recordKinds: ["item"],
      filters: { ...plan.filters, decisionStates: ["open"] },
    }),
  ],
  [
    "health filter without status",
    (plan: ReturnType<typeof validPlan>) => ({
      ...plan,
      recordKinds: ["item"],
      filters: { ...plan.filters, canonicalHealth: ["blocked"] },
    }),
  ],
  [
    "rank without priority",
    (plan: ReturnType<typeof validPlan>) => ({
      ...plan,
      filters: { ...plan.filters, priorityRanks: [1] },
    }),
  ],
  [
    "structured residual",
    (plan: ReturnType<typeof validPlan>) => ({
      ...plan,
      retrieval: { mode: "structured", semanticQuery: "urgent" },
    }),
  ],
  [
    "semantic without residual",
    (plan: ReturnType<typeof validPlan>) => ({
      ...plan,
      retrieval: { mode: "semantic_ranked", semanticQuery: null },
    }),
  ],
  [
    "semantic nonsemantic kinds",
    (plan: ReturnType<typeof validPlan>) => ({
      ...plan,
      recordKinds: ["product_status"],
      retrieval: { mode: "semantic_ranked", semanticQuery: "urgent" },
    }),
  ],
  [
    "comparison without grouping",
    (plan: ReturnType<typeof validPlan>) => ({
      ...plan,
      output: { ...plan.output, mode: "comparison" },
    }),
  ],
] as const;

describe("searchPlanSchema", () => {
  it("accepts explicit default planner intent", () => {
    expect(searchPlanSchema.safeParse(validPlan()).success).toBe(true);
  });

  it.each(invalidPlans)("rejects %s", (_name, makeInvalid) => {
    expect(searchPlanSchema.safeParse(makeInvalid(validPlan())).success).toBe(
      false,
    );
  });

  it("rejects strict unknown fields and normalized duplicate references", () => {
    expect(
      searchPlanSchema.safeParse({ ...validPlan(), extra: true }).success,
    ).toBe(false);
    expect(
      searchPlanSchema.safeParse({
        ...validPlan(),
        authors: {
          mode: "selected",
          includeSelf: false,
          references: ["Jane Doe", "jane   doe"],
        },
      }).success,
    ).toBe(false);
  });

  it.each([
    [
      "published all with a count",
      () => ({
        ...validPlan(),
        periods: {
          includeCurrent: true,
          published: { mode: "all", count: 1, references: [] },
        },
      }),
    ],
    [
      "all-visible author references",
      () => ({
        ...validPlan(),
        authors: {
          mode: "all_visible",
          includeSelf: true,
          references: ["Ada"],
        },
      }),
    ],
    [
      "duplicate record kinds",
      () => ({ ...validPlan(), recordKinds: ["item", "item"] }),
    ],
    [
      "priority ranks when priority is false",
      () => ({
        ...validPlan(),
        filters: {
          ...validPlan().filters,
          hasPriority: false,
          priorityRanks: [1],
        },
      }),
    ],
    [
      "an over-limit requested result",
      () => ({
        ...validPlan(),
        output: { ...validPlan().output, requestedLimit: 201 },
      }),
    ],
    [
      "more than two comparison dimensions",
      () => ({
        ...validPlan(),
        output: {
          ...validPlan().output,
          mode: "comparison",
          groupBy: ["period", "author", "subject"],
        },
      }),
    ],
  ])("rejects %s", (_name, invalidPlan) => {
    expect(searchPlanSchema.safeParse(invalidPlan()).success).toBe(false);
  });

  it("rejects unsafe references and enforces generated required fields", () => {
    expect(
      searchPlanSchema.safeParse({
        ...validPlan(),
        stages: { references: ["\u0000"] },
      }).success,
    ).toBe(false);
    const jsonSchema = z.toJSONSchema(searchPlanSchema);
    expect(jsonSchema.required).toEqual([
      "periods",
      "authors",
      "subjects",
      "stages",
      "recordKinds",
      "filters",
      "retrieval",
      "output",
    ]);
  });
});
