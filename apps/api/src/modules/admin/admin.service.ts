import {
  adminCreatePeriodManualResultSchema,
  adminCreatePeriodManualSchema,
  adminProjectSchema,
  adminReminderRuleSchema,
  adminSnapshotSchema,
  adminUpdatePeriodManualResultSchema,
  adminUpdatePeriodManualSchema,
  adminUserSchema,
  appSettingsSchema,
  appSettingsUpdateSchema,
  groupProductSchema,
  periodListItemSchema,
  reminderPolicySchema,
  reportingGroupSchema,
  stageAssignmentSchema,
  reportPeriodSchema,
  type AdminCreatePeriodManualInput,
  type AdminCreatePeriodManualResult,
  type AdminProject,
  type AdminReminderRule,
  type AdminSnapshot,
  type AdminUpdatePeriodManualInput,
  type AdminUpdatePeriodManualResult,
  type AdminUser,
  type AppSettings,
  type GroupProduct,
  type GroupProductEdgeInput,
  type PeriodListBucket,
  type PeriodListItem,
  type PeriodState,
  type PeriodStatus,
  type ReminderPolicy,
  type ReportingGroup,
  type ReportPeriod,
  type StageAssignment,
} from "@customreport/shared";
import { ReportStatus } from "@prisma/client";

import { computeDeadline } from "../../lib/business-date.js";
import { createNullLogger, type AppLogger } from "../../lib/logger";
import { initialPeriodState } from "../weekly-report/period-state.js";

export class AdminAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminAccessError";
  }
}

/**
 * UFB-063: thrown by `createPeriodManual` when the requested
 * [periodStart, periodEnd] range overlaps any existing Report. Mapped to
 * `BAD_REQUEST` by `mapDomainError` so the web layer can pipe the message
 * straight to a toast and the admin sees which existing period is in the
 * way.
 */
export class AdminPeriodOverlapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminPeriodOverlapError";
  }
}

/**
 * UFB-067: thrown by `updatePeriodManual` when the supplied `reportId`
 * does not resolve to an existing Report. Maps to `NOT_FOUND` via the
 * trpc error-mapper so the web layer's toast can copy the message
 * verbatim ("Period <id> not found").
 */
export class AdminPeriodNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminPeriodNotFoundError";
  }
}

