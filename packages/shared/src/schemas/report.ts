import { z } from "zod";

import { reminderPolicySchema } from "../admin/reminder-policy.schema";
import { roleSchema } from "./auth";

/** Rejects strings that contain only whitespace or zero-width characters */
const noInvisibleOnly = (val: string) =>
  val.replace(/[\s\u200B\u200C\u200D\uFEFF]/g, "").length > 0;

/** Rejects strings containing null bytes (PostgreSQL incompatible) */
const noNullBytes = (val: string) => !val.includes("\u0000");

/**
 * Safe text schema: rejects null bytes and zero-width-space-only strings.
 * Use in place of z.string().min(N).max(M) for all user-facing text fields.
 */
const safeText = (opts: { min?: number; max?: number } = {}) =>
  z
    .string()
    .min(opts.min ?? 1)
    .max(opts.max ?? 500)
    .refine(noNullBytes, { message: "Text must not contain null bytes" })
    .refine(noInvisibleOnly, {
      message: "Text must contain visible characters",
    });

/** Rejects dates before year 2000 (prevents pre-epoch/nonsensical report dates) */
const reportDate = () =>
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

export const projectStatusInputSchema = z.object({
  projectId: z.string().uuid(),
  status: trafficLightStatusSchema.optional(),
});

export const stageStatusInputSchema = z.object({
  projectId: z.string().uuid(),
  stageId: z.string().uuid(),
  status: trafficLightStatusSchema.nullable().optional(),
});

// UFB-073 (R1): SDLC stage selection stored as array of stage NAMES (split from
// the comma-joined Risk.stageName / KanbanItem.stageName DB column on read in the
// prisma repo). Field is misnamed `stageIds` for legacy reasons — see TODO below.
// max(20) guards against pathological payloads; normal is 1–7 stages.
// TODO(STAGE-NAMING-01): rename stageIds→stageNames (~125 sites, 28 files — deferred)
const stageIdsField = z.array(z.string()).max(20).optional();

export const itemInputSchema = z.object({
  id: z.string().uuid().optional(),
  projectId: z.string().uuid(),
  type: itemTypeSchema,
  text: safeText({ max: 500 }),
  tag: safeText({ max: 50 }),
  workflowStatus: itemWorkflowStatusSchema,
  carriedOver: z.boolean().default(false),
  completed: z.boolean().nullable().optional(),
  priorityRank: z.number().int().min(1).nullable().optional(),
  stageIds: stageIdsField,
});

export const riskInputSchema = z.object({
  id: z.string().uuid().optional(),
  projectId: z.string().uuid(),
  risk: safeText({ max: 500 }),
  impact: safeText({ max: 500 }),
  mitigation: safeText({ max: 500 }),
  severity: riskSeveritySchema.optional(),
  stageIds: stageIdsField,
});

export const decisionInputSchema = z.object({
  id: z.string().uuid().optional(),
  text: safeText({ max: 500 }),
  owner: safeText({ max: 200 }),
  deadline: z.coerce.date().nullable().optional(),
  impact: safeText({ max: 500 }),
  resolvedAt: z.coerce.date().nullable().optional(),
  stageIds: stageIdsField,
  productId: z.string().uuid().nullable().optional(),
});

export const draftSaveSchema = z.object({
  reportSectionId: z.string().uuid(),
  status: reportSectionStatusSchema.default("draft"),
  projectStatuses: z.array(projectStatusInputSchema),
  stageStatuses: z.array(stageStatusInputSchema).default([]),
  items: z.array(itemInputSchema).max(100),
  risks: z.array(riskInputSchema).max(100),
  decisions: z.array(decisionInputSchema).max(100),
});

export const submitSectionSchema = draftSaveSchema.extend({
  confirmed: z.literal(true),
  projectStatuses: z
    .array(
      projectStatusInputSchema.extend({
        status: trafficLightStatusSchema,
      }),
    )
    .min(1),
});

// 35-04: per-project list of stages owned by the section author on this
// project. Sourced from `StageAssignment` rows scoped by (projectId,
// userId=author). Empty array == author has no stake on this project,
// in which case the lead-form renders the project's stages as
// `unassigned` chips with assignee=null.
export const ownedStageSchema = z.object({
  stageId: z.string().uuid(),
  stageName: z.string().min(1),
  sortOrder: z.number().int().min(0),
  status: trafficLightStatusSchema.nullable().optional(),
});

