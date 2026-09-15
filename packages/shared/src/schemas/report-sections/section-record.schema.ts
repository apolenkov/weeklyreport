import { z } from "zod";

import {
  addItemTypeStatusIssue,
  currentStageNamesField,
  itemTypeSchema,
  itemWorkflowStatusSchema,
  riskSeveritySchema,
  SAFE_TEXT_MAX_LENGTH,
  safeText,
  trafficLightStatusSchema,
  writeStageNamesField,
} from "../primitives/report-primitives.schema";
import { recordCommentViewSchema } from "../review/review.schema";
import {
  itemOutcomeEventSchema,
  itemResolutionSchema,
} from "./item-outcome.schema";

const ITEM_TAG_MAX_LENGTH = 50;
const DECISION_OWNER_MAX_LENGTH = 200;

/** Maximum length of the catalogue activity name and its weekly title override. */
export const MAX_ACTIVITY_NAME_LENGTH = 200;

// Blank/whitespace override resets to null (fall back to the catalogue name);
// a non-blank value is trimmed to the catalogue-name limit.
const titleOverrideField = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  },
  safeText({ max: MAX_ACTIVITY_NAME_LENGTH }).nullable().optional(),
);

// The form emits an empty string when a lead clears the description. Accept
// only blank strings as the reset branch; non-blank notes retain safeText's
// existing null-byte, visible-character, and length checks.
const activityNoteField = z
  .union([
    safeText(),
    z
      .string()
      .max(SAFE_TEXT_MAX_LENGTH)
      .refine((value) => value.trim() === "", {
        message: "Blank text resets the Activity description.",
      }),
    z.null(),
  ])
  .transform((value) =>
    typeof value === "string" && value.trim() === "" ? null : value,
  )
  .optional();

/** Accepts a lead-authored traffic-light status for one product. */
export const projectStatusInputSchema = z
  .object({
    projectId: z.uuid(),
    status: trafficLightStatusSchema.optional(),
  })
  .readonly();

/** Accepts a lead-authored status, weekly title override and note for one activity. */
export const activityStatusInputSchema = z
  .object({
    activityId: z.uuid(),
    status: trafficLightStatusSchema.nullable().optional(),
    titleOverride: titleOverrideField,
    note: activityNoteField,
  })
  .readonly();

/** Describes a product linked to a department activity. */
export const linkedProductSchema = z
  .object({
    productId: z.uuid(),
    productName: z.string().min(1),
  })
  .readonly();

/** Describes an activity visible in a report section and its derived status. */
export const sectionActivitySchema = z
  .object({
    activityId: z.uuid(),
    activityName: z.string().min(1),
    // Weekly override of activityName; null/absent renders the catalogue name.
    titleOverride: z
      .string()
      .max(MAX_ACTIVITY_NAME_LENGTH)
      .nullable()
      .optional(),
    status: trafficLightStatusSchema.nullable(),
    note: z.string().nullable().optional(),
    jiraAccounts: z.array(z.string().min(1)).readonly(),
    linkedProducts: z.array(linkedProductSchema).readonly().default([]),
    derivedStatus: trafficLightStatusSchema.nullable().default(null),
    alarmFloor: trafficLightStatusSchema.nullable().default(null),
  })
  .readonly();

/** Accepts a lead-authored status for one assigned product stage. */
export const stageStatusInputSchema = z
  .object({
    projectId: z.uuid(),
    stageId: z.uuid(),
    status: trafficLightStatusSchema.nullable().optional(),
  })
  .readonly();

const itemInputObjectSchema = z.object({
  id: z.uuid().optional(),
  stableId: z.uuid().optional(),
  projectId: z.uuid().nullable().optional(),
  activityId: z.uuid().nullable().optional(),
  type: itemTypeSchema,
  text: safeText(),
  tag: safeText({ max: ITEM_TAG_MAX_LENGTH }),
  workflowStatus: itemWorkflowStatusSchema,
  carriedOver: z.boolean().default(false),
  priorityRank: z.number().int().min(1).nullable().optional(),
  pausedReason: safeText().nullable().optional(),
  nextStepText: safeText().nullable().optional(),
  stageNames: writeStageNamesField,
});

