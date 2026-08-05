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
        includeCurrent: z.boolean(),
        published: z
          .object({
            mode: periodModeSchema,
            count: z
              .number()
              .int()
              .min(1)
              .max(MAX_PUBLISHED_PERIODS)
              .nullable(),
            references: referencesSchema,
          })
          .strict(),
      })
      .strict(),
    authors: z
      .object({
        mode: authorModeSchema,
        references: referencesSchema,
        includeSelf: z.boolean(),
      })
      .strict(),
    subjects: z
      .object({
        parentKinds: z.array(parentKindSchema).max(2),
        productReferences: referencesSchema,
        activityReferences: referencesSchema,
        linkedActivityMode: z.enum(["exclude", "include", "only"]),
      })
      .strict(),
    stages: z.object({ references: referencesSchema }).strict(),
    recordKinds: z.array(recordKindSchema).max(MAX_RECORD_KINDS),
    filters: z
      .object({
        itemTypes: z.array(itemTypeSchema).max(2),
        itemWorkflowStatuses: z
          .array(itemWorkflowStatusSchema)
          .max(MAX_ITEM_WORKFLOW_STATUSES),
        riskSeverities: z.array(riskSeveritySchema).max(2),
        decisionStates: z.array(decisionStateSchema).max(2),
        decisionTiming: z.array(decisionTimingSchema).max(MAX_DECISION_TIMINGS),
        canonicalHealth: z
          .array(canonicalStatusSchema)
          .max(MAX_CANONICAL_STATUSES),
        carriedOver: z.boolean().nullable(),
        hasPriority: z.boolean().nullable(),
        priorityRanks: z
          .array(z.number().int().min(1).max(MAX_PRIORITY_RANK))
          .max(MAX_PRIORITY_RANK),
      })
      .strict(),
    retrieval: z
      .object({
        mode: retrievalModeSchema,
        semanticQuery: safeText({ max: 500 }).nullable(),
      })
      .strict(),
    output: z
      .object({
        mode: outputModeSchema,
        groupBy: z.array(groupingSchema).max(2),
        requestedLimit: z
          .number()
          .int()
          .min(1)
          .max(MAX_REQUESTED_LIMIT)
          .nullable(),
        exhaustive: z.boolean(),
      })
      .strict(),
  })
  .strict();

export type SearchPlanBase = z.infer<typeof searchPlanBaseSchema>;
export const searchPlanSchema =
  searchPlanBaseSchema.superRefine(validateSearchPlan);
export type SearchPlan = z.infer<typeof searchPlanSchema>;
export type DecisionState = z.infer<typeof decisionStateSchema>;
export type DecisionTiming = z.infer<typeof decisionTimingSchema>;
