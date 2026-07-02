import { z } from "zod";

import {
  periodStateSchema,
  periodStatusSchema,
  reportDate,
  reportStatusSchema,
} from "./report-primitives.schema";

export const reportPeriodSchema = z.object({
  id: z.uuid(),
  periodStart: reportDate(),
  periodEnd: reportDate(),
  deadline: reportDate(),
  status: reportStatusSchema,
  /**
   * UFB-053 (Phase 51-C): explicit lifecycle state. Optional so pre-51-C
   * fixtures and admin-snapshot payloads keep parsing — consumers that
   * don't yet read the state fall back to the legacy `status`/`archived`
   * tuple. 51-B Admin Periods tab consumes this field directly.
   */
  periodState: periodStateSchema.optional(),
  /**
   * fix-snapshot-lifecycle-restore: the rest of the governed lifecycle
   * field set, so an admin snapshot round-trips a Report's complete state
   * (periodState + the legacy status/archived tuple + periodStatus + audit
   * flags + publish/reopen timestamps) instead of silently re-introducing
   * the divergence the `period-dual-state` invariant forbids. All optional
   * so snapshots taken before this field set existed still parse and restore
   * via the documented legacy-tuple backfill (see `resolveLifecycle`).
   */
  periodStatus: periodStatusSchema.optional(),
  archived: z.boolean().optional(),
  autoPublished: z.boolean().optional(),
  autoArchived: z.boolean().optional(),
  publishedAt: z.coerce.date().nullable().optional(),
  publishedById: z.string().nullable().optional(),
  reopenedAt: z.coerce.date().nullable().optional(),
});

/**
 * UFB-052 (Phase 51-B): the lifecycle filter accepted by
 * `admin.listPeriodsByState`. The two virtual buckets fan out to:
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
 * UFB-052 (Phase 51-B): the row shape returned by
 * `admin.listPeriodsByState`. Carries everything the redesigned admin
 * Periods tab renders without a second round-trip:
 *
 *   - `periodState` is the source of truth for the badge color.
 *   - `submittedCount / totalCount` drives the `4/6` progress badge.
 *   - `canReopen` is server-precomputed from `allowReopenAfterPublish`
 *     + `publishedAt + reopenWindowHours` (51-A `AppSettings`), so the
 *     UI doesn't need to know the reopen-policy rules.
 *   - `canArchive` mirrors the publish state (and skips already-archived).
 */
export const periodListItemSchema = z.object({
  id: z.uuid(),
  periodStart: reportDate(),
  periodEnd: reportDate(),
  deadline: reportDate(),
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
 * UFB-063: input for `admin.createPeriodManual` — admin escape hatch that
 * mints a Report row without waiting for the daily `PeriodCreatorScheduler`
 * (00:05 UTC cron). Targets two scenarios:
 *
 *   1. Fresh dev/staging DBs with zero Reports: admins were previously
 *      blocked until the next cron tick or had to INSERT SQL manually.
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
  weekLabel: z.string().max(64).optional(),
});

export type AdminCreatePeriodManualInput = z.infer<
  typeof adminCreatePeriodManualSchema
>;

/**
 * UFB-063: return shape of `admin.createPeriodManual`. Mirrors the
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
 * UFB-067: input for `admin.updatePeriodManual` — admin escape hatch that
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
  deadline: z.coerce.date().optional(),
  weekLabel: z.string().max(64).nullable().optional(),
});

export type AdminUpdatePeriodManualInput = z.infer<
  typeof adminUpdatePeriodManualSchema
>;

/**
 * UFB-067: return shape of `admin.updatePeriodManual`. Mirrors the
 * create-counterpart result so the web layer can echo the updated row
 * back into the local cache without a second round-trip (in practice we
 * invalidate `listPeriodsByState` and rely on the refetch, but the shape
 * stays parallel for consistency).
 */
export const adminUpdatePeriodManualResultSchema = z.object({
  periodId: z.uuid(),
  periodStart: reportDate(),
  periodEnd: reportDate(),
  deadline: reportDate(),
  periodState: periodStateSchema,
  weekLabel: z.string().nullable(),
});

export type AdminUpdatePeriodManualResult = z.infer<
  typeof adminUpdatePeriodManualResultSchema
>;

// ---------------------------------------------------------------------------
// v4.0: App settings (D-68)
// UFB-048 (Phase 48-B): expanded with 9 org-wide configurable knobs. All new
// fields carry `.default()` so older clients (and pre-48-B test fixtures)
// that pass the original 3-key payload still parse — the partial update
// schema also keeps working unchanged.
// ---------------------------------------------------------------------------

/**
 * UFB-048: working-days enum surfaced for the AppSettings UI hint. v1 is
 * metadata-only — deadline math continues to use Mon-Fri regardless of this
 * value. The wire format is lowercase-hyphen to stay consistent with
 * `reminder-audience`; the API repository owns the wire <-> Prisma mapper.
 */