const addPausedReasonIssues = (
  value: {
    readonly workflowStatus: string;
    readonly pausedReason?: string | null | undefined;
  },
  ctx: z.RefinementCtx,
): void => {
  const reason = value.pausedReason ?? null;
  if (value.workflowStatus === "paused") {
    if (reason == null || reason.trim().length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["pausedReason"],
        message: "A paused item requires a non-blank reason.",
      });
    }
  } else if (reason != null) {
    ctx.addIssue({
      code: "custom",
      path: ["pausedReason"],
      message: "Only paused items may carry a pause reason.",
    });
  }
};

const addReadParentXorIssues = (
  value: {
    readonly projectId?: string | null | undefined;
    readonly productId?: string | null | undefined;
    readonly activityId?: string | null | undefined;
    readonly stageNames: readonly string[];
  },
  productPath: "projectId" | "productId",
  ctx: z.RefinementCtx,
): void => {
  const hasProduct =
    (productPath === "productId" ? value.productId : value.projectId) != null;
  const hasActivity = value.activityId != null;
  if (hasProduct === hasActivity) {
    ctx.addIssue({
      code: "custom",
      path: [hasActivity ? "activityId" : productPath],
      message:
        "A record must have exactly one parent — a product or an activity.",
    });
    return;
  }
  if (hasProduct && value.stageNames.length === 0) {
    ctx.addIssue({
      code: "custom",
      path: ["stageNames"],
      message: "A product-parented record requires at least one stage.",
    });
  }
  if (hasActivity && value.stageNames.length > 0) {
    ctx.addIssue({
      code: "custom",
      path: ["stageNames"],
      message: "An activity-parented record must not carry a stage.",
    });
  }
};

/** Accepts the shared fields of an item draft or read model. */
export const itemInputSchema = itemInputObjectSchema
  .superRefine(addPausedReasonIssues)
  .readonly();

const itemReadModelObjectSchema = itemInputObjectSchema.extend({
  stageNames: currentStageNamesField,
  comments: z.array(recordCommentViewSchema.readonly()).readonly().optional(),
  resolution: itemResolutionSchema.nullable().optional(),
  outcomeHistory: z.array(itemOutcomeEventSchema).readonly().optional(),
});

/** Describes an item returned to its author-visible report clients. */
export const itemReadModelSchema = itemReadModelObjectSchema
  .superRefine((value, ctx) => addReadParentXorIssues(value, "projectId", ctx))
  .superRefine(addPausedReasonIssues)
  .readonly();

/** Describes an item in the co-lead shared lens with private fields omitted. */
export const sharedItemReadModelSchema = itemReadModelObjectSchema
  .extend({
    comments: z.never().optional(),
    pausedReason: z.never().optional(),
    resolution: z.never().optional(),
    outcomeHistory: z.never().optional(),
  })
  .superRefine((value, ctx) => addReadParentXorIssues(value, "projectId", ctx))
  .readonly();

const riskInputObjectSchema = z.object({
  id: z.uuid().optional(),
  stableId: z.uuid().optional(),
  projectId: z.uuid().nullable().optional(),
  activityId: z.uuid().nullable().optional(),
  risk: safeText(),
  impact: safeText(),
  mitigation: safeText(),
  severity: riskSeveritySchema,
  stageNames: writeStageNamesField,
});

/** Accepts the shared fields of a risk draft or read model. */
export const riskInputSchema = riskInputObjectSchema.readonly();

const riskReadModelObjectSchema = riskInputObjectSchema.extend({
  stageNames: currentStageNamesField,
  comments: z.array(recordCommentViewSchema.readonly()).readonly().optional(),
});

