import { z } from "zod";

/**
 * Rejects strings that contain only whitespace or zero-width characters.
 * @param val - the candidate string to test
 * @returns true when the string has at least one visible character
 */
const noInvisibleOnly = (val: string) =>
  val.replaceAll(/\s|\u200B|\u200C|\u200D|\uFEFF/gu, "").length > 0;

/**
 * Rejects strings containing null bytes (PostgreSQL incompatible).
 * @param val - the candidate string to test
 * @returns true when the string contains no null byte
 */
const noNullBytes = (val: string) => !val.includes("\u0000");

/**
 * Safe text schema: rejects null bytes and zero-width-space-only strings.
 * Use in place of z.string().min(N).max(M) for all user-facing text fields.
 * @param opts - optional length bounds for the schema
 * @param opts.min - minimum length (default 1)
 * @param opts.max - maximum length (default 500)
 * @returns a Zod string schema enforcing the bounds and content rules
 */
const DEFAULT_SAFE_TEXT_MAX_LENGTH = 500;

export const safeText = (opts: { min?: number; max?: number } = {}) =>
  z
    .string()
    .min(opts.min ?? 1)
    .max(opts.max ?? DEFAULT_SAFE_TEXT_MAX_LENGTH)
    .refine(noNullBytes, { message: "Text must not contain null bytes" })
    .refine(noInvisibleOnly, {
      message: "Text must contain visible characters",
    });

/**
 * Rejects dates before year 2000 (prevents pre-epoch/nonsensical report dates).
 * @returns a Zod date schema that coerces input and rejects pre-2000 dates
 */
const MIN_VALID_YEAR = 2000;

export const reportDate = () =>
  z.coerce.date().refine((d) => d.getFullYear() >= MIN_VALID_YEAR, {
    message: "Date must be after year 2000",
  });

export const trafficLightStatusSchema = z.enum(["green", "yellow", "red"]);
/**
 * The single source of truth for the traffic-light status value
 * (traffic-light-status-type spec). The three literals live only here;
 * consumers import this type and compose it (`| null`, `| "empty"`, …).
 */
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
 * Per-type progress vocabulary (rework-item-status-model): the enum is shared,
 * the legal subset depends on the item type. The DB CHECK restates this.
 * @param type - The item type whose vocabulary applies.
 * @param workflowStatus - The candidate stored status.
 * @param ctx - Zod refinement context receiving the issue.
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
/**
 * The single source of truth for the risk severity value: every risk is
 * explicitly `at-risk` or `blocked` — there is no third state and no default.
 */
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
 * Explicit lifecycle state for a Period/Report, superseding the implicit
 * (status × archived × periodStatus) tuple. The legacy fields stay around
 * for the one-release compatibility window — writers update both atomically.
 * Wire format mirrors the lowercase Prisma enum.
 *
 * State transitions:
 *   - PeriodCreator   : minted with `scheduled` if periodStart > now,
 *                       otherwise `open`; flips `scheduled → open` once
 *                       the period's start day is reached.
 *   - AutoPublisher   : `open → published` at deadline + grace.
 *   - AutoArchiver    : `published → archived` after the configured
 *                       autoArchiveWeeksAfterPublish window.
 *   - publish (head)  : `open → published` (also legacy
 *                       status/periodStatus writes).
 *   - reopen (head)   : `published → open` (also legacy
 *                       periodStatus='reopened').
 */
export const periodStateSchema = z.enum([
  "scheduled",
  "open",
  "published",
  "archived",
]);

// Payload guard against pathological stage selections; normal is 1–7 stages.
const MAX_SELECTED_STAGES = 20;

// SDLC stage selection persisted as a native String[] array (the Postgres
// text[] `stageNames` column on Item / Risk / Decision) — one stage name per
// element. Any comma-joined rendering is display-only (chip labels) and is NOT
// the storage format. Field is misnamed `stageIds` for legacy reasons.
// TODO(STAGE-NAMING-01): rename stageIds→stageNames (~125 sites, 28 files — deferred)
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

// require-risk-stage (D1): the strict write variant — a row must always carry
// at least one concrete SDLC stage, so missing/empty selections are rejected
// on the write path. enforce-item-decision-stage-schema extended this to items
// and decisions too; the READ models re-loosen to `stageIdsField` so stage-less
// legacy rows still load and render the loud "No stage set" marker.
export const requiredStageIdsField = z
  .array(stageNameElement)
  .min(1)
  .max(MAX_SELECTED_STAGES);

// activity-first-class: element-quality-validated like requiredStageIdsField but
// length-tolerant, for the XOR-parented record write field. The conditional rule
// (≥1 stage for a product parent, none for an activity parent) is enforced by the
// record superRefine in section.schema.ts, since it depends on the parent kind.
export const writeStageIdsField = z
  .array(stageNameElement)
  .max(MAX_SELECTED_STAGES)
  .optional();
