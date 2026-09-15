import { z } from "zod";

// Whitespace / zero-width-only strings fail; null bytes are PostgreSQL-incompatible.
const noInvisibleOnly = (val: string) =>
  val.replaceAll(/\s|\u200B|\u200C|\u200D|\uFEFF/gu, "").length > 0;

const noNullBytes = (val: string) => !val.includes("\u0000");

/** Maximum length for report prose validated by safeText defaults. */
export const SAFE_TEXT_MAX_LENGTH = 500;

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
      message: "Text must contain visible characters",
    });

// Reject pre-2000 dates (prevents pre-epoch/nonsensical report dates).
const MIN_VALID_YEAR = 2000;

/** Zod coerced date that accepts year 2000 and later. */
export const reportDate = () =>
  z.coerce.date().refine((d) => d.getUTCFullYear() >= MIN_VALID_YEAR, {
    message: "Date must be after year 2000",
  });

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
/** Progress states accepted for current-period items. */
export const CURRENT_ITEM_STATUSES = Object.freeze([
  "planned",
  "in_progress",
  "paused",
  "postponed",
  "done",
] as const);
/** Progress states accepted for next-period items. */
export const NEXT_ITEM_STATUSES = Object.freeze([
  "planned",
  "in_progress",
  "paused",
  "postponed",
  "done",
] as const);

/** Adds a Zod issue when a workflow status is illegal for the item type. */
export function addItemTypeStatusIssue(
  type: "current" | "next",
  workflowStatus: string,
  ctx: z.RefinementCtx,
): void {
  const legal: readonly string[] =
    type === "current" ? CURRENT_ITEM_STATUSES : NEXT_ITEM_STATUSES;
  if (!legal.includes(workflowStatus)) {
    ctx.addIssue({
      code: "custom",
      path: ["workflowStatus"],
      message: `A ${type} item allows only: ${legal.join(", ")}.`,
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
// an activity parent) is enforced by the record superRefine in
// section-record.schema.ts because it depends on the parent kind.
/** Accepts a validated stage array whose cardinality is checked with its parent. */
export const writeStageNamesField = z
  .array(stageNameElement)
  .max(MAX_SELECTED_STAGES)
  .readonly()
  .optional();