export interface AdminRepository {
  getSnapshot(): Promise<AdminSnapshot>;
  saveSnapshot(snapshot: AdminSnapshot): Promise<AdminSnapshot>;
  getSettings(): Promise<AppSettings>;
  updateSettings(data: Partial<AppSettings>): Promise<AppSettings>;
  saveReportingGroup(group: ReportingGroup): Promise<ReportingGroup>;
  archiveReportingGroup(groupId: string): Promise<ReportingGroup>;
  saveStageAssignment(data: {
    userId: string;
    stageId: string;
    projectId: string;
  }): Promise<StageAssignment>;
  deleteStageAssignment(id: string): Promise<void>;
  listStageAssignments(projectId: string): Promise<StageAssignment[]>;
  // UFB-036 (Phase 44-02): ReminderPolicy CRUD. Optional so existing
  // in-memory test repositories that predate the policies surface keep
  // compiling — service callers fall back to an empty list when the
  // repo doesn't implement them.
  listReminderPolicies?(): Promise<ReminderPolicy[]>;
  saveReminderPolicy?(policy: ReminderPolicy): Promise<ReminderPolicy>;
  archiveReminderPolicy?(policyId: string): Promise<void>;
  // UFB-052 (Phase 51-B): rich period rows for the redesigned Admin
  // Periods tab. Optional so existing in-memory test repositories
  // (e.g. admin.service.test.ts) keep compiling — service callers fall
  // back to an empty list when the repo doesn't implement it.
  listPeriodsByState?(filter: {
    states: readonly PeriodState[];
    /** Cap is enforced server-side; defaults to 50 when caller omits. */
    limit: number;
  }): Promise<PeriodRowFromRepo[]>;
  archivePeriod?(periodId: string): Promise<void>;
  unarchivePeriod?(
    periodId: string,
  ): Promise<{ nextPeriodState: PeriodState; nextPeriodStatus: PeriodStatus }>;
  // A27: delete a Report (period) and cascade-delete all child rows.
  // Optional so in-memory test repos can opt out.
  deleteReport?(reportId: string): Promise<void>;
  // A27: read a Report for delete-guard checks (status, periodStatus to block published).
  // Returns null if not found so the service can throw AdminAccessError.
  readReportForDelete?(reportId: string): Promise<{
    status: ReportStatus;
    periodStatus: PeriodStatus;
  } | null>;
  // UFB-063: detect any existing Report whose [periodStart, periodEnd]
  // overlaps the supplied half-open range. The service uses this BEFORE
  // calling createPeriodManual to surface a friendly error pointing at
  // the blocking row. Returns the first overlap (newest-first); null when
  // free. Optional so in-memory test repos can opt out.
  //
  // UFB-067: extended with `excludeId` so the update path can rerun the
  // overlap gate while excluding the row being edited (otherwise a no-op
  // rewrite of the same envelope would self-conflict). Backward-compatible
  // — existing callers that omit the field get unchanged behavior.
  findOverlappingPeriod?(input: {
    periodStart: Date;
    periodEnd: Date;
    excludeId?: string;
  }): Promise<{ id: string; periodStart: Date; periodEnd: Date } | null>;
  // UFB-063: mint a Report row with the supplied dates + initial state.
  // Mirrors PeriodCreatorScheduler.runOnce's bare `report.create` — no
  // section seeding, no PolicyApplicator (deferred; documented in the
  // 063 SUMMARY as the same gap that affects auto-create).
  createPeriodManual?(input: {
    periodStart: Date;
    periodEnd: Date;
    deadline: Date;
    weekLabel: string | null;
    periodState: PeriodState;
  }): Promise<{
    id: string;
    periodStart: Date;
    periodEnd: Date;
    deadline: Date;
    periodState: PeriodState;
  }>;
  // UFB-067: read a single period's current envelope for the update path.
  // Returns null when the id does not resolve so the service can throw
  // `AdminPeriodNotFoundError` (maps to NOT_FOUND). The current envelope
  // is also used for the audit `from`-snapshot of changed fields.
  readPeriodById?(periodId: string): Promise<{
    id: string;
    periodStart: Date;
    periodEnd: Date;
    deadline: Date;
    weekLabel: string | null;
    periodState: PeriodState;
  } | null>;
  // UFB-067: patch the date envelope + weekLabel of an existing Report.
  // Repository writes only the keys present in `data` (partial PATCH);
  // returns the updated row in the same projection used by `readPeriodById`.
  updatePeriodManual?(input: {
    reportId: string;
    data: {
      periodStart?: Date;
      periodEnd?: Date;
      deadline?: Date;
      weekLabel?: string | null;
    };
  }): Promise<{
    id: string;
    periodStart: Date;
    periodEnd: Date;
    deadline: Date;
    weekLabel: string | null;
    periodState: PeriodState;
  }>;
  // UFB-054 (Phase 56-B): explicit Group ↔ Product M:M edge mutations and
  // read paths. Optional so existing in-memory test repositories that
  // predate this surface keep compiling — service callers throw when the
  // repo doesn't implement them. Matches the listReminderPolicies?(...)
  // pattern above.
  attachProductToGroup?(input: GroupProductEdgeInput): Promise<GroupProduct>;
  detachProductFromGroup?(input: GroupProductEdgeInput): Promise<void>;
  listGroupProducts?(groupId: string): Promise<AdminProject[]>;
  listProductGroups?(productId: string): Promise<ReportingGroup[]>;
}

/**
 * UFB-052 (Phase 51-B): the raw shape returned by `listPeriodsByState`
 * before the service layer derives `canReopen` / `canArchive`. The
 * service holds the AppSettings references (`allowReopenAfterPublish`,
 * `reopenWindowHours`) so the repository stays settings-agnostic.
 */
export type PeriodRowFromRepo = {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  deadline: Date;
  publishedAt: Date | null;
  periodState: PeriodState;
  periodStatus: PeriodStatus;
  archived: boolean;
  autoPublished: boolean;
  autoArchived: boolean;
  submittedCount: number;
  totalCount: number;
  weekLabel: string | null;
};

function sortByName<T extends { name: string }>(rows: T[]): T[] {
  return [...rows].sort((left, right) =>
    left.name.localeCompare(right.name, "ru"),
  );
}

export class AdminService {
  private readonly logger: AppLogger;

  constructor(
    private readonly repository: AdminRepository,
    logger?: AppLogger,
  ) {
    this.logger = logger ?? createNullLogger();
  }

  /** API-11: Get application settings singleton. */
  async getSettings(): Promise<AppSettings> {
    return appSettingsSchema.parse(await this.repository.getSettings());
  }

