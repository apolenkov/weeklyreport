import { describe, expect, it } from "vitest";

import { validateCitationIds } from "./citation-validator.js";
import {
  buildGroundingBundle,
  groundingPromptData,
} from "./context-builder.js";
import type {
  ResolvedSearchPlan,
  SearchCandidate,
} from "./report-retrieval.types.js";

const basePlan: ResolvedSearchPlan = {
  plan: {
    periods: {
      includeCurrent: true,
      published: { mode: "none", count: null, references: [] },
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
      mode: "summary",
      groupBy: ["record_kind"],
      requestedLimit: null,
      exhaustive: false,
    },
  },
  occurrences: [],
  sectionScopes: [],
  authorIds: ["author"],
  productIds: [],
  activityIds: [],
  stageIds: [],
  periodIds: [],
};

const item = (id: string, text: string): SearchCandidate => ({
  kind: "item",
  identity: { occurrenceId: id, recordId: id, lineageId: null },
  context: {
    reportId: "22222222-2222-4222-8222-222222222222",
    periodId: "period",
    periodLabel: "Week 31",
    periodStart: new Date("2026-08-04T00:00:00.000Z"),
    source: "live",
    sectionId: "section",
    authorId: "author",
    authorName: "Lead",
    subject: { kind: "product", id: "product", name: "CRM Portal" },
    stageIds: ["Development"],
    linkedProductIds: [],
  },
  text,
  itemType: "current",
  workflowStatus: "in_progress",
  carriedOver: false,
  priorityRank: null,
});

const status: SearchCandidate = {
  ...item("status", ""),
  kind: "product_status",
  status: "blocked",
};

describe("GroundingBundle", () => {
  it("aggregates the complete set before token budgeting and assigns sources", () => {
    const bundle = buildGroundingBundle(
      [item("one", "short"), item("two", "another long record"), status],
      basePlan,
      250,
    );

    expect(bundle.aggregates.totalCount).toBe(3);
    expect(bundle.aggregates.byKind).toEqual([
      { key: "item", count: 2 },
      { key: "product_status", count: 1 },
    ]);
    expect(bundle.evidence.map(({ source }) => source.sourceId)).toEqual([
      "S1",
      "S2",
    ]);
    expect(bundle.truncated).toBe(true);
    expect(bundle.aggregates.supportingStatusFacts).toHaveLength(0);
  });

  it("rejects unknown citations and preserves valid source metadata", () => {
    const bundle = buildGroundingBundle([item("one", "short")], basePlan, 1000);
    expect(validateCitationIds(["S1"], bundle)).toMatchObject({
      kind: "valid",
    });
    expect(validateCitationIds(["S1", "S9"], bundle)).toEqual({
      kind: "invalid",
      unknownSourceIds: ["S9"],
    });
  });

  it("budgets the compact serialized prompt instead of internal metadata", () => {
    const budget = 1000;
    const candidate = {
      ...item("one", "Short evidence"),
      context: {
        ...item("one", "Short evidence").context,
        sectionId: "internal-section".repeat(1000),
        linkedProductIds: Array.from(
          { length: 200 },
          (_, index) => `internal-product-${index}`,
        ),
      },
    };

    const bundle = buildGroundingBundle([candidate], basePlan, budget);
    const serialized = JSON.stringify(groundingPromptData(bundle));

    expect(bundle.evidence).toHaveLength(1);
    expect(bundle.estimatedTokens).toBeLessThanOrEqual(budget);
    expect(serialized).toContain("Short evidence");
    expect(serialized).not.toContain("internal-section");
    expect(serialized).not.toContain("internal-product");
  });
});