/** Describes a risk returned to report clients with review comments. */
export const riskReadModelSchema = riskReadModelObjectSchema
  .superRefine((value, ctx) => addReadParentXorIssues(value, "projectId", ctx))
  .readonly();

/** Describes a risk in the co-lead shared lens with comments omitted. */
export const sharedRiskReadModelSchema = riskReadModelObjectSchema
  .extend({ comments: z.never().optional() })
  .superRefine((value, ctx) => addReadParentXorIssues(value, "projectId", ctx))
  .readonly();

const decisionInputObjectSchema = z.object({
  id: z.uuid().optional(),
  stableId: z.uuid().optional(),
  text: safeText(),
  owner: safeText({ max: DECISION_OWNER_MAX_LENGTH }),
  deadline: z.coerce.date().nullable().optional(),
  impact: safeText(),
  resolvedAt: z.coerce.date().nullable().optional(),
  stageNames: writeStageNamesField,
  productId: z.uuid().nullable().optional(),
  activityId: z.uuid().nullable().optional(),
});

/** Accepts the shared fields of a decision draft or read model. */
export const decisionInputSchema = decisionInputObjectSchema.readonly();

const decisionReadModelObjectSchema = decisionInputObjectSchema.extend({
  stageNames: currentStageNamesField,
  comments: z.array(recordCommentViewSchema.readonly()).readonly().optional(),
});

/** Describes a decision returned to report clients with review comments. */
export const decisionReadModelSchema = decisionReadModelObjectSchema
  .superRefine((value, ctx) => addReadParentXorIssues(value, "productId", ctx))
  .readonly();

/** Describes a decision in the co-lead shared lens with comments omitted. */
export const sharedDecisionReadModelSchema = decisionReadModelObjectSchema
  .extend({ comments: z.never().optional() })
  .superRefine((value, ctx) => addReadParentXorIssues(value, "productId", ctx))
  .readonly();

const addParentXorIssues = (
  value: {
    readonly activityId?: string | null | undefined;
    readonly stageNames?: readonly string[] | undefined;
  },
  productId: string | null | undefined,
  productPath: "projectId" | "productId",
  ctx: z.RefinementCtx,
): void => {
  const { activityId, stageNames } = value;
  const hasProduct = productId != null;
  const hasActivity = activityId != null;
  if (hasProduct === hasActivity) {
    ctx.addIssue({
      code: "custom",
      path: [hasActivity ? "activityId" : productPath],
      message:
        "A record must have exactly one parent — a product or an activity.",
    });
  }
  const stageCount = stageNames?.length ?? 0;
  if (hasProduct && stageCount === 0) {
    ctx.addIssue({
      code: "custom",
      path: ["stageNames"],
      message: "A product-parented record requires at least one stage.",
    });
  }
  if (hasActivity && stageCount > 0) {
    ctx.addIssue({
      code: "custom",
      path: ["stageNames"],
      message: "An activity-parented record must not carry a stage.",
    });
  }
};

/** Validates an item write against parent and workflow-status invariants. */
export const itemWriteSchema = itemInputObjectSchema
  .superRefine((value, ctx) => {
    addParentXorIssues(value, value.projectId, "projectId", ctx);
    addItemTypeStatusIssue(value.type, value.workflowStatus, ctx);
    addPausedReasonIssues(value, ctx);
    if (
      value.nextStepText != null &&
      (value.type !== "current" || value.workflowStatus === "done")
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["nextStepText"],
        message:
          "Only unfinished current work may have a next-period commitment.",
      });
    }
  })
  .readonly();

/** Validates a risk write against its product-or-activity parent invariant. */
export const riskWriteSchema = riskInputObjectSchema
  .superRefine((value, ctx) =>
    addParentXorIssues(value, value.projectId, "projectId", ctx),
  )
  .readonly();

/** Validates a decision write against its product-or-activity parent invariant. */
export const decisionWriteSchema = decisionInputObjectSchema
  .superRefine((value, ctx) =>
    addParentXorIssues(value, value.productId, "productId", ctx),
  )
  .readonly();