  /** API-11: Update application settings (partial). */
  async updateSettings(data: Partial<AppSettings>): Promise<AppSettings> {
    const parsed = appSettingsUpdateSchema.parse(data);
    return appSettingsSchema.parse(
      await this.repository.updateSettings(parsed),
    );
  }

  async getSnapshot(): Promise<AdminSnapshot> {
    return adminSnapshotSchema.parse(await this.repository.getSnapshot());
  }

  async upsertUser(user: AdminUser): Promise<AdminSnapshot> {
    const parsedUser = adminUserSchema.parse(user);
    const snapshot = await this.getSnapshot();
    const nextUsers = sortByName(
      snapshot.users.some((row) => row.id === parsedUser.id)
        ? snapshot.users.map((row) =>
            row.id === parsedUser.id ? parsedUser : row,
          )
        : [...snapshot.users, parsedUser],
    );

    this.logger.info("upserted user", { userId: parsedUser.id });
    return this.repository.saveSnapshot(
      adminSnapshotSchema.parse({ ...snapshot, users: nextUsers }),
    );
  }

  async upsertReportingGroup(group: ReportingGroup): Promise<ReportingGroup> {
    const parsedGroup = reportingGroupSchema.parse(group);
    this.logger.info("upserted reporting group", { groupId: parsedGroup.id });
    return reportingGroupSchema.parse(
      await this.repository.saveReportingGroup(parsedGroup),
    );
  }

  async archiveReportingGroup(groupId: string): Promise<ReportingGroup> {
    this.logger.info("archived reporting group", { groupId });
    return reportingGroupSchema.parse(
      await this.repository.archiveReportingGroup(groupId),
    );
  }

  async removeUser(userId: string): Promise<AdminSnapshot> {
    const snapshot = await this.getSnapshot();
    const nextUsers = snapshot.users.filter((row) => row.id !== userId);

    return this.repository.saveSnapshot(
      adminSnapshotSchema.parse({ ...snapshot, users: nextUsers }),
    );
  }

  async upsertProject(project: AdminProject): Promise<AdminSnapshot> {
    const parsedProject = adminProjectSchema.parse(project);
    const snapshot = await this.getSnapshot();
    const nextProjects = sortByName(
      snapshot.projects.some((row) => row.id === parsedProject.id)
        ? snapshot.projects.map((row) =>
            row.id === parsedProject.id ? parsedProject : row,
          )
        : [...snapshot.projects, parsedProject],
    );

    return this.repository.saveSnapshot(
      adminSnapshotSchema.parse({ ...snapshot, projects: nextProjects }),
    );
  }

  async upsertPeriod(period: ReportPeriod): Promise<AdminSnapshot> {
    const parsedPeriod = reportPeriodSchema.parse(period);
    const snapshot = await this.getSnapshot();
    const nextPeriods = snapshot.periods.some(
      (row) => row.id === parsedPeriod.id,
    )
      ? snapshot.periods.map((row) =>
          row.id === parsedPeriod.id ? parsedPeriod : row,
        )
      : [...snapshot.periods, parsedPeriod];

    return this.repository.saveSnapshot(
      adminSnapshotSchema.parse({ ...snapshot, periods: nextPeriods }),
    );
  }

  async upsertReminderRule(rule: AdminReminderRule): Promise<AdminSnapshot> {
    const parsedRule = adminReminderRuleSchema.parse(rule);
    const snapshot = await this.getSnapshot();
    const nextRules = snapshot.reminderRules.some(
      (row) => row.id === parsedRule.id,
    )
      ? snapshot.reminderRules.map((row) =>
          row.id === parsedRule.id ? parsedRule : row,
        )
      : [...snapshot.reminderRules, parsedRule];

    return this.repository.saveSnapshot(
      adminSnapshotSchema.parse({ ...snapshot, reminderRules: nextRules }),
    );
  }

  async removeProject(projectId: string): Promise<AdminSnapshot> {
    const snapshot = await this.getSnapshot();
    const nextProjects = snapshot.projects.map((row) =>
      row.id === projectId ? { ...row, archived: true } : row,
    );

    return this.repository.saveSnapshot(
      adminSnapshotSchema.parse({ ...snapshot, projects: nextProjects }),
    );
  }

  /** API-12: Upsert a stage assignment (unique on stageId+projectId). */
  async saveStageAssignment(data: {
    userId: string;
    stageId: string;
    projectId: string;
  }): Promise<StageAssignment> {
    return stageAssignmentSchema.parse(
      await this.repository.saveStageAssignment(data),
    );
  }