export const projectReadModelSchema = z.object({
  projectId: z.string().uuid(),
  projectName: z.string().min(1),
  trafficLight: trafficLightStatusSchema.nullable(),
  /**
   * Stages this project's section author owns via `StageAssignment`. The
   * lead-form renders the standard 7-stage grid and marks each stage as
   * "mine" iff its name matches one of these. Optional so existing
   * fixtures and contract-test factories that pre-date 35-04 still
   * type-check; missing -> empty array means "no stake on this project"
   * which the lead-form mapper handles symmetrically.
   */
  ownedStages: z.array(ownedStageSchema).optional(),
});

// 35-03: role label of the section author, surfaced end-to-end so the
// /lead/report chrome can switch between "Request Reopen" (lead-on-own-
// section) and "Revoke" (head/admin viewing someone else's section).
// Optional so legacy fixtures continue to parse — consumers that gate
// on the role default to `'lead'` when missing.
export const reportSectionReadModelSchema = z.object({
  reportSectionId: z.string().uuid(),
  reportId: z.string().uuid(),
  authorId: z.string().uuid(),
  authorName: z.string().min(1),
  authorRole: roleSchema.optional(),
  // UFB-047 / Phase 49-01: `departmentName` removed. Consumers that
  // need a brand label now read it from the per-request session
  // (`auth.me.organization.shortName` / `.fullName`) — the section
  // read-model no longer carries a redundant per-section copy.
  status: reportSectionStatusSchema,
  submittedAt: z.coerce.date().nullable(),
  // UFB-049 / Phase 50-B: stamped true by submitSection when
  // `now > Report.deadline` at submit-time (regardless of grace). Drives
  // a "late" badge on the head dashboard + lead form. Optional in the
  // inferred TS type so legacy fixtures + Phase 35+ test payloads that
  // pre-date 50-B still construct ReportSectionReadModel without
  // breaking. Consumers treat `late === true` only — undefined/false
  // both mean "on time".
  late: z.boolean().optional(),
  projects: z.array(projectReadModelSchema),
  items: z.array(itemInputSchema),
  risks: z.array(riskInputSchema),
  decisions: z.array(decisionInputSchema),
});

export const submissionDashboardRowSchema = z.object({
  leadId: z.string().uuid(),
  leadName: z.string().min(1),
  role: roleSchema,
  projectNames: z.array(z.string().min(1)),
  status: reportSectionStatusSchema,
  submittedAt: z.coerce.date().nullable(),
});

/**
 * UX-18 (Phase 35-08): row shape for the head/admin "Активность за текущий
 * период" panel. One row per lead's section in the open report period;
 * `lastEditAt` is the most-recent updatedAt across the section's rows
 * (items + risks + decisions). Polled every 15s on the
 * dashboard.
 */
export const activityLiveRowSchema = z.object({
  reportId: z.string().uuid(),
  reportSectionId: z.string().uuid().nullable(),
  leadId: z.string().uuid(),
  leadName: z.string().min(1),
  email: z.string().email(),
  status: reportSectionStatusSchema,
  itemCount: z.number().int().min(0),
  riskCount: z.number().int().min(0),
  decisionCount: z.number().int().min(0),
  priorityCount: z.number().int().min(0),
  lastEditAt: z.coerce.date().nullable(),
  submittedAt: z.coerce.date().nullable(),
});

export type ActivityLiveRow = z.infer<typeof activityLiveRowSchema>;

export const activityLiveResponseSchema = z.object({
  reportId: z.string().uuid().nullable(),
  periodStart: reportDate().nullable(),
  periodEnd: reportDate().nullable(),
  periodStatus: periodStatusSchema.nullable(),
  rows: z.array(activityLiveRowSchema),
});

export type ActivityLiveResponse = z.infer<typeof activityLiveResponseSchema>;

export const portfolioOverviewSchema = z.object({
  status: trafficLightStatusSchema,
  totals: z.object({
    green: z.number().int().min(0),
    yellow: z.number().int().min(0),
    red: z.number().int().min(0),
  }),
});

