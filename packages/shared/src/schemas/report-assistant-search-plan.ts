import { z } from "zod";

import { canonicalStatusSchema } from "./canonical-status";
import { validateSearchPlan } from "./report-assistant-search-plan-validation";
import {
  itemTypeSchema,
  itemWorkflowStatusSchema,
  riskSeveritySchema,
  safeText,
} from "./report-primitives.schema";

const MAX_REFERENCES = 20;
const MAX_PUBLISHED_PERIODS = 52;
const MAX_RECORD_KINDS = 6;
const MAX_ITEM_WORKFLOW_STATUSES = 5;
const MAX_DECISION_TIMINGS = 6;
const MAX_CANONICAL_STATUSES = 4;
const MAX_PRIORITY_RANK = 100;
const MAX_REQUESTED_LIMIT = 200;
const DEFAULT_PUBLISHED_PERIOD_COUNT = 3;
const referenceSchema = safeText({ max: 200 });

const periodModeSchema = z.enum(["none", "latest", "all", "named"]);
const authorModeSchema = z.enum(["self", "all_visible", "selected"]);
const parentKindSchema = z.enum(["product", "activity"]);
const recordKindSchema = z.enum([
  "item",
  "risk",
  "decision",
  "product_status",
  "stage_status",
  "activity_status",
]);
export const decisionStateSchema = z.enum(["open", "resolved"]);
export const decisionTimingSchema = z.enum([
  "without_deadline",
  "overdue",
  "due_today",
  "upcoming",
  "resolved_on_time",
  "resolved_late",
]);
const retrievalModeSchema = z.enum(["structured", "semantic_ranked"]);
const outputModeSchema = z.enum(["list", "count", "summary", "comparison"]);
const groupingSchema = z.enum([
  "period",
  "author",
  "subject",
  "stage",
  "record_kind",
  "canonical_health",
  "item_type",
  "item_workflow_status",
  "risk_severity",
  "decision_state",
  "decision_timing",
]);
const referencesSchema = z.array(referenceSchema).max(MAX_REFERENCES);

const searchPlanBaseSchema = z
  .object({
    periods: z
      .object({
        includeCurrent: z.boolean().default(true),
        published: z
          .object({
            mode: periodModeSchema.default("latest"),
            count: z
              .number()
              .int()
              .min(1)
              .max(MAX_PUBLISHED_PERIODS)
              .nullable()
              .default(DEFAULT_PUBLISHED_PERIOD_COUNT),
            references: referencesSchema.default([]),
          })
          .strict()
          .default({
            mode: "latest",
            count: DEFAULT_PUBLISHED_PERIOD_COUNT,
            references: [],
          }),
      })
      .strict()
      .default({
        includeCurrent: true,
        published: {
          mode: "latest",
          count: DEFAULT_PUBLISHED_PERIOD_COUNT,
          references: [],
        },
      }),
    authors: z
      .object({
        mode: authorModeSchema.default("self"),
        references: referencesSchema.default([]),
        includeSelf: z.boolean().default(true),
      })
      .strict()
      .default({ mode: "self", references: [], includeSelf: true }),
    subjects: z
      .object({
        parentKinds: z.array(parentKindSchema).max(2).default([]),
        productReferences: referencesSchema.default([]),
        activityReferences: referencesSchema.default([]),
        linkedActivityMode: z
          .enum(["exclude", "include", "only"])
          .default("exclude"),
      })
      .strict()
      .default({
        parentKinds: [],
        productReferences: [],
        activityReferences: [],
        linkedActivityMode: "exclude",
      }),
    stages: z
      .object({ references: referencesSchema.default([]) })
      .strict()
      .default({ references: [] }),
    recordKinds: z.array(recordKindSchema).max(MAX_RECORD_KINDS).default([]),
    filters: z
      .object({
        itemTypes: z.array(itemTypeSchema).max(2).default([]),
        itemWorkflowStatuses: z
          .array(itemWorkflowStatusSchema)
          .max(MAX_ITEM_WORKFLOW_STATUSES)
          .default([]),
        riskSeverities: z.array(riskSeveritySchema).max(2).default([]),
        decisionStates: z.array(decisionStateSchema).max(2).default([]),
        decisionTiming: z
          .array(decisionTimingSchema)
          .max(MAX_DECISION_TIMINGS)
          .default([]),
        canonicalHealth: z
          .array(canonicalStatusSchema)
          .max(MAX_CANONICAL_STATUSES)
          .default([]),
        carriedOver: z.boolean().nullable().default(null),
        hasPriority: z.boolean().nullable().default(null),
        priorityRanks: z
          .array(z.number().int().min(1).max(MAX_PRIORITY_RANK))
          .max(MAX_PRIORITY_RANK)
          .default([]),
      })
      .strict()
      .default({
        itemTypes: [],
        itemWorkflowStatuses: [],
        riskSeverities: [],
        decisionStates: [],
        decisionTiming: [],
        canonicalHealth: [],
        carriedOver: null,
        hasPriority: null,
        priorityRanks: [],
      }),
    retrieval: z
      .object({
        mode: retrievalModeSchema.default("structured"),
        semanticQuery: safeText({ max: 500 }).nullable().default(null),
      })
      .strict()
      .default({ mode: "structured", semanticQuery: null }),
    output: z
      .object({
        mode: outputModeSchema.default("list"),
        groupBy: z.array(groupingSchema).max(2).default([]),
        requestedLimit: z
          .number()
          .int()
          .min(1)
          .max(MAX_REQUESTED_LIMIT)
          .nullable()
          .default(null),
        exhaustive: z.boolean().default(false),
      })
      .strict()
      .default({
        mode: "list",
        groupBy: [],
        requestedLimit: null,
        exhaustive: false,
      }),
  })
  .strict();

export type SearchPlanBase = z.infer<typeof searchPlanBaseSchema>;
export const searchPlanSchema =
  searchPlanBaseSchema.superRefine(validateSearchPlan);
export type SearchPlan = z.infer<typeof searchPlanSchema>;
export type DecisionState = z.infer<typeof decisionStateSchema>;
export type DecisionTiming = z.infer<typeof decisionTimingSchema>;