  /** API-12: Delete a stage assignment by ID. */
  async deleteStageAssignment(id: string): Promise<{ success: true }> {
    await this.repository.deleteStageAssignment(id);
    return { success: true };
  }

  /** API-12: List stage assignments for a project. */
  async listStageAssignments(projectId: string): Promise<StageAssignment[]> {
    const rows = await this.repository.listStageAssignments(projectId);
    return rows.map((r) => stageAssignmentSchema.parse(r));
  }

  async removeReminderRule(ruleId: string): Promise<AdminSnapshot> {
    const snapshot = await this.getSnapshot();
    const nextRules = snapshot.reminderRules.filter((row) => row.id !== ruleId);

    return this.repository.saveSnapshot(
      adminSnapshotSchema.parse({ ...snapshot, reminderRules: nextRules }),
    );
  }

  // -----------------------------------------------------------------
  // UFB-036 (Phase 44-02): ReminderPolicy surface
  // -----------------------------------------------------------------

  /**
   * List all reminder policies (active and archived). Audit-log helper
   * (`auditLogger.policySave`) is wired in 44-05; this read path stays
   * silent.
   */
  async listPolicies(): Promise<ReminderPolicy[]> {
    if (!this.repository.listReminderPolicies) {
      return [];
    }
    const rows = await this.repository.listReminderPolicies();
    return rows.map((row) => reminderPolicySchema.parse(row));
  }

  /**
   * UFB-036 (Phase 44-05): existence check used by the tRPC router to
   * decide whether the upcoming `savePolicy` call is a create or an
   * update — feeds the `admin.policy.save` audit event so SIEM rules
   * and dashboards can split the two cases without diffing payloads.
   * Returns `false` (not an exception) when the policy surface is not
   * implemented on the repository, so router-level audit emission stays
   * resilient against in-memory test repos.
   */
  async policyExists(policyId: string): Promise<boolean> {
    if (!this.repository.listReminderPolicies) return false;
    const rows = await this.repository.listReminderPolicies();
    return rows.some((row) => row.id === policyId);
  }

  /**
   * Upsert a reminder policy by id. Input is zod-validated so the
   * audience enum (`lead-with-draft | head-of-late`) and kind enum
   * (`deadline | follow_up | escalation`) cannot drift to invalid wire
   * values from a malicious admin client.
   */
  async savePolicy(policy: ReminderPolicy): Promise<ReminderPolicy> {
    const parsed = reminderPolicySchema.parse(policy);
    if (!this.repository.saveReminderPolicy) {
      throw new Error(
        "AdminRepository.saveReminderPolicy is not implemented for this repository.",
      );
    }
    this.logger.info("upserted reminder policy", { policyId: parsed.id });
    return reminderPolicySchema.parse(
      await this.repository.saveReminderPolicy(parsed),
    );
  }

  /**
   * Soft-archive a reminder policy. The repository decides whether the
   * row is hard-deleted (no derived rules) or flipped to `active=false`
   * (rules still reference it).
   */
  async removePolicy(policyId: string): Promise<{ success: true }> {
    if (!this.repository.archiveReminderPolicy) {
      throw new Error(
        "AdminRepository.archiveReminderPolicy is not implemented for this repository.",
      );
    }
    this.logger.info("archived reminder policy", { policyId });
    await this.repository.archiveReminderPolicy(policyId);
    return { success: true };
  }

  // -----------------------------------------------------------------
  // UFB-052 (Phase 51-B): Admin Periods tab read/archive surface
  // -----------------------------------------------------------------

  /**
   * Resolve the virtual buckets `'active' | 'archive'` to a concrete
   * set of `PeriodState` values. The active bucket excludes `archived`
   * and `published-out-of-reopen-window` (the published rows that the
   * UI treats as effectively archived even before the auto-archiver
   * runs). The archive bucket is the inverse.
   *
   * Currently both `published` rows are routed to the active bucket;
   * the post-fetch derivation of `canReopen` lets the UI surface the
   * out-of-window rows in the archive section without a second query.
   * If 51-D wants strict server-side bucketing, this is the seam.
   */
  private resolveBucketStates(bucket: PeriodListBucket): PeriodState[] {
    switch (bucket) {
      case "active":
        return ["scheduled", "open", "published"];
      case "archive":
        return ["archived"];
      case "scheduled":
      case "open":
      case "published":
      case "archived":
        return [bucket];
      default: {
        const _exhaustive: never = bucket;
        throw new Error(`Unknown period bucket: ${String(_exhaustive)}`);
      }
    }
  }

