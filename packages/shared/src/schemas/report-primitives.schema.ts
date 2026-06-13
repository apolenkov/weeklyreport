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
export const safeText = (opts: { min?: number; max?: number } = {}) =>
  z
    .string()
    .min(opts.min ?? 1)
    .max(opts.max ?? 500)
    .refine(noNullBytes, { message: "Text must not contain null bytes" })
    .refine(noInvisibleOnly, {
      message: "Text must contain visible characters",
    });

/**
 * Rejects dates before year 2000 (prevents pre-epoch/nonsensical report dates).
 * @returns a Zod date schema that coerces input and rejects pre-2000 dates
 */
export const reportDate = () =>
  z.coerce.date().refine((d) => d.getFullYear() >= 2000, {
    message: "Date must be after year 2000",
  });

export const trafficLightStatusSchema = z.enum(["green", "yellow", "red"]);
export const itemTypeSchema = z.enum(["current", "next"]);
export const itemWorkflowStatusSchema = z.enum([
  "done",
  "in_progress",
  "blocked",
]);
export const riskSeveritySchema = z.enum(["at-risk", "blocked"]);
export const reportSectionStatusSchema = z.enum(["draft", "submitted"]);
export const reportStatusSchema = z.enum(["draft", "published"]);
export const periodStatusSchema = z.enum(["open", "published", "reopened"]);

/**
 * UFB-053 (Phase 51-C): explicit lifecycle state for a Period/Report.
 * Replaces the implicit (status × archived × periodStatus) tuple. The
 * legacy fields stay around for the one-release compatibility window —
 * writers update both atomically. Wire format mirrors the lowercase
 * Prisma enum.
 *
 * State transitions wired in 51-C:
 *   - PeriodCreator   : minted with `scheduled` if periodStart > now,
 *                       otherwise `open`; flips `scheduled → open` once
 *                       the period's start day is reached.
 *   - AutoPublisher   : `open → published` at deadline + grace.
 *   - AutoArchiver    : `published → archived` after the configured
 *                       autoArchiveWeeksAfterPublish window.
 *   - publish (head)  : `open → published` (also legacy
 *                       status/periodStatus writes).
 *   - reopen (head)   : `published → open` (also legacy
 *                       periodStatus='reopened' — see Open Questions in
 *                       51-C SUMMARY).
 */
export const periodStateSchema = z.enum([
  "scheduled",
  "open",
  "published",
  "archived",
]);

// Payload guard against pathological stage selections; normal is 1–7 stages.
const MAX_SELECTED_STAGES = 20;

// UFB-073 (R1): SDLC stage selection stored as array of stage NAMES (split from
// the comma-joined Risk.stageName / KanbanItem.stageName DB column on read in the
// prisma repo). Field is misnamed `stageIds` for legacy reasons — see TODO below.
// TODO(STAGE-NAMING-01): rename stageIds→stageNames (~125 sites, 28 files — deferred)
export const stageIdsField = z
  .array(z.string())
  .max(MAX_SELECTED_STAGES)
  .optional();

// require-risk-stage (D1): risk-specific variant — a risk must always carry
// at least one concrete SDLC stage, so missing/empty selections are rejected
// on the write path. Items/decisions keep the optional `stageIdsField` above
// (their empty selection means "all assigned stages" by design).
export const requiredStageIdsField = z
  .array(z.string())
  .min(1)
  .max(MAX_SELECTED_STAGES);
