import { z } from "zod";

// Whitespace / zero-width-only strings fail; null bytes are PostgreSQL-incompatible.
const noInvisibleOnly = (val: string) =>
  val.replaceAll(/\s|\u200B|\u200C|\u200D|\uFEFF/gu, "").length > 0;

const noNullBytes = (val: string) => !val.includes("\u0000");

/** Maximum length for report prose validated by safeText defaults. */
export const SAFE_TEXT_MAX_LENGTH = 500;

/** Validation message shared with consumers that classify invisible text. */
export const INVISIBLE_TEXT_MESSAGE = "Text must contain visible characters";

/** Zod string for user-facing text: rejects null bytes and invisible-only values. */
export const safeText = (
  opts: { readonly min?: number; readonly max?: number } = {},
) =>
  z
    .string()
    .min(opts.min ?? 1)
    .max(opts.max ?? SAFE_TEXT_MAX_LENGTH)
    .refine(noNullBytes, { message: "Text must not contain null bytes" })
    .refine(noInvisibleOnly, {
      message: INVISIBLE_TEXT_MESSAGE,
    });

// Reject pre-2000 dates (prevents pre-epoch/nonsensical report dates).
const MIN_VALID_YEAR = 2000;

/** Zod coerced date that accepts year 2000 and later. */
export const reportDate = () =>
  z.coerce.date().refine((d) => d.getUTCFullYear() >= MIN_VALID_YEAR, {
    message: "Date must be in year 2000 or later",
  });

/** True when a period ends before it starts; equal dates are a valid one-day period. */
export const isPeriodInverted = (period: {
  readonly periodStart: Date;
  readonly periodEnd: Date;
}): boolean => period.periodEnd.getTime() < period.periodStart.getTime();

/** Defines the traffic-light values shared by report status surfaces. */
export const trafficLightStatusSchema = z.enum(["green", "yellow", "red"]);
/** Traffic-light value shared by report status surfaces. */
export type TrafficLightStatus = z.infer<typeof trafficLightStatusSchema>;
/** Defines whether an item belongs to current work or next-period plans. */
export const itemTypeSchema = z.enum(["current", "next"]);
// Progress only — alarms (at-risk/blocked) derive from covering risks and are
// never stored on an item. Week placement and progress are independent.
/** Defines the progress states valid across both item types. */
export const itemWorkflowStatusSchema = z.enum([
  "planned",
  "in_progress",
  "paused",
  "postponed",
  "done",
]);
/** Progress state stored on a report item. */
export type ItemWorkflowStatus = z.infer<typeof itemWorkflowStatusSchema>;

/** Adds a Zod issue when a pause reason is missing on a paused item or kept on any other status. */
export function addPausedReasonIssues(
  value: {
    readonly workflowStatus: string;
    readonly pausedReason?: string | null | undefined;
  },
  ctx: z.RefinementCtx,
): void {
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
}

/** Adds a Zod issue when a next-period commitment sits on finished or next-period work. */
export function addNextStepTextIssue(
  value: {
    readonly type: "current" | "next";
    readonly workflowStatus: string;
    readonly nextStepText?: string | null | undefined;
  },
  ctx: z.RefinementCtx,
): void {
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
}
/** Defines the alarm severities that a risk can impose on covered work. */
export const riskSeveritySchema = z.enum(["at-risk", "blocked"]);
/** Alarm severity imposed by a report risk. */
export type RiskSeverity = z.infer<typeof riskSeveritySchema>;
/** Defines the editable and submitted states of a lead section. */
export const reportSectionStatusSchema = z.enum(["draft", "submitted"]);
/**
 * The single source of truth for the report-section status value. The two
 * literals live only here; consumers import this type.
 */
export type ReportSectionStatus = z.infer<typeof reportSectionStatusSchema>;
/** Defines the publication states stored on a report. */
export const reportStatusSchema = z.enum(["draft", "published"]);
/**
 * The single source of truth for the report status value (report-status-type
 * spec). The two literals live only here; consumers import this type.
 */
export type ReportStatus = z.infer<typeof reportStatusSchema>;
/** Defines the lifecycle status stored on a reporting period. */
export const periodStatusSchema = z.enum(["open", "published", "reopened"]);

/**
 * Explicit lifecycle state; writers must also update the companion lifecycle fields atomically.
 * Transitions: `openspec/specs/period-dual-state`.
 */
export const periodStateSchema = z.enum([
  "scheduled",
  "open",
  "published",
  "archived",
]);

// Payload guard against pathological stage selections; normal is 1–7 stages.
const MAX_SELECTED_STAGES = 20;

const stageNameElement = z
  .string()
  .min(1)
  .refine(noNullBytes, { message: "Stage must not contain null bytes" })
  .refine(noInvisibleOnly, {
    message: "Stage must contain visible characters",
  });

/** Current read models always expose structured stage names; activity rows use []. */
export const currentStageNamesField = z
  .array(stageNameElement)
  .max(MAX_SELECTED_STAGES)
  .readonly();

// The conditional rule (at least one stage for a product parent and none for
// an activity parent) is enforced by addParentStageIssues below because it
// depends on the parent kind.
/** Accepts a validated stage array whose cardinality is checked with its parent. */
export const writeStageNamesField = z
  .array(stageNameElement)
  .max(MAX_SELECTED_STAGES)
  .readonly()
  .optional();

/**
 * Adds a Zod issue unless the record has exactly one parent — a product
 * (projectId/productId per productPath) or an activity — and reports whether
 * the XOR held.
 */
export function addParentXorIssue(
  productId: string | null | undefined,
  activityId: string | null | undefined,
  productPath: "projectId" | "productId",
  ctx: z.RefinementCtx,
): boolean {
  const hasProduct = productId != null;
  const hasActivity = activityId != null;
  if (hasProduct !== hasActivity) {
    return true;
  }
  ctx.addIssue({
    code: "custom",
    path: [hasActivity ? "activityId" : productPath],
    message:
      "A record must have exactly one parent — a product or an activity.",
  });
  return false;
}

/**
 * Adds Zod issues for the stage cardinality implied by the record's parent
 * kind: a product parent requires at least one stage, an activity parent none.
 */
export function addParentStageIssues(
  productId: string | null | undefined,
  activityId: string | null | undefined,
  stageCount: number,
  ctx: z.RefinementCtx,
): void {
  if (productId != null && stageCount === 0) {
    ctx.addIssue({
      code: "custom",
      path: ["stageNames"],
      message: "A product-parented record requires at least one stage.",
    });
  }
  if (activityId != null && stageCount > 0) {
    ctx.addIssue({
      code: "custom",
      path: ["stageNames"],
      message: "An activity-parented record must not carry a stage.",
    });
  }
}