export const workingDaysSchema = z.enum(["mon-fri", "mon-sat", "mon-sun"]);

export const reminderAudienceWireSchema = z.enum([
  "lead-with-draft",
  "head-of-late",
]);

/**
 * UFB-051 (Phase 51-A): regex guard for the `deadlineTime` HH:MM-in-24h
 * string. Pin minutes to two digits and hours to 00..23 so the admin
 * cannot persist garbage like `"25:00"` or `"9:5"` that would later
 * break the deadline-computation path (51-C consumer).
 */
const deadlineTimeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

export const appSettingsSchema = z.object({
  // UFB-047 / Phase 49-01: `departmentName` removed from AppSettings.
  // Identity / brand strings live on the `Organization` singleton
  // (`shortName` for compact references, `fullName` for headings).
  autoCreatePeriods: z.boolean(),
  defaultDeadlineDays: z.number().int().min(1).max(30),
  // ---- UFB-048: Periods knobs -----------------------------------------
  periodLengthDays: z.number().int().min(1).max(31).default(7),
  workingDays: workingDaysSchema.default("mon-fri"),
  gracePeriodHours: z.number().int().min(0).max(168).default(24),
  allowLateSubmissions: z.boolean().default(true),
  autoPublishAfterDeadline: z.boolean().default(false),
  autoArchiveWeeksAfterPublish: z.number().int().min(0).max(52).default(0),
  // ---- UFB-048: Reminders knobs ---------------------------------------
  defaultTimezone: z.string().min(1).default("Europe/Moscow"),
  defaultReminderAudience:
    reminderAudienceWireSchema.default("lead-with-draft"),
  // ---- UFB-048: Notifications knobs -----------------------------------
  // Nullable email; `''` is rejected (admins can clear by sending null).
  notificationFromEmail: z.union([z.email().max(254), z.null()]).default(null),
  // ---- UFB-051 (Phase 51-A): Period-cycle knobs -----------------------
  // Publish/reopen gating + manual-creation deadline default. The four
  // consumer-less knobs (firstDayOfWeek, deadlineDayOfWeek, maxOpenPeriods,
  // requireAllSectionsToPublish) were removed in admin-settings-surface-cleanup
  // — nothing read them. The fields below all have live consumers.
  // HH:MM in the configured `defaultTimezone`. Regex pins the format so
  // garbage values cannot reach the deadline-computation path. Manual period
  // creation applies it at whole-hour precision; the auto-creation scheduler
  // currently uses a fixed 18:00.
  deadlineTime: z.string().regex(deadlineTimeRegex).default("18:00"),
  allowReopenAfterPublish: z.boolean().default(true),
  // Window after `publishedAt` during which a published report can be
  // reopened. `0..168` (one week) matches the 48-B `gracePeriodHours`
  // convention. Default `72` (3 days) chosen as a practical floor for
  // "noticed the bug on Monday, reopen Friday's report" use cases.
  reopenWindowHours: z.number().int().min(0).max(168).default(72),
  // Opt-in unified by-state lead-form view (a pure presentation projection —
  // ADR 0011). Off keeps the classic two-section format. The default mirrors
  // the DB column default; the DB row is the source of truth (no env knob).
  unifiedActivityView: z.boolean().default(false),
});

// Zod 4's `.partial()` makes every key optional but does NOT strip a field's
// `.default()`: parsing an update payload that omits `unifiedActivityView`
// still materializes `false`, and the admin write path (which persists any
// non-`undefined` key) would then silently reset a department that had turned
// the view on. Re-declare it as a bare optional so an omitted key stays absent
// on the parsed output; an explicit `true`/`false` still writes through. The
// other defaulted fields share this hazard but are pre-existing and out of
// this change's scope.
export const appSettingsUpdateSchema = appSettingsSchema.partial().extend({
  unifiedActivityView: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// v4.0: Period read model (extended)
// ---------------------------------------------------------------------------

export const periodReadModelSchema = z.object({
  id: z.uuid(),
  periodStart: reportDate(),
  periodEnd: reportDate(),
  deadline: reportDate(),
  status: reportStatusSchema,
  periodStatus: periodStatusSchema,
  weekLabel: z.string().nullable(),
  publishedAt: z.coerce.date().nullable(),
  reopenedAt: z.coerce.date().nullable(),
  /**
   * UFB-053 (Phase 51-C): explicit lifecycle state. Optional so pre-51-C
   * fixtures still parse; consumers that don't read it fall back to the
   * legacy tuple. Read paths in 51-B switch to this field.
   */
  periodState: periodStateSchema.optional(),
});

export type ReportPeriod = z.infer<typeof reportPeriodSchema>;
export type AppSettings = z.infer<typeof appSettingsSchema>;
export type WorkingDays = z.infer<typeof workingDaysSchema>;
export type PeriodReadModel = z.infer<typeof periodReadModelSchema>;