export const assembledReportSchema = z.object({
  reportId: z.string().uuid(),
  periodStart: reportDate(),
  periodEnd: reportDate(),
  deadline: reportDate(),
  status: reportStatusSchema,
  publishedAt: z.coerce.date().nullable().default(null),
  publishedById: z.string().uuid().nullable().default(null),
  publishedByName: z.string().min(1).nullable().default(null),
  portfolioOverview: portfolioOverviewSchema,
  sections: z.array(reportSectionReadModelSchema),
});

export const pdfExportStatusSchema = z.enum([
  "queued",
  "processing",
  "completed",
  "failed",
]);

export const pdfExportRequestSchema = z.object({
  reportId: z.string().uuid(),
});

export const pdfExportJobSchema = z.object({
  jobId: z.string().uuid(),
  reportId: z.string().uuid(),
  status: pdfExportStatusSchema,
  requestedAt: z.coerce.date(),
  completedAt: z.coerce.date().nullable(),
  checksum: z.string().nullable(),
  templateVersion: z.string().min(1),
  artifactUrl: z.string().min(1).nullable(),
});

export const adminUserSchema = z.object({
  id: z.string().uuid(),
  email: z.email(),
  name: z.string().min(1),
  role: roleSchema,
  reportingGroupId: z.string().uuid().nullable().optional(),
  reportingGroupName: z.string().min(1).max(200).nullable().optional(),
  // A2 (UAT-v7 2026-05-12): soft-deactivation flag. Defaults to true so
  // existing snapshot rows (created before this field existed) parse cleanly.
  isActive: z.boolean().default(true),
});

export const reportingGroupSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(500).nullable().optional(),
  archived: z.boolean(),
  // UFB-039: optional FK to the User (role=head or admin) that runs this
  // group. null when the admin has not yet assigned a leader.
  headUserId: z.string().uuid().nullable().optional(),
});

export const adminProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  archived: z.boolean(),
  leadId: z.string().uuid(),
  leadName: z.string().min(1),
});

/**
 * UFB-054 (Phase 56-A/B): explicit Group ↔ Product M:M edge row. Returned
 * by `admin.attachProductToGroup` and consumed by the admin UI list/chip
 * surfaces. The id is server-assigned; the unique business key is the
 * (groupId, productId) tuple.
 */
export const groupProductSchema = z.object({
  id: z.string().uuid(),
  groupId: z.string().uuid(),
  productId: z.string().uuid(),
  createdAt: z.coerce.date(),
});

/**
 * UFB-054 (Phase 56-B): input for `admin.attachProductToGroup` and
 * `admin.detachProductFromGroup`. Symmetric because the same tuple
 * identifies the edge on both sides of the M:M relation.
 */
export const groupProductEdgeInputSchema = z.object({
  groupId: z.string().uuid(),
  productId: z.string().uuid(),
});

export const reportPeriodSchema = z.object({
  id: z.string().uuid(),
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
 *   active  → { scheduled, open, published-within-reopen-window }
 *   archive → { archived, published-out-of-reopen-window }
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
  id: z.string().uuid(),
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
  periodId: z.string().uuid(),
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
  reportId: z.string().uuid(),
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
  periodId: z.string().uuid(),
  periodStart: reportDate(),
  periodEnd: reportDate(),
  deadline: reportDate(),
  periodState: periodStateSchema,
  weekLabel: z.string().nullable(),
});

export type AdminUpdatePeriodManualResult = z.infer<
  typeof adminUpdatePeriodManualResultSchema
>;

// NOTIF-02 (Phase 29-05): 'escalation' added for T+2h heads-only digest.
// Bypasses User.notificationOptOut — heads must always be notified.
export const adminReminderRuleKindSchema = z.enum([
  "deadline",
  "follow_up",
  "escalation",
]);
export const adminReminderRuleStatusSchema = z.enum(["active", "paused"]);