  /**
   * UFB-052 (Phase 51-B): paginated period list filtered by lifecycle
   * bucket. Returns rows with server-precomputed `canReopen` (driven
   * by `AppSettings.allowReopenAfterPublish` + `reopenWindowHours`)
   * and `canArchive` so the UI doesn't need to know the policy rules.
   *
   * The hot path uses the `(periodState, periodStart desc)` composite
   * index added in 51-C; submission-progress counts come from a single
   * grouped query against `ReportSection`.
   */
  async listPeriodsByState(input: {
    bucket: PeriodListBucket;
    limit?: number;
  }): Promise<PeriodListItem[]> {
    if (!this.repository.listPeriodsByState) {
      return [];
    }
    const states = this.resolveBucketStates(input.bucket);
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
    const settings = await this.getSettings();
    const rows = await this.repository.listPeriodsByState({
      states,
      limit,
    });

    const now = Date.now();
    return rows.map((row) => {
      const canReopen =
        row.periodState === "published" &&
        settings.allowReopenAfterPublish &&
        row.publishedAt !== null &&
        row.publishedAt.getTime() + settings.reopenWindowHours * 3_600_000 >
          now;
      // Archive is allowed for any not-yet-archived published period;
      // the auto-archiver handles the deferred "weeks-after-publish"
      // path. Manual archive is the head's escape hatch.
      const canArchive =
        row.periodState === "published" && !row.archived;
      return periodListItemSchema.parse({
        id: row.id,
        periodStart: row.periodStart,
        periodEnd: row.periodEnd,
        deadline: row.deadline,
        publishedAt: row.publishedAt,
        periodState: row.periodState,
        periodStatus: row.periodStatus,
        archived: row.archived,
        autoPublished: row.autoPublished,
        autoArchived: row.autoArchived,
        submittedCount: row.submittedCount,
        totalCount: row.totalCount,
        weekLabel: row.weekLabel,
        canReopen,
        canArchive,
      });
    });
  }

  /**
   * UFB-052 (Phase 51-B): manual archive — flips both the legacy
   * `archived` boolean and the new `periodState` enum to `'archived'`
   * in a single write so the two-state-machine invariant from 51-C
   * (Open Question 1) is preserved.
   */
  async archivePeriod(periodId: string): Promise<{ success: true }> {
    if (!this.repository.archivePeriod) {
      throw new Error(
        "AdminRepository.archivePeriod is not implemented for this repository.",
      );
    }
    this.logger.info("archived period", { periodId });
    await this.repository.archivePeriod(periodId);
    return { success: true };
  }

