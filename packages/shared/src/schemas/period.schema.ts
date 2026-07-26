import { z } from "zod";

import { reminderAudienceSchema } from "../admin/reminder-policy.schema";
import { DAYS_PER_WEEK, HOURS_PER_DAY } from "../time";
import {
  periodStateSchema,
  periodStatusSchema,
  reportDate,
  reportStatusSchema,
} from "./report-primitives.schema";

const MAX_WEEK_LABEL_LENGTH = 64;
const MAX_DEFAULT_DEADLINE_DAYS = 30;
const MAX_PERIOD_LENGTH_DAYS = 31;
const DEFAULT_PERIOD_LENGTH_DAYS = DAYS_PER_WEEK;
// Cap shared by gracePeriodHours and reopenWindowHours: one week.
const ONE_WEEK_HOURS = HOURS_PER_DAY * DAYS_PER_WEEK;
const DEFAULT_GRACE_PERIOD_HOURS = HOURS_PER_DAY;
const MAX_AUTO_ARCHIVE_WEEKS_AFTER_PUBLISH = 52;
const MAX_EMAIL_LENGTH = 254; // RFC 5321 max email length
const DEFAULT_REOPEN_WINDOW_HOURS = 72; // 3 days

export const reportPeriodSchema = z.object({
  id: z.uuid(),
  periodStart: reportDate(),
  periodEnd: reportDate(),
  deadline: reportDate().nullable(),
  status: reportStatusSchema,
  /**
   * Explicit lifecycle state. Optional so pre-existing fixtures and
   * admin-snapshot payloads keep parsing — consumers that don't yet read the
   * state fall back to the legacy `status`/`archived` tuple. The Admin
   * Periods tab consumes this field directly.
   */
  periodState: periodStateSchema.optional(),
  /**
   * The rest of the governed lifecycle field set, so an admin snapshot
   * round-trips a Report's complete state (periodState + the legacy
   * status/archived tuple + periodStatus + audit flags + publish/reopen
   * timestamps) instead of silently re-introducing the divergence the
   * `period-dual-state` invariant forbids. All optional so snapshots taken
   * before this field set existed still parse and restore via the
   * documented legacy-tuple backfill (see `resolveLifecycle`).
   */
  periodStatus: periodStatusSchema.optional(),
  archived: z.boolean().optional(),
  autoPublished: z.boolean().optional(),
  autoArchived: z.boolean().optional(),
  publishedAt: z.coerce.date().nullable().optional(),
  publishedById: z.uuid().nullable().optional(),
  reopenedAt: z.coerce.date().nullable().optional(),
});

/**
 * The lifecycle filter accepted by `admin.listPeriodsByState`. The two
 * virtual buckets fan out to:
 *
 *   active  -> { scheduled, open, published-within-reopen-window }
 *   archive -> { archived, published-out-of-reopen-window }
 *
 * The exact state enum (`scheduled | open | published | archived`) is
 * also accepted so callers that already know the precise state can
 * request a single bucket without the virtual-fan-out logic.
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
 * The row shape returned by `admin.listPeriodsByState`. Carries everything
 * the redesigned admin Periods tab renders without a second round-trip:
 *
 *   - `periodState` is the source of truth for the badge color.
 *   - `submittedCount / totalCount` drives the `4/6` progress badge.
 *   - `canReopen` is server-precomputed from `allowReopenAfterPublish`
 *     + `publishedAt + reopenWindowHours` (`AppSettings`), so the
 *     UI doesn't need to know the reopen-policy rules.
 *   - `canArchive` mirrors the publish state (and skips already-archived).
 */
export const periodListItemSchema = z.object({
  id: z.uuid(),
  periodStart: reportDate(),
  periodEnd: reportDate(),
  deadline: reportDate().nullable(),
  publishedAt: z.coerce.date().nullable(),
  weekLabel: z.string().nullable().optional(),
  periodState: periodStateSchema,
  /**
   * Mirror of the legacy `periodStatus` enum
   * (`open | published | reopened`). The admin tab uses it to surface a
   * small "(reopened)" badge on top of the periodState pill so audit
   * fidelity is preserved without collapsing the two state machines.
   */
  periodStatus: periodStatusSchema,
  archived: z.boolean(),
  autoPublished: z.boolean(),
  autoArchived: z.boolean(),
  submittedCount: z.number().int().nonnegative(),
  totalCount: z.number().int().nonnegative(),
  canReopen: z.boolean(),
  canArchive: z.boolean(),
});

export type PeriodListBucket = z.infer<typeof periodListBucketSchema>;
export type PeriodListItem = z.infer<typeof periodListItemSchema>;