export const adminReminderRuleSchema = z.object({
  id: z.string().uuid(),
  reportId: z.string().uuid().nullable(),
  /**
   * UFB-036 (Phase 44-04): the FK back to {@link reminderPolicySchema}.
   * Optional on input + transform to `null` so existing fixtures that
   * don't carry the field still validate. The output type is always
   * `string | null` so consumers can group rules under their owning
   * policy in the "Active rules per period" read-only expander without
   * having to handle `undefined`.
   */
  policyId: z.string().uuid().nullable().default(null),
  kind: adminReminderRuleKindSchema,
  fireAt: z.coerce.date(),
  timezone: z.string().min(1),
  status: adminReminderRuleStatusSchema,
  version: z.number().int().min(1),
});

export const adminReminderExecutionStatusSchema = z.enum([
  "queued",
  "sent",
  "failed",
]);

export const adminReminderExecutionSchema = z.object({
  id: z.string().uuid(),
  ruleId: z.string().uuid(),
  reportId: z.string().uuid().nullable(),
  dedupeKey: z.string().min(1),
  status: adminReminderExecutionStatusSchema,
  scheduledFor: z.coerce.date(),
  sentAt: z.coerce.date().nullable(),
  recipientEmail: z.string(),
  errorMessage: z.string().nullable(),
});

export const carryOverStatusSchema = z.enum(["pending", "completed", "failed"]);

export const carryOverRecordSchema = z.object({
  id: z.string().uuid(),
  sourceReportId: z.string().uuid(),
  targetReportId: z.string().uuid(),
  sourceItemId: z.string().uuid().nullable(),
  targetItemId: z.string().uuid().nullable(),
  sourceDecisionId: z.string().uuid().nullable(),
  targetDecisionId: z.string().uuid().nullable(),
  status: carryOverStatusSchema,
  carriedAt: z.coerce.date(),
});

export const carryOverExecutionSchema = z.object({
  id: z.string().uuid(),
  sourceReportId: z.string().uuid(),
  targetReportId: z.string().uuid(),
  dedupeKey: z.string().min(1),
  status: carryOverStatusSchema,
  startedAt: z.coerce.date(),
  completedAt: z.coerce.date(),
  carriedItemCount: z.number().int().min(0),
  carriedDecisionCount: z.number().int().min(0),
});

export const archiveReportSummarySchema = z.object({
  reportId: z.string().uuid(),
  periodStart: reportDate(),
  periodEnd: reportDate(),
  publishedAt: reportDate(),
  publishedByName: z.string().min(1),
  portfolioStatus: trafficLightStatusSchema,
});

export const archiveReportDetailSchema = z.object({
  summary: archiveReportSummarySchema,
  report: assembledReportSchema,
});

export const compiledHistoryInputSchema = z.object({
  includeArchive: z.boolean().optional(),
});

export const compiledHistoryEntrySchema = z.object({
  reportId: z.string().uuid(),
  periodStart: reportDate(),
  periodEnd: reportDate(),
  publishedAt: z.coerce.date().nullable(),
  archived: z.boolean(),
  publishedByName: z.string().min(1),
  trafficLights: z.object({
    green: z.number().int().min(0),
    yellow: z.number().int().min(0),
    red: z.number().int().min(0),
  }),
  itemCount: z.number().int().min(0),
  riskCount: z.number().int().min(0),
  decisionCount: z.number().int().min(0),
  priorityCount: z.number().int().min(0),
  sectionCount: z.number().int().min(0),
  productCount: z.number().int().min(0),
});

export const compiledHistoryResultSchema = z.object({
  entries: z.array(compiledHistoryEntrySchema),
  archiveCount: z.number().int().min(0),
});

export const adminSnapshotSchema = z.object({
  users: z.array(adminUserSchema),
  groups: z.array(reportingGroupSchema).default([]),
  projects: z.array(adminProjectSchema),
  periods: z.array(reportPeriodSchema),
  reminderRules: z.array(adminReminderRuleSchema),
  reminderExecutions: z.array(adminReminderExecutionSchema).default([]),
  /**
   * UFB-036 (Phase 44-02): list of {@link reminderPolicySchema} rows.
   * `default([])` keeps every existing fixture / parser call site
   * compatible — older snapshots (and the in-memory test repos) emit
   * snapshots without this field, and the schema fills the array.
   */
  policies: z.array(reminderPolicySchema).default([]),
});

