import { z } from "zod";

import {
  addItemTypeStatusIssue,
  addNextStepTextIssue,
  addPausedReasonIssues,
  itemTypeSchema,
  itemWorkflowStatusSchema,
  safeText,
  writeStageNamesField,
} from "../primitives/report-primitives.schema";

const itemOutcomeSchema = z.enum(["done", "continue", "plan_next", "wont_do"]);

const itemOutcomeStateObjectSchema = z
  .object({
    type: itemTypeSchema,
    workflowStatus: itemWorkflowStatusSchema,
    pausedReason: safeText().nullable(),
    nextStepText: safeText().nullable(),
    // Retained result text so a transition can present the superseded work.
    // Defaulted to null so events written before this field still parse.
    text: safeText().nullable().default(null),
  })
  .strict();

const addOutcomeStateIssues = (
  value: {
    readonly type: "current" | "next";
    readonly workflowStatus: string;
    readonly pausedReason: string | null;
    readonly nextStepText: string | null;
  },
  ctx: z.RefinementCtx,
): void => {
  addItemTypeStatusIssue(value.type, value.workflowStatus, ctx);
  addPausedReasonIssues(value, ctx);
  addNextStepTextIssue(value, ctx);
};

/** Defines the canonical item tuple retained before and after an outcome. */
export const itemOutcomeStateSchema = itemOutcomeStateObjectSchema
  .superRefine(addOutcomeStateIssues)
  .readonly();

/** Defines the server-resolved source of a plan outcome command. */
export const resolvePlanSourceSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("current"),
      recordId: z.uuid(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("prior"),
      reportId: z.uuid(),
      recordId: z.uuid(),
    })
    .strict(),
]);

const resolvePlanInputObjectSchema = z
  .object({
    reportSectionId: z.uuid(),
    version: z.number().int().min(1),
    commandId: z.uuid(),
    source: resolvePlanSourceSchema,
    outcome: itemOutcomeSchema,
    text: safeText().optional(),
    nextStepText: safeText().nullable().optional(),
    stageNames: writeStageNamesField,
    priorityRank: z.number().int().min(1).nullable().optional(),
    parent: z
      .object({
        kind: z.enum(["product", "activity"]),
        id: z.uuid(),
      })
      .strict()
      .optional(),
    reason: safeText().optional(),
  })
  .strict();

/** Accepts an optimistic, server-resolved command for one plan outcome. */
export const resolvePlanInputSchema = resolvePlanInputObjectSchema
  .superRefine((value, ctx) => {
    if (
      value.outcome === "plan_next" &&
      value.source.kind === "current" &&
      value.text === undefined
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["text"],
        message: "Describe the next-period commitment explicitly.",
      });
    }
    if (value.outcome === "wont_do") {
      if (value.reason === undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["reason"],
          message: "A won't-do outcome requires a reason.",
        });
      }
    } else if (value.reason !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["reason"],
        message: "Only a won't-do outcome may carry a reason.",
      });
    }
    if (value.outcome !== "continue" && value.nextStepText !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["nextStepText"],
        message: "Only a continue outcome may carry a next step.",
      });
    }
  })
  .readonly();

const itemPlanTransitionInputObjectSchema = z
  .object({
    reportSectionId: z.uuid(),
    version: z.number().int().min(1),
    commandId: z.uuid(),
    recordId: z.uuid(),
  })
  .strict();

/** Accepts an optimistic command to restore a cancelled current occurrence. */
export const restorePlanInputSchema =
  itemPlanTransitionInputObjectSchema.readonly();

/** Accepts an optimistic command to activate a linked next step in either week. */
export const promotePlanInputSchema = itemPlanTransitionInputObjectSchema
  .extend({ target: z.enum(["current", "next"]).optional() })
  .strict()
  .readonly();

/** Describes the server-owned resolution metadata shown on an item. */
export const itemResolutionSchema = z
  .object({
    kind: z.literal("wont_do"),
    eventId: z.uuid(),
    reason: safeText(),
    actorId: z.uuid(),
    actorName: z.string().trim().min(1),
    occurredAt: z.iso.datetime(),
    previousState: itemOutcomeStateSchema,
  })
  .strict()
  .readonly();

/** Describes one immutable, server-owned item outcome audit event. */
export const itemOutcomeEventSchema = z
  .object({
    id: z.uuid(),
    stableId: z.uuid(),
    outcome: z.union([
      itemOutcomeSchema,
      z.literal("restore"),
      z.literal("promote"),
    ]),
    reason: safeText().nullable(),
    actorId: z.uuid(),
    actorName: z.string().trim().min(1),
    occurredAt: z.iso.datetime(),
    beforeState: itemOutcomeStateSchema,
    afterState: itemOutcomeStateSchema,
    reversesEventId: z.uuid().nullable(),
  })
  .strict()
  .readonly();

/** Validated input for an atomic plan outcome command. */
export type ResolvePlanInput = z.infer<typeof resolvePlanInputSchema>;
/** Validated input for restoring a cancelled current occurrence. */
export type RestorePlanInput = z.infer<typeof restorePlanInputSchema>;
/** Validated input for activating a linked next step in the selected week. */
export type PromotePlanInput = z.infer<typeof promotePlanInputSchema>;
/** Canonical item state retained in a server-owned outcome record. */
export type ItemOutcomeState = z.infer<typeof itemOutcomeStateSchema>;
/** Server-owned Won't-do resolution metadata returned with an item. */
export type ItemResolution = z.infer<typeof itemResolutionSchema>;
/** Server-owned append-only audit event returned with an item. */
export type ItemOutcomeEvent = z.infer<typeof itemOutcomeEventSchema>;
