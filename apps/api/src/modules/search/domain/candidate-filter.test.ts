import { describe, expect, it } from "vitest";

import {
  filterCandidates,
  limitCandidates,
  sortCandidates,
} from "./candidate-filter.js";
import type {
  ItemCandidate,
  ResolvedSearchPlan,
} from "./report-retrieval.types.js";

const plan = (
  overrides: Partial<ResolvedSearchPlan["plan"]> = {},
): ResolvedSearchPlan => ({
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
      mode: "list",
      groupBy: [],
      requestedLimit: null,
      exhaustive: false,
    },
    ...overrides,
  },
  occurrences: [],
  sectionScopes: [],
  authorIds: ["author"],
  productIds: [],
  activityIds: [],
  stageIds: [],
  periodIds: [],
});

const item = (overrides: Partial<ItemCandidate> = {}): ItemCandidate => ({
  kind: "item",
  identity: {
    occurrenceId: overrides.identity?.occurrenceId ?? "item",
    recordId: "item",
    lineageId: null,
  },
  context: {
    reportId: "report",
    periodId: "period",
    periodLabel: "Week",
    periodStart: new Date("2026-08-04T00:00:00.000Z"),
    source: "live",
    sectionId: "section",
    authorId: "author",
    authorName: "Lead",
    subject: { kind: "product", id: "product", name: "Product" },
    stageIds: ["Development"],
    linkedProductIds: [],
  },
  text: "item",
  itemType: "current",
  workflowStatus: "in_progress",
  carriedOver: false,
  priorityRank: null,
  ...overrides,
});

const clock = { now: new Date("2026-08-04T12:00:00.000Z"), timeZone: "UTC" };

describe("candidate filters and limits", () => {
  it("combines exact dimensions with AND and values within a dimension with OR", () => {
    const candidate = item({ priorityRank: 2, carriedOver: true });
    const resolved = plan({
      filters: {
        ...plan().plan.filters,
        itemWorkflowStatuses: ["planned", "in_progress"],
        carriedOver: true,
        priorityRanks: [2, 3],
        hasPriority: true,
      },
      subjects: {
        ...plan().plan.subjects,
        parentKinds: ["product"],
      },
    });
    expect(filterCandidates([candidate], resolved, clock)).toEqual([candidate]);
    expect(
      filterCandidates(
        [candidate],
        plan({ filters: { ...resolved.plan.filters, priorityRanks: [3] } }),
        clock,
      ),
    ).toEqual([]);
  });

  it("expands linked activities only for include/only subject modes", () => {
    const activity = item({
      context: {
        ...item().context,
        subject: { kind: "activity", id: "activity", name: "On-call" },
        linkedProductIds: ["product-a"],
      },
    });
    const subjects: ResolvedSearchPlan["plan"]["subjects"] = {
      parentKinds: ["activity"],
      productReferences: ["CRM"],
      activityReferences: [],
      linkedActivityMode: "include",
    };
    expect(
      filterCandidates(
        [activity],
        { ...plan({ subjects }), productIds: ["product-a"] },
        clock,
      ),
    ).toEqual([activity]);
    expect(
      filterCandidates(
        [activity],
        {
          ...plan({ subjects: { ...subjects, linkedActivityMode: "only" } }),
          productIds: ["product-a"],
        },
        clock,
      ),
    ).toEqual([activity]);
  });

  it("keeps named-period resolution exact", () => {
    const candidate = item();

    expect(
      filterCandidates(
        [candidate],
        { ...plan(), periodIds: ["other-period"] },
        clock,
      ),
    ).toEqual([]);
    expect(
      filterCandidates(
        [candidate],
        { ...plan(), periodIds: ["period"] },
        clock,
      ),
    ).toEqual([candidate]);
  });

  it("sorts structured results without mutating the input", () => {
    const older = item({
      identity: { occurrenceId: "older", recordId: "older", lineageId: null },
      context: {
        ...item().context,
        periodStart: new Date("2026-08-03T00:00:00.000Z"),
      },
    });
    const newer = item({
      identity: { occurrenceId: "newer", recordId: "newer", lineageId: null },
    });
    const candidates = [older, newer];
    expect(sortCandidates(candidates, "structured", new Map())).toEqual([
      newer,
      older,
    ]);
    expect(candidates).toEqual([older, newer]);
  });

  it("returns a hard overflow for exhaustive or semantic sets", () => {
    const candidates = [
      item(),
      item({
        identity: { occurrenceId: "two", recordId: "two", lineageId: null },
      }),
    ];
    expect(
      limitCandidates(
        candidates,
        plan({ output: { ...plan().plan.output, exhaustive: true } }),
        {
          candidateLimit: 1,
          exhaustiveLimit: 1,
        },
      ),
    ).toEqual({ kind: "result_set_too_large", totalCount: 2 });
    expect(
      limitCandidates(candidates, plan(), {
        candidateLimit: 1,
        exhaustiveLimit: 2,
      }),
    ).toMatchObject({ kind: "ok", totalCount: 2, truncated: true });
  });
});