// ---------------------------------------------------------------------------
// v4.0: Stage & Assignment schemas (D-63)
// ---------------------------------------------------------------------------

export const stageSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  sortOrder: z.number().int().min(0),
});

export const stageAssignmentSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  stageId: z.string().uuid(),
  projectId: z.string().uuid(),
  stageName: z.string().min(1),
  userName: z.string().min(1).optional(),
});

// ---------------------------------------------------------------------------
// v4.0: Version snapshot (D-67)
// ---------------------------------------------------------------------------

export const versionSnapshotSchema = z.object({
  id: z.string().uuid(),
  reportSectionId: z.string().uuid(),
  version: z.number().int().positive(),
  createdAt: z.coerce.date(),
  /**
   * Counts derived from the snapshot's `data` JSON column. Carried in the
   * read model so the version-history UI can render delta summaries
   * (e.g. "+1 item, +2 risks added") without fetching the full snapshot
   * payload for every row. Optional with a 0 default so legacy callers
   * that constructed snapshots without counts (pre-fix) keep parsing.
   */
  itemCount: z.number().int().min(0).default(0),
  riskCount: z.number().int().min(0).default(0),
  decisionCount: z.number().int().min(0).default(0),
});

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
 * `reminder-audience`; the API repository owns the wire ↔ Prisma mapper.
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
  notificationFromEmail: z
    .union([z.string().email().max(254), z.null()])
    .default(null),
  // ---- UFB-051 (Phase 51-A): Period-cycle knobs -----------------------
  // Calendar anchoring + concurrency + publish/reopen gating. All carry
  // `.default()` so pre-51-A fixtures (and partial PATCH payloads from
  // older clients) keep parsing. Consumers ship in Phase 51-C — 51-A
  // persists the values and renders them in the Settings UI only.
  // ISO weekday numbering: 1=Monday..7=Sunday.
  firstDayOfWeek: z.number().int().min(1).max(7).default(1),
  deadlineDayOfWeek: z.number().int().min(1).max(7).default(5),
  // HH:MM in the configured `defaultTimezone`. Regex pins the format so
  // garbage values cannot reach the future deadline-computation path.
  deadlineTime: z.string().regex(deadlineTimeRegex).default("18:00"),
  // Concurrency cap on simultaneously-open periods. Sensible 51-A
  // default is `1` (current weekly cadence). Upper bound chosen
  // defensively (`12`) — admins likely never go above a handful but
  // 12 covers a quarter's worth of overlapping monthly periods.
  maxOpenPeriods: z.number().int().min(1).max(12).default(1),
  requireAllSectionsToPublish: z.boolean().default(true),
  allowReopenAfterPublish: z.boolean().default(true),
  // Window after `publishedAt` during which a published report can be
  // reopened. `0..168` (one week) matches the 48-B `gracePeriodHours`
  // convention. Default `72` (3 days) chosen as a practical floor for
  // "noticed the bug on Monday, reopen Friday's report" use cases.
  reopenWindowHours: z.number().int().min(0).max(168).default(72),
});

export const appSettingsUpdateSchema = appSettingsSchema.partial();

// ---------------------------------------------------------------------------
// Phase 35-06: BullMQ DLQ admin surface (admin.jobs.listFailed / retryFailed)
// ---------------------------------------------------------------------------

/**
 * Read model for one entry in the BullMQ failed-set surfaced to admins.
 *
 * `id` is BullMQ's job id (an opaque numeric string), `name` is the
 * processor name (e.g. 'send-reminder-email'), and `data` is the job's
 * original payload. We keep `data` as `unknown` because the queue carries
 * different shapes across processors and the admin UI only renders metadata.
 */
export const failedJobSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  failedReason: z.string(),
  stacktrace: z.array(z.string()),
  attemptsMade: z.number().int().min(0),
  timestamp: z.number().int().min(0),
  data: z.unknown(),
});

export const failedJobListSchema = z.object({
  jobs: z.array(failedJobSchema),
  nextCursor: z.number().int().min(0).nullable(),
});

export const queueNameSchema = z.enum(["email-reminder"]);

export type FailedJob = z.infer<typeof failedJobSchema>;
export type FailedJobList = z.infer<typeof failedJobListSchema>;
export type QueueName = z.infer<typeof queueNameSchema>;