/**
 * Input for `admin.createPeriodManual` — admin escape hatch that
 * mints a Report row without waiting for the daily `PeriodCreatorScheduler`
 * (00:05 UTC cron). Targets two scenarios:
 *
 *   1. Fresh dev/staging DBs with zero Reports, where the only other routes
 *      to a first Report are waiting for the cron tick or hand-written SQL.
 *   2. Backfill / one-off cycles (e.g. a missed period, off-cadence ad-hoc).
 *
 * Only `periodStart` is required. `periodEnd` / `deadline` default from
 * `AppSettings` (`periodLengthDays`, `defaultDeadlineDays`,
 * `defaultTimezone`, `workingDays`, `deadlineTime`) so the typical admin
 * flow is single-field. The service computes both defaults from settings
 * — no schema-level defaulting (settings are runtime).
 */
export const adminCreatePeriodManualSchema = z.object({
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date().optional(),
  deadline: z.coerce.date().optional(),
  weekLabel: z.string().max(MAX_WEEK_LABEL_LENGTH).optional(),
});

export type AdminCreatePeriodManualInput = z.infer<
  typeof adminCreatePeriodManualSchema
>;

/**
 * Return shape of `admin.createPeriodManual`. Mirrors the
 * `PeriodCreatorScheduler.runOnce` outcome — minimal projection of the
 * newly-minted Report. The web layer invalidates `listPeriodsByState`
 * afterwards, so we don't need to return the full `PeriodListItem`.
 */
export const adminCreatePeriodManualResultSchema = z.object({
  periodId: z.uuid(),
  periodStart: reportDate(),
  periodEnd: reportDate(),
  deadline: reportDate(),
  periodState: periodStateSchema,
});

export type AdminCreatePeriodManualResult = z.infer<
  typeof adminCreatePeriodManualResultSchema
>;

/**
 * Input for `admin.updatePeriodManual` — admin escape hatch that
 * edits an existing Report's date envelope without re-running the daily
 * `PeriodCreatorScheduler`. Symmetric counterpart to `createPeriodManual`,
 * keyed on `reportId` (matches the `period.publish` / `period.reopen`
 * convention).
 *
 * All payload fields are optional: only those provided are written, so
 * partial PATCH-style edits (e.g. "shift only the deadline") are a single
 * round-trip. When dates change, the service re-runs the overlap gate —
 * excluding `reportId` from the conflict candidates so a no-op rewrite of
 * the same row is allowed.
 *
 * `weekLabel` is nullable to let the admin clear an existing label
 * (`null`) vs leave it untouched (omit the key); `optional()` on top of
 * `nullable()` keeps the distinction explicit at the wire layer.
 */
export const adminUpdatePeriodManualSchema = z.object({
  reportId: z.uuid(),
  periodStart: z.coerce.date().optional(),
  periodEnd: z.coerce.date().optional(),
  // Same three-state contract as `weekLabel`: omit = untouched, `null` =
  // explicit clear (ruling F16 — the period then has NO deadline and
  // deadline-driven automation skips it), value = set.
  deadline: z.coerce.date().nullable().optional(),
  weekLabel: z.string().max(MAX_WEEK_LABEL_LENGTH).nullable().optional(),
});

export type AdminUpdatePeriodManualInput = z.infer<
  typeof adminUpdatePeriodManualSchema
>;

/**
 * Return shape of `admin.updatePeriodManual`. Mirrors the
 * create-counterpart result so the web layer can echo the updated row
 * back into the local cache without a second round-trip (in practice we
 * invalidate `listPeriodsByState` and rely on the refetch, but the shape
 * stays parallel for consistency).
 */
export const adminUpdatePeriodManualResultSchema = z.object({
  periodId: z.uuid(),
  periodStart: reportDate(),
  periodEnd: reportDate(),
  deadline: reportDate().nullable(),
  periodState: periodStateSchema,
  weekLabel: z.string().nullable(),
});

export type AdminUpdatePeriodManualResult = z.infer<
  typeof adminUpdatePeriodManualResultSchema
>;

// ---------------------------------------------------------------------------
// App settings
// New fields carry `.default()` so older clients (and test fixtures) that
// pass the original 3-key payload still parse — the partial update schema
// also keeps working unchanged.
// ---------------------------------------------------------------------------

/**
 * Working-days enum surfaced for the AppSettings UI hint. v1 is
 * metadata-only — deadline math continues to use Mon-Fri regardless of this
 * value. The wire format is lowercase-hyphen to stay consistent with
 * `reminder-audience`; the API repository owns the wire <-> Prisma mapper.
 */
export const workingDaysSchema = z.enum(["mon-fri", "mon-sat", "mon-sun"]);

/**
 * Regex guard for the `deadlineTime` HH:MM-in-24h
 * string. Pin minutes to two digits and hours to 00..23 so the admin
 * cannot persist garbage like `"25:00"` or `"9:5"` that would later
 * break the deadline-computation path.
 */
const deadlineTimeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

