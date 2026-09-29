import { z } from "zod";

import { reminderAudienceSchema } from "../../admin/reminder-policy.schema";
import { DAYS_PER_WEEK, HOURS_PER_DAY } from "../../time";
import {
  periodStateSchema,
  periodStatusSchema,
  reportDate,
} from "../primitives/report-primitives.schema";
import { resolvableTimeZoneSchema } from "../time-zone.schema";
import { currentPeriodLifecycleSchema } from "./period-lifecycle.schema";

/** Max length of a reporting period's week label. */
export const MAX_WEEK_LABEL_LENGTH = 64;
const MAX_DEFAULT_DEADLINE_DAYS = 30;
const MAX_PERIOD_LENGTH_DAYS = 31;
// Cap shared by gracePeriodHours and reopenWindowHours: one week.
const ONE_WEEK_HOURS = HOURS_PER_DAY * DAYS_PER_WEEK;
const MAX_AUTO_ARCHIVE_WEEKS_AFTER_PUBLISH = 52;
const MAX_EMAIL_LENGTH = 254; // RFC 5321 max email length

/** Validates a reporting period with the complete dual-state lifecycle. */
export const reportPeriodSchema = currentPeriodLifecycleSchema
  .unwrap()
  .safeExtend({
    id: z.uuid(),
    periodStart: reportDate(),
    periodEnd: reportDate(),
    deadline: reportDate().nullable(),
  })
  .readonly();

/**
 * Lifecycle filter for exact states plus the policy-derived active and archive buckets.
 */
export const periodListBucketSchema = z.enum([
  "active",
  "archive",
  "scheduled",
  "open",
  "published",
  "archived",
]);

/**
 * Admin period row with server-derived lifecycle actions and submission counts.
 */
export const periodListItemSchema = z
  .object({
    id: z.uuid(),
    periodStart: reportDate(),
    periodEnd: reportDate(),
    deadline: reportDate().nullable(),
    publishedAt: z.coerce.date().nullable(),
    weekLabel: z.string().nullable().optional(),
    periodState: periodStateSchema,
    // Reopen status remains independent from the archive lifecycle state.
    periodStatus: periodStatusSchema,
    archived: z.boolean(),
    autoPublished: z.boolean(),
    autoArchived: z.boolean(),
    submittedCount: z.number().int().nonnegative(),
    totalCount: z.number().int().nonnegative(),
    canReopen: z.boolean(),
    canArchive: z.boolean(),
  })
  .readonly();

/** Validated exact or policy-derived admin period-list bucket. */
export type PeriodListBucket = z.infer<typeof periodListBucketSchema>;
/** Validated admin period row with derived action gates. */
export type PeriodListItem = z.infer<typeof periodListItemSchema>;

/**
 * Manual period creation input; omitted dates are derived from current period policy.
 */
export const adminCreatePeriodManualSchema = z
  .object({
    periodStart: z.coerce.date(),
    periodEnd: z.coerce.date().optional(),
    deadline: z.coerce.date().optional(),
    weekLabel: z.string().max(MAX_WEEK_LABEL_LENGTH).optional(),
  })
  .readonly();

/** Dates omitted from manual creation are derived from active organization policy. */
export type AdminCreatePeriodManualInput = z.infer<
  typeof adminCreatePeriodManualSchema
>;

/**
 * Minimal identity and lifecycle projection returned after manual creation.
 */
export const adminCreatePeriodManualResultSchema = z
  .object({
    periodId: z.uuid(),
    periodStart: reportDate(),
    periodEnd: reportDate(),
    deadline: reportDate(),
    periodState: periodStateSchema,
  })
  .readonly();

/** New period identity plus the lifecycle state selected at creation. */
export type AdminCreatePeriodManualResult = z.infer<
  typeof adminCreatePeriodManualResultSchema
>;

/**
 * Partial manual period update; omitted fields stay unchanged and null clears nullable values.
 */
export const adminUpdatePeriodManualSchema = z
  .object({
    reportId: z.uuid(),
    periodStart: z.coerce.date().optional(),
    periodEnd: z.coerce.date().optional(),
    // A cleared deadline disables deadline-driven automation for the period.
    deadline: z.coerce.date().nullable().optional(),
    weekLabel: z.string().max(MAX_WEEK_LABEL_LENGTH).nullable().optional(),
  })
  .readonly();