// ---------------------------------------------------------------------------
// v4.0: Period read model (extended)
// ---------------------------------------------------------------------------

export const periodReadModelSchema = z.object({
  id: z.string().uuid(),
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

// ---------------------------------------------------------------------------
// v4.0: Weekly report read model (D-58)
// ---------------------------------------------------------------------------

export const portfolioProductOverviewSchema = z.object({
  productId: z.string().uuid(),
  productName: z.string().min(1),
  worstStatus: trafficLightStatusSchema.nullable(),
  stageCount: z.number().int().min(0),
  leadNames: z.array(z.string().min(1)),
});

export const escalationSchema = z.object({
  type: z.enum(["blocked", "at_risk", "unresolved_risk"]),
  productName: z.string().min(1),
  stageName: z.string().nullable(),
  leadName: z.string().min(1),
  description: z.string(),
});

export const weeklyReportReadModelSchema = z.object({
  reportId: z.string().uuid(),
  periodStart: reportDate(),
  periodEnd: reportDate(),
  deadline: reportDate(),
  periodStatus: periodStatusSchema,
  weekLabel: z.string().nullable(),
  // UFB-047 / Phase 49-01: `departmentName` removed from the weekly read
  // model. Frontends pull the brand label from `auth.me.organization`
  // hydrated on every authenticated request (one source of truth).
  submissionCount: z.number().int().min(0),
  totalLeads: z.number().int().min(0),
  hasActiveReminderRule: z.boolean().default(false),
  portfolioOverview: z.array(portfolioProductOverviewSchema),
  leadSections: z.array(reportSectionReadModelSchema),
  escalations: z.array(escalationSchema),
});

/**
 * R3a (UFB-HEAD-DASH): discriminated-union response for `weeklyReport.get`.
 *
 * When no active Period exists the procedure returns `{ status: 'no-period',
 * report: null }` instead of throwing NOT_FOUND. This eliminates the React
 * Query retry storm (3 × retry = 3–5 s spinner) on fresh installs and
 * between period cycles.
 *
 * Consumers guard with `if (data.status === 'no-period') return <EmptyState/>`.
 */
export const weeklyReportGetResponseSchema = z.discriminatedUnion("status", [
  weeklyReportReadModelSchema.extend({ status: z.literal("active") }),
  z.object({ status: z.literal("no-period"), report: z.null() }),
]);

// ---------------------------------------------------------------------------
// v4.0: Type exports
// ---------------------------------------------------------------------------

export type PeriodStatus = z.infer<typeof periodStatusSchema>;
export type PeriodState = z.infer<typeof periodStateSchema>;
export type Stage = z.infer<typeof stageSchema>;
export type StageAssignment = z.infer<typeof stageAssignmentSchema>;
export type VersionSnapshot = z.infer<typeof versionSnapshotSchema>;
export type AppSettings = z.infer<typeof appSettingsSchema>;
export type WorkingDays = z.infer<typeof workingDaysSchema>;
export type PeriodReadModel = z.infer<typeof periodReadModelSchema>;
export type PortfolioProductOverview = z.infer<
  typeof portfolioProductOverviewSchema
>;
export type Escalation = z.infer<typeof escalationSchema>;
export type WeeklyReportReadModel = z.infer<typeof weeklyReportReadModelSchema>;
export type WeeklyReportGetResponse = z.infer<
  typeof weeklyReportGetResponseSchema
>;

export type DraftSavePayload = z.input<typeof draftSaveSchema>;
export type DraftSaveInput = z.infer<typeof draftSaveSchema>;
export type SubmitSectionPayload = z.input<typeof submitSectionSchema>;
export type SubmitSectionInput = z.infer<typeof submitSectionSchema>;
export type ReportSectionReadModel = z.infer<
  typeof reportSectionReadModelSchema
>;
export type ProjectReadModel = z.infer<typeof projectReadModelSchema>;
export type OwnedStage = z.infer<typeof ownedStageSchema>;
export type SubmissionDashboardRow = z.infer<
  typeof submissionDashboardRowSchema
>;
export type PortfolioOverview = z.infer<typeof portfolioOverviewSchema>;
export type AssembledReport = z.infer<typeof assembledReportSchema>;
export type PdfExportRequest = z.infer<typeof pdfExportRequestSchema>;
export type PdfExportJob = z.infer<typeof pdfExportJobSchema>;
export type AdminUser = z.infer<typeof adminUserSchema>;
export type ReportingGroup = z.infer<typeof reportingGroupSchema>;
export type AdminProject = z.infer<typeof adminProjectSchema>;
export type GroupProduct = z.infer<typeof groupProductSchema>;
export type GroupProductEdgeInput = z.infer<typeof groupProductEdgeInputSchema>;
export type ReportPeriod = z.infer<typeof reportPeriodSchema>;
export type AdminReminderRule = z.infer<typeof adminReminderRuleSchema>;
export type AdminReminderExecution = z.infer<
  typeof adminReminderExecutionSchema
>;
export type AdminSnapshot = z.infer<typeof adminSnapshotSchema>;
export type CarryOverRecord = z.infer<typeof carryOverRecordSchema>;
export type CarryOverExecution = z.infer<typeof carryOverExecutionSchema>;
export type ArchiveReportSummary = z.infer<typeof archiveReportSummarySchema>;
export type ArchiveReportDetail = z.infer<typeof archiveReportDetailSchema>;
export type CompiledHistoryInput = z.infer<typeof compiledHistoryInputSchema>;
export type CompiledHistoryEntry = z.infer<typeof compiledHistoryEntrySchema>;
export type CompiledHistoryResult = z.infer<typeof compiledHistoryResultSchema>;

export const myHistoryEntrySchema = z.object({
  sectionId: z.string().uuid(),
  reportId: z.string().uuid(),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  reportStatus: reportStatusSchema,
  sectionStatus: reportSectionStatusSchema,
  archived: z.boolean().optional(),
  submittedAt: z.coerce.date().nullable(),
  publishedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  lastEditAt: z.coerce.date().nullable().optional(),
  itemCount: z.number().int().min(0).optional(),
  riskCount: z.number().int().min(0).optional(),
  decisionCount: z.number().int().min(0).optional(),
  priorityCount: z.number().int().min(0).optional(),
  productCount: z.number().int().min(0).optional(),
  versionCount: z.number().int().min(0).optional(),
  latestVersion: z.number().int().min(1).nullable().optional(),
  latestVersionAt: z.coerce.date().nullable().optional(),
  trafficLights: z
    .object({
      green: z.number().int().min(0),
      yellow: z.number().int().min(0),
      red: z.number().int().min(0),
    })
    .optional(),
});

export type MyHistoryEntry = z.infer<typeof myHistoryEntrySchema>;

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export const paginationInputSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

export type PaginationInput = z.infer<typeof paginationInputSchema>;

export type PaginatedResult<T> = {
  items: T[];
  nextCursor: string | null;
};

export type DraftSaveValidationErrorCode =
  | "SECTION_ALREADY_SUBMITTED"
  | "MISSING_TRAFFIC_LIGHT"
  | "MISSING_CURRENT_ITEM";

export type DraftSaveValidationError = {
  code: DraftSaveValidationErrorCode;
  message: string;
};

export function validateSubmitInput(
  section: ReportSectionReadModel,
  input: SubmitSectionInput | SubmitSectionPayload,
): DraftSaveValidationError[] {
  if (section.status === "submitted") {
    return [
      {
        code: "SECTION_ALREADY_SUBMITTED",
        message: "Section has already been submitted.",
      },
    ];
  }

  const errors: DraftSaveValidationError[] = [];

  for (const project of section.projects) {
    const matchingStatus = input.projectStatuses.find(
      (status) => status.projectId === project.projectId,
    );

    if (!matchingStatus?.status) {
      errors.push({
        code: "MISSING_TRAFFIC_LIGHT",
        message: `Project ${project.projectName} must have a traffic light status.`,
      });
    }

    const hasCurrentItem = input.items.some(
      (item) => item.projectId === project.projectId && item.type === "current",
    );

    if (!hasCurrentItem) {
      errors.push({
        code: "MISSING_CURRENT_ITEM",
        message: `Project ${project.projectName} needs at least one Current Week item.`,
      });
    }
  }

  return errors;
}