export const appSettingsSchema = z.object({
  // Identity / brand strings are NOT in AppSettings — they live on the
  // `Organization` singleton (`shortName` for compact references,
  // `fullName` for headings).
  autoCreatePeriods: z.boolean(),
  defaultDeadlineDays: z.number().int().min(1).max(MAX_DEFAULT_DEADLINE_DAYS),
  // ---- Periods knobs --------------------------------------------------
  periodLengthDays: z
    .number()
    .int()
    .min(1)
    .max(MAX_PERIOD_LENGTH_DAYS)
    .default(DEFAULT_PERIOD_LENGTH_DAYS),
  workingDays: workingDaysSchema.default("mon-fri"),
  gracePeriodHours: z
    .number()
    .int()
    .min(0)
    .max(ONE_WEEK_HOURS)
    .default(DEFAULT_GRACE_PERIOD_HOURS),
  allowLateSubmissions: z.boolean().default(true),
  autoPublishAfterDeadline: z.boolean().default(false),
  autoArchiveWeeksAfterPublish: z
    .number()
    .int()
    .min(0)
    .max(MAX_AUTO_ARCHIVE_WEEKS_AFTER_PUBLISH)
    .default(0),
  // ---- Reminders knobs ------------------------------------------------
  defaultTimezone: z.string().min(1).default("Europe/Moscow"),
  defaultReminderAudience: reminderAudienceSchema.default("lead-with-draft"),
  // ---- Notifications knobs --------------------------------------------
  // Nullable email; `''` is rejected (admins can clear by sending null).
  notificationFromEmail: z
    .union([z.email().max(MAX_EMAIL_LENGTH), z.null()])
    .default(null),
  // ---- Period-cycle knobs ---------------------------------------------
  // Publish/reopen gating + manual-creation deadline default. All fields
  // below have live consumers.
  // HH:MM in the configured `defaultTimezone`. Regex pins the format so
  // garbage values cannot reach the deadline-computation path. Manual period
  // creation applies it at whole-hour precision; the auto-creation scheduler
  // currently uses a fixed 18:00.
  deadlineTime: z.string().regex(deadlineTimeRegex).default("18:00"),
  allowReopenAfterPublish: z.boolean().default(true),
  // Window after `publishedAt` during which a published report can be
  // reopened. `0..168` (one week) matches the `gracePeriodHours`
  // convention. Default `72` (3 days) chosen as a practical floor for
  // "noticed the bug on Monday, reopen Friday's report" use cases.
  reopenWindowHours: z
    .number()
    .int()
    .min(0)
    .max(ONE_WEEK_HOURS)
    .default(DEFAULT_REOPEN_WINDOW_HOURS),
  // Opt-in unified by-state lead-form view (a pure presentation projection —
  // ADR 0011). Off keeps the classic two-section format. The default mirrors
  // the DB column default; the DB row is the source of truth (no env knob).
  unifiedActivityView: z.boolean().default(false),
});

// Zod's `.partial()` makes every key optional but does NOT strip a field's
// `.default()`: parsing an update payload that omits a defaulted key still
// materializes that default, and the admin write path (which persists any
// non-`undefined` key) would then silently reset a setting the caller never
// mentioned. Strip every field's default before making the shape partial, so an
// omitted key parses to `undefined` (and is left untouched), while an explicit
// value still writes through and every field constraint still applies.
type WithoutDefaults<Shape extends z.ZodRawShape> = {
  [K in keyof Shape]: Shape[K] extends z.ZodDefault<infer Inner>
    ? Inner
    : Shape[K];
};

const withoutDefaults = <Shape extends z.ZodRawShape>(
  shape: Shape,
): WithoutDefaults<Shape> =>
  Object.fromEntries(
    Object.entries(shape).map(([key, field]) => [
      key,
      field instanceof z.ZodDefault ? field.unwrap() : field,
    ]),
  ) as WithoutDefaults<Shape>;

export const appSettingsUpdateSchema = z
  .object(withoutDefaults(appSettingsSchema.shape))
  .partial();

// ---------------------------------------------------------------------------
// Period read model (extended)
// ---------------------------------------------------------------------------

export const periodReadModelSchema = z.object({
  id: z.uuid(),
  periodStart: reportDate(),
  periodEnd: reportDate(),
  deadline: reportDate().nullable(),
  status: reportStatusSchema,
  periodStatus: periodStatusSchema,
  weekLabel: z.string().nullable(),
  publishedAt: z.coerce.date().nullable(),
  reopenedAt: z.coerce.date().nullable(),
  /**
   * Explicit lifecycle state. Optional so pre-existing fixtures still parse;
   * consumers that don't read it fall back to the legacy tuple. Read paths
   * switch to this field.
   */
  periodState: periodStateSchema.optional(),
});

export type ReportPeriod = z.infer<typeof reportPeriodSchema>;
export type AppSettings = z.infer<typeof appSettingsSchema>;
export type WorkingDays = z.infer<typeof workingDaysSchema>;
export type PeriodReadModel = z.infer<typeof periodReadModelSchema>;