  /**
   * UFB-063: admin escape hatch that mints a Period without waiting for
   * the daily `PeriodCreatorScheduler` (00:05 UTC cron). Targets fresh
   * dev/staging DBs (zero Reports → admin is blocked) and one-off
   * backfill cycles.
   *
   * Defaulting rules (mirrors the scheduler's date math):
   *   - `periodEnd` defaults to `periodStart + (settings.periodLengthDays - 1)`
   *     calendar days at end-of-day (23:59:59.999) so a 7-day period
   *     starting Mon spans Mon..Sun inclusive.
   *   - `deadline` defaults to `computeDeadline(periodStart, settings.defaultDeadlineDays,
   *     settings.workingDays, settings.defaultTimezone, hourFromDeadlineTime)`.
   *
   * Validation:
   *   - `periodEnd >= periodStart` (after applying default).
   *   - `findOverlappingPeriod` is consulted BEFORE the create to surface
   *     a friendly error pointing at the blocking row (admin-visible date
   *     range, not just "already exists").
   *
   * The initial `periodState` is derived via `initialPeriodState` — same
   * rule the scheduler uses (`'scheduled'` when start is in the future,
   * `'open'` otherwise). The scheduler skips PolicyApplicator on create
   * (pre-existing gap, see SUMMARY); we mirror that exactly so the two
   * creation paths stay behaviourally identical and a future fix lands
   * in one place.
   */
  async createPeriodManual(
    rawInput: AdminCreatePeriodManualInput,
    options: { now?: Date } = {},
  ): Promise<AdminCreatePeriodManualResult> {
    if (!this.repository.createPeriodManual) {
      throw new Error(
        "AdminRepository.createPeriodManual is not implemented for this repository.",
      );
    }
    const input = adminCreatePeriodManualSchema.parse(rawInput);
    const settings = await this.getSettings();
    const now = options.now ?? new Date();

    // -- Defaults -------------------------------------------------------
    // periodEnd defaults to (periodStart + periodLengthDays - 1) at the
    // very end of that day (23:59:59.999 UTC) — matches the scheduler's
    // (periodStart, periodEnd) shape (start = Monday 00:00:00, end =
    // Sunday 23:59:59) for a 7-day cycle.
    const periodEnd =
      input.periodEnd ??
      new Date(
        input.periodStart.getTime() +
          (settings.periodLengthDays - 1) * 24 * 3_600_000 +
          (24 * 3_600_000 - 1),
      );

    if (periodEnd.getTime() < input.periodStart.getTime()) {
      throw new AdminPeriodOverlapError(
        `periodEnd (${periodEnd.toISOString()}) is before periodStart (${input.periodStart.toISOString()}).`,
      );
    }

    // deadlineTime is "HH:MM"; computeDeadline takes an hour integer. We
    // strip minutes (the scheduler already does — its hardcoded `18`
    // matches the default "18:00"). When future plans add sub-hour
    // granularity, both this call site and the scheduler should be
    // updated together.
    const [hourStr] = settings.deadlineTime.split(":");
    const deadlineHour = Number(hourStr ?? "18");

    const deadline =
      input.deadline ??
      computeDeadline(
        input.periodStart,
        settings.defaultDeadlineDays,
        settings.workingDays,
        settings.defaultTimezone,
        deadlineHour,
      );

    // -- Overlap gate ---------------------------------------------------
    if (this.repository.findOverlappingPeriod) {
      const conflict = await this.repository.findOverlappingPeriod({
        periodStart: input.periodStart,
        periodEnd,
      });
      if (conflict) {
        throw new AdminPeriodOverlapError(
          `A period already exists for these dates: ${conflict.periodStart
            .toISOString()
            .slice(0, 10)}…${conflict.periodEnd.toISOString().slice(0, 10)}.`,
        );
      }
    }

    // -- Mint -----------------------------------------------------------
    const periodState = initialPeriodState(input.periodStart, now);
    const weekLabel = input.weekLabel ?? null;

    this.logger.info("creating period manually", {
      periodStart: input.periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      deadline: deadline.toISOString(),
      periodState,
    });

    const created = await this.repository.createPeriodManual({
      periodStart: input.periodStart,
      periodEnd,
      deadline,
      weekLabel,
      periodState,
    });

    return adminCreatePeriodManualResultSchema.parse({
      periodId: created.id,
      periodStart: created.periodStart,
      periodEnd: created.periodEnd,
      deadline: created.deadline,
      periodState: created.periodState,
    });
  }

