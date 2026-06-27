import type {
  AdminProject,
  AdminSnapshot,
  AppSettings,
  GroupProduct,
  GroupProductEdgeInput,
  PeriodState,
  PeriodStatus,
  ReminderPolicy,
  ReportingGroup,
  StageAssignment,
} from "@customreport/shared";
import type { ReportStatus } from "@prisma/client";

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
  deleteReminderPolicy?(policyId: string): Promise<void>;
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
export interface PeriodRowFromRepo {
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
}

export function sortByName<T extends { name: string }>(rows: T[]): T[] {
  return [...rows].sort((left, right) =>
    left.name.localeCompare(right.name, "ru"),
  );
}