/** PATCH-style period update: omission preserves a field and null clears nullable fields. */
export type AdminUpdatePeriodManualInput = z.infer<
  typeof adminUpdatePeriodManualSchema
>;

/**
 * Minimal identity and lifecycle projection returned after manual update.
 */
export const adminUpdatePeriodManualResultSchema = z
  .object({
    periodId: z.uuid(),
    periodStart: reportDate(),
    periodEnd: reportDate(),
    deadline: reportDate().nullable(),
    periodState: periodStateSchema,
    weekLabel: z.string().nullable(),
  })
  .readonly();

/** Updated period identity, date envelope, lifecycle state, and nullable label/deadline. */
export type AdminUpdatePeriodManualResult = z.infer<
  typeof adminUpdatePeriodManualResultSchema
>;

/** Supported work-week policies used by deadline calculations. */
const workingDaysSchema = z.enum(["mon-fri", "mon-sat", "mon-sun"]);

/**
 * Regex guard for the `deadlineTime` HH:MM-in-24h
 * string. Pin minutes to two digits and hours to 00..23 so the admin
 * cannot persist garbage like `"25:00"` or `"9:5"` that would later
 * break the deadline-computation path.
 */
const deadlineTimeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const appSettingsObjectSchema = z.object({
  // Identity / brand strings are NOT in AppSettings — they live on the
  // `Organization` singleton (`shortName` for compact references,
  // `fullName` for headings).
  autoCreatePeriods: z.boolean(),
  defaultDeadlineDays: z.number().int().min(1).max(MAX_DEFAULT_DEADLINE_DAYS),
  // ---- Periods knobs --------------------------------------------------
  periodLengthDays: z.number().int().min(1).max(MAX_PERIOD_LENGTH_DAYS),
  workingDays: workingDaysSchema,
  gracePeriodHours: z.number().int().min(0).max(ONE_WEEK_HOURS),
  allowLateSubmissions: z.boolean(),
  autoPublishAfterDeadline: z.boolean(),
  autoArchiveWeeksAfterPublish: z
    .number()
    .int()
    .min(0)
    .max(MAX_AUTO_ARCHIVE_WEEKS_AFTER_PUBLISH),
  // ---- Reminders knobs ------------------------------------------------
  defaultTimezone: resolvableTimeZoneSchema,
  defaultReminderAudience: reminderAudienceSchema,
  // ---- Notifications knobs --------------------------------------------
  // Nullable email; `''` is rejected (admins can clear by sending null).
  notificationFromEmail: z.union([z.email().max(MAX_EMAIL_LENGTH), z.null()]),
  // ---- Period-cycle knobs ---------------------------------------------
  // Publish/reopen gating + period-creation deadline default. All fields
  // below have live consumers.
  // HH:MM in the configured `defaultTimezone`. Regex pins the format so
  // garbage values cannot reach the shared manual/automatic deadline path.
  deadlineTime: z.string().regex(deadlineTimeRegex),
  allowReopenAfterPublish: z.boolean(),
  // Window after `publishedAt` during which a published report can be
  // reopened. `0..168` (one week) matches the `gracePeriodHours`
  // convention. Default `72` (3 days) chosen as a practical floor for
  // "noticed the bug on Monday, reopen Friday's report" use cases.
  reopenWindowHours: z.number().int().min(0).max(ONE_WEEK_HOURS),
  // This presentation choice is persisted in the DB; no environment value may
  // override it.
  unifiedActivityView: z.boolean(),
});

/** Validates organization-wide reporting-period policy and automation settings. */
export const appSettingsSchema = appSettingsObjectSchema.readonly();

/** Validates a partial reporting-period policy update. */
export const appSettingsUpdateSchema = appSettingsObjectSchema
  .partial()
  .readonly();

/** Validated reporting period with complete lifecycle state. */
export type ReportPeriod = z.infer<typeof reportPeriodSchema>;
/** Complete organization policy consumed by period and reminder automation. */
export type AppSettings = z.infer<typeof appSettingsSchema>;
/** Work-week calendar admitted by deadline calculation. */
export type WorkingDays = z.infer<typeof workingDaysSchema>;