  /**
   * UFB-067: patch an existing Report's date envelope + weekLabel. Mirror
   * of `createPeriodManual` for the in-place edit flow exposed in the
   * Admin → Periods table (each row now carries an inline Edit icon that
   * opens the same dialog in "edit" mode).
   *
   * Semantics:
   *   - Only fields present in `rawInput` are written. Omitting a key
   *     leaves the column untouched (true PATCH).
   *   - `weekLabel: null` is an explicit clear; omitting the key means
   *     "leave as-is" — the zod schema's `.nullable().optional()` keeps
   *     the two cases distinguishable on the wire.
   *   - When the envelope shifts, the overlap gate is re-run with
   *     `excludeId === reportId` so the row being edited cannot
   *     self-conflict with its own original envelope.
   *   - The current row is read once up front; missing → throws
   *     `AdminPeriodNotFoundError` (maps to NOT_FOUND).
   *   - No-op edit (zero data keys) short-circuits before the overlap gate
   *     and skips the audit envelope — there is nothing to audit (the
   *     `from === to` diff would be empty and SIEM rules that key on a
   *     non-empty changed-fields list would otherwise log noise).
   *
   * Returns the canonical updated row + an audit-diff hint so the router
   * can emit `period.manual-edit` with the actual delta. The diff list
   * stays inside the service return value (vs being computed in the
   * router) because the service is the only layer that has both the
   * before and after envelopes in scope at the same time.
   */
  async updatePeriodManual(
    rawInput: AdminUpdatePeriodManualInput,
  ): Promise<{
    result: AdminUpdatePeriodManualResult;
    /**
     * Per-field `(before, after)` snapshots of changed columns. Empty
     * object means the input was a no-op (zero data keys or all values
     * matched the existing row); the router treats an empty diff as
     * "skip audit envelope".
     */
    diff: Partial<{
      periodStart: { from: Date; to: Date };
      periodEnd: { from: Date; to: Date };
      deadline: { from: Date; to: Date };
      weekLabel: { from: string | null; to: string | null };
    }>;
  }> {
    if (!this.repository.updatePeriodManual || !this.repository.readPeriodById) {
      throw new Error(
        "AdminRepository.updatePeriodManual / readPeriodById is not implemented for this repository.",
      );
    }
    const input = adminUpdatePeriodManualSchema.parse(rawInput);

    // -- Read existing -------------------------------------------------
    const existing = await this.repository.readPeriodById(input.reportId);
    if (!existing) {
      throw new AdminPeriodNotFoundError(
        `Period ${input.reportId} not found.`,
      );
    }

    // -- Compute the actual diff ---------------------------------------
    // Build a `data` payload that contains ONLY the keys whose new value
    // actually differs from the current row. Equal-value writes are
    // dropped so the audit envelope only carries real changes (matches
    // the no-op contract in the docstring above).
    const data: {
      periodStart?: Date;
      periodEnd?: Date;
      deadline?: Date;
      weekLabel?: string | null;
    } = {};
    const diff: Partial<{
      periodStart: { from: Date; to: Date };
      periodEnd: { from: Date; to: Date };
      deadline: { from: Date; to: Date };
      weekLabel: { from: string | null; to: string | null };
    }> = {};

    if (
      input.periodStart !== undefined &&
      input.periodStart.getTime() !== existing.periodStart.getTime()
    ) {
      data.periodStart = input.periodStart;
      diff.periodStart = { from: existing.periodStart, to: input.periodStart };
    }
    if (
      input.periodEnd !== undefined &&
      input.periodEnd.getTime() !== existing.periodEnd.getTime()
    ) {
      data.periodEnd = input.periodEnd;
      diff.periodEnd = { from: existing.periodEnd, to: input.periodEnd };
    }
    if (
      input.deadline !== undefined &&
      input.deadline.getTime() !== existing.deadline.getTime()
    ) {
      data.deadline = input.deadline;
      diff.deadline = { from: existing.deadline, to: input.deadline };
    }
    // weekLabel: explicit `null` is an allowed value (clear). Compare on
    // structural equality (`null === null`, `'foo' === 'foo'`) so an
    // unchanged-label PATCH is dropped from the diff.
    if (input.weekLabel !== undefined && input.weekLabel !== existing.weekLabel) {
      data.weekLabel = input.weekLabel;
      diff.weekLabel = { from: existing.weekLabel, to: input.weekLabel };
    }

    // -- No-op short-circuit -------------------------------------------
    if (Object.keys(data).length === 0) {
      // Return the existing row unchanged so the web layer's cache echo
      // stays consistent with a real edit. Diff is empty → router skips
      // the audit envelope.
      return {
        result: adminUpdatePeriodManualResultSchema.parse({
          periodId: existing.id,
          periodStart: existing.periodStart,
          periodEnd: existing.periodEnd,
          deadline: existing.deadline,
          periodState: existing.periodState,
          weekLabel: existing.weekLabel,
        }),
        diff,
      };
    }

    // -- Overlap gate (only when an envelope key changed) --------------
    const envelopeChanged =
      data.periodStart !== undefined || data.periodEnd !== undefined;
    if (envelopeChanged && this.repository.findOverlappingPeriod) {
      // Use the new effective envelope (incoming where provided, existing
      // otherwise) so the overlap check matches what will be written.
      const effectiveStart = data.periodStart ?? existing.periodStart;
      const effectiveEnd = data.periodEnd ?? existing.periodEnd;
      if (effectiveEnd.getTime() < effectiveStart.getTime()) {
        throw new AdminPeriodOverlapError(
          `periodEnd (${effectiveEnd.toISOString()}) is before periodStart (${effectiveStart.toISOString()}).`,
        );
      }
      const conflict = await this.repository.findOverlappingPeriod({
        periodStart: effectiveStart,
        periodEnd: effectiveEnd,
        excludeId: input.reportId,
      });
      if (conflict) {
        throw new AdminPeriodOverlapError(
          `A period already exists for these dates: ${conflict.periodStart
            .toISOString()
            .slice(0, 10)}…${conflict.periodEnd.toISOString().slice(0, 10)}.`,
        );
      }
    }

    this.logger.info("updating period manually", {
      periodId: input.reportId,
      changedFields: Object.keys(data),
    });

    const updated = await this.repository.updatePeriodManual({
      reportId: input.reportId,
      data,
    });

    return {
      result: adminUpdatePeriodManualResultSchema.parse({
        periodId: updated.id,
        periodStart: updated.periodStart,
        periodEnd: updated.periodEnd,
        deadline: updated.deadline,
        periodState: updated.periodState,
        weekLabel: updated.weekLabel,
      }),
      diff,
    };
  }

