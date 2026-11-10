import { type SearchPlan, searchPlanSchema } from "@weeklyreport/shared";

export const basePlan: SearchPlan = searchPlanSchema.parse({
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
});
