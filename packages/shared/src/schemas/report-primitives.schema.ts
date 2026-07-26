import { z } from "zod";

// Whitespace / zero-width-only strings fail; null bytes are PostgreSQL-incompatible.
const noInvisibleOnly = (val: string) =>
  val.replaceAll(/\s|\u200B|\u200C|\u200D|\uFEFF/gu, "").length > 0;

const noNullBytes = (val: string) => !val.includes("\u0000");

const DEFAULT_SAFE_TEXT_MAX_LENGTH = 500;

/** Zod string for user-facing text: rejects null bytes and invisible-only values. */
export const safeText = (opts: { min?: number; max?: number } = {}) =>
  z
    .string()
    .min(opts.min ?? 1)
    .max(opts.max ?? DEFAULT_SAFE_TEXT_MAX_LENGTH)
    .refine(noNullBytes, { message: "Text must not contain null bytes" })
    .refine(noInvisibleOnly, {
      message: "Text must contain visible characters",
    });

// Reject pre-2000 dates (prevents pre-epoch/nonsensical report dates).
const MIN_VALID_YEAR = 2000;

/** Zod coerced date that rejects years before 2000. */
export const reportDate = () =>
  z.coerce.date().refine((d) => d.getFullYear() >= MIN_VALID_YEAR, {
    message: "Date must be after year 2000",
  });

export const trafficLightStatusSchema = z.enum(["green", "yellow", "red"]);
export type TrafficLightStatus = z.infer<typeof trafficLightStatusSchema>;
export const itemTypeSchema = z.enum(["current", "next"]);
// Progress only — alarms (at-risk/blocked) derive from covering risks and are
// never stored on an item. Per-type vocabulary below; the write superRefine in
// section.schema.ts enforces it (DB CHECK is the defence-in-depth backstop).
export const itemWorkflowStatusSchema = z.enum([
  "planned",
  "in_progress",
  "paused",
  "postponed",
  "done",
]);
export const CURRENT_ITEM_STATUSES = ["in_progress", "paused", "done"] as const;
export const NEXT_ITEM_STATUSES = ["planned", "postponed"] as const;

/**
 * Adds a Zod issue when workflowStatus is illegal for the item type.
 * @param type - Selects the legal vocabulary: current vs next.
 * @param workflowStatus - The candidate value to check against it.
 * @param ctx - Refinement context the issue is reported on.
 */
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
export const riskSeveritySchema = z.enum(["at-risk", "blocked"]);
export type RiskSeverity = z.infer<typeof riskSeveritySchema>;
export const reportSectionStatusSchema = z.enum(["draft", "submitted"]);
/**
 * The single source of truth for the report-section status value. The two
 * literals live only here; consumers import this type.
 */
export type ReportSectionStatus = z.infer<typeof reportSectionStatusSchema>;
export const reportStatusSchema = z.enum(["draft", "published"]);
/**
 * The single source of truth for the report status value (report-status-type
 * spec). The two literals live only here; consumers import this type.
 */
export type ReportStatus = z.infer<typeof reportStatusSchema>;
export const periodStatusSchema = z.enum(["open", "published", "reopened"]);

/**
 * Explicit lifecycle state for a Period/Report (values mirror the lowercase
 * Prisma enum), superseding the implicit (status × archived × periodStatus)
 * tuple; writers must still update the legacy fields atomically.
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

// Stage NAMES, one per element, persisted as the Postgres text[] `stageNames`
// column on Item / Risk / Decision. Comma-joined rendering is display-only.
// TODO(STAGE-NAMING-01): rename stageIds→stageNames.
export const stageIdsField = z
  .array(z.string())
  .max(MAX_SELECTED_STAGES)
  .optional();

const stageNameElement = z
  .string()
  .min(1)
  .refine(noNullBytes, { message: "Stage must not contain null bytes" })
  .refine(noInvisibleOnly, {
    message: "Stage must contain visible characters",
  });

// Strict write variant: every written row must carry at least one concrete
// SDLC stage. Read models re-loosen to `stageIdsField` so stage-less legacy
// rows still load and render the loud "No stage set" marker.
export const requiredStageIdsField = z
  .array(stageNameElement)
  .min(1)
  .max(MAX_SELECTED_STAGES);

// Element-quality-validated like requiredStageIdsField but length-tolerant, for
// the XOR-parented record write field. The conditional rule (≥1 stage for a
// product parent, none for an activity parent) is enforced by the record
// superRefine in section.schema.ts, since it depends on the parent kind.
export const writeStageIdsField = z
  .array(stageNameElement)
  .max(MAX_SELECTED_STAGES)
  .optional();