  /**
   * UFB-052 (Phase 51-B): un-archive — reverts `archived=false` and
   * derives the next `periodState` from the legacy tuple at write time
   * (since the new state column lost the pre-archive distinction
   * scheduled/open/published when it was set to `'archived'`). The
   * repository is the only layer that has access to the historical
   * tuple, so the derivation lives there.
   */
  async unarchivePeriod(
    periodId: string,
  ): Promise<{ success: true; periodState: PeriodState }> {
    if (!this.repository.unarchivePeriod) {
      throw new Error(
        "AdminRepository.unarchivePeriod is not implemented for this repository.",
      );
    }
    this.logger.info("unarchived period", { periodId });
    const result = await this.repository.unarchivePeriod(periodId);
    return { success: true, periodState: result.nextPeriodState };
  }

  /**
   * A27: delete a period (Report row) and cascade-delete all child rows.
   * Guard: cannot delete published periods. Throws `AdminAccessError` if the
   * period is published; maps to FORBIDDEN via trpc.error-mapper.
   */
  async deleteReport(reportId: string): Promise<{ success: true }> {
    if (!this.repository.deleteReport) {
      throw new Error(
        "AdminRepository.deleteReport is not implemented for this repository.",
      );
    }
    const report = await this.repository.readReportForDelete?.(reportId);
    if (!report) {
      throw new AdminAccessError(`Report ${reportId} not found.`);
    }
    if (
      report.status === "published" ||
      report.periodStatus === "published"
    ) {
      throw new AdminAccessError(
        "Cannot delete a published period. Reopen it first if needed.",
      );
    }
    this.logger.info("deleted report", { reportId });
    await this.repository.deleteReport(reportId);
    return { success: true };
  }

  // -----------------------------------------------------------------
  // UFB-054 (Phase 56-B): Group ↔ Product M:M surface
  // -----------------------------------------------------------------

  /**
   * Attach a Product to a ReportingGroup. The repository upserts on the
   * (groupId, productId) unique tuple so re-calls are idempotent — useful
   * for the UI toggle that may race against itself if a user clicks
   * twice. Returns the canonical {@link GroupProduct} row so the caller
   * can echo `createdAt` into the audit envelope.
   */
  async attachProductToGroup(
    input: GroupProductEdgeInput,
  ): Promise<GroupProduct> {
    if (!this.repository.attachProductToGroup) {
      throw new Error(
        "AdminRepository.attachProductToGroup is not implemented for this repository.",
      );
    }
    this.logger.info("attached product to group", input);
    return groupProductSchema.parse(
      await this.repository.attachProductToGroup(input),
    );
  }

  /**
   * Detach a Product from a ReportingGroup. No-op when the edge is
   * already absent (repository swallows the delete-not-found). Returns
   * `{ success: true }` so the tRPC mutation has a non-undefined
   * response shape that audit / toast handlers can key off.
   */
  async detachProductFromGroup(
    input: GroupProductEdgeInput,
  ): Promise<{ success: true }> {
    if (!this.repository.detachProductFromGroup) {
      throw new Error(
        "AdminRepository.detachProductFromGroup is not implemented for this repository.",
      );
    }
    this.logger.info("detached product from group", input);
    await this.repository.detachProductFromGroup(input);
    return { success: true };
  }

  /**
   * List the Products attached to a ReportingGroup via the explicit
   * `GroupProduct` edge. Used by the admin Groups tab's «Products
   * attached» section. Returns `AdminProject` rows so the UI gets the
   * existing project shape (id, name, archived, leadId, leadName)
   * without a second snapshot call.
   */
  async listGroupProducts(groupId: string): Promise<AdminProject[]> {
    if (!this.repository.listGroupProducts) return [];
    const rows = await this.repository.listGroupProducts(groupId);
    return rows.map((row) => adminProjectSchema.parse(row));
  }

  /**
   * List the ReportingGroups that own a given Product via the explicit
   * `GroupProduct` edge. Used by the admin Products tab's «Groups»
   * column. Returns full `ReportingGroup` rows so the chip renderer can
   * show the group name without a join.
   */
  async listProductGroups(productId: string): Promise<ReportingGroup[]> {
    if (!this.repository.listProductGroups) return [];
    const rows = await this.repository.listProductGroups(productId);
    return rows.map((row) => reportingGroupSchema.parse(row));
  }
}
