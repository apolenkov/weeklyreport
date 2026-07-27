import type {
  AdminProject,
  AdminReminderRule,
  AdminSnapshot,
  AdminUser,
  AppSettings,
  GroupProduct,
  GroupProductEdgeInput,
  PeriodState,
  PeriodStatus,
  ReminderPolicy,
  ReportingGroup,
  ReportStatus,
  StageAssignment,
  UserSession,
} from "@customreport/shared";

import type {
  DecideReopenRequestInput,
  ListReopenRequestsInput,
  PeriodRowFromRepo,
  ProductGroupOwnership,
  ReopenDecisionOutcome,
  ReopenRequestRow,
  StageAssignmentCountRow,
  StageRow,
} from "./admin-shared-types.js";

export interface AdminRepository {
  getSnapshot: () => Promise<AdminSnapshot>;
  /**
   * Whole-snapshot restore (e.g. importing an AdminSnapshot), run atomically.
   *
   * Additive-only: it upserts every supplied row and NEVER deletes or archives
   * a row merely for being absent from the payload. Removals go exclusively
   * through the targeted `removeUser` / `removeProject` / `removeReminderRule`
   * methods below; snapshot absence never implies deletion. A future import
   * that needs removals adds an explicit deletion id-set then.
   */
  saveSnapshot: (snapshot: AdminSnapshot) => Promise<AdminSnapshot>;
  // Targeted single-entity writes — each touches ONLY the named row (upsert by
  // id; delete/archive by id), so an edit to one entity never reconciles an
  // unrelated, concurrently-inserted row away. Callers re-read `getSnapshot`
  // for the response shape their tRPC procedure returns.
  upsertUser: (user: AdminUser) => Promise<void>;
  removeUser: (userId: string) => Promise<void>;
  upsertProject: (project: AdminProject) => Promise<void>;
  removeProject: (projectId: string) => Promise<void>;
  upsertReminderRule: (rule: AdminReminderRule) => Promise<void>;
  removeReminderRule: (ruleId: string) => Promise<void>;
  getSettings: () => Promise<AppSettings>;
  updateSettings: (data: Partial<AppSettings>) => Promise<AppSettings>;
  saveReportingGroup: (group: ReportingGroup) => Promise<ReportingGroup>;
  archiveReportingGroup: (groupId: string) => Promise<ReportingGroup>;
  saveStageAssignment: (data: {
    userId: string;
    stageId: string;
    projectId: string;
  }) => Promise<StageAssignment>;
  deleteStageAssignment: (id: string) => Promise<void>;
  listStageAssignments: (projectId: string) => Promise<StageAssignment[]>;
  listReminderPolicies: () => Promise<ReminderPolicy[]>;
  saveReminderPolicy: (policy: ReminderPolicy) => Promise<ReminderPolicy>;
  deleteReminderPolicy: (policyId: string) => Promise<void>;
  listPeriodsByState: (filter: {
    states: readonly PeriodState[];
    /** Cap is enforced server-side; defaults to 50 when caller omits. */
    limit: number;
  }) => Promise<PeriodRowFromRepo[]>;
  archivePeriod: (periodId: string) => Promise<void>;
  unarchivePeriod: (
    periodId: string,
  ) => Promise<{
    nextPeriodState: PeriodState;
    nextPeriodStatus: PeriodStatus;
  }>;
  // Delete a Report (period) and cascade-delete all child rows.
  deleteReport: (reportId: string) => Promise<void>;
  // Read a Report for delete-guard checks (status, periodStatus to block published).
  // Returns null if not found so the service can throw AdminAccessError.
  readReportForDelete: (reportId: string) => Promise<{
    status: ReportStatus;
    periodStatus: PeriodStatus;
  } | null>;
  // detect any existing Report whose [periodStart, periodEnd]
  // overlaps the supplied half-open range. The service uses this BEFORE
  // calling createPeriodManual to surface a friendly error pointing at
  // the blocking row. Returns the first overlap (newest-first); null when
  // free.
  //
  // `excludeId` lets the update path rerun the overlap gate while
  // excluding the row being edited (otherwise a no-op rewrite of the
  // same envelope would self-conflict). Callers that omit the field get
  // unchanged behavior.
  findOverlappingPeriod: (input: {
    periodStart: Date;
    periodEnd: Date;
    excludeId?: string;
  }) => Promise<{ id: string; periodStart: Date; periodEnd: Date } | null>;
  // mint a Report row with the supplied dates + initial state, then
  // materialise its reminder rules via the PolicyApplicator (parity with
  // saveSnapshot and period-factory). `now` is forwarded to the applicator so
  // a backfilled (past-dated) period does not arm already-elapsed reminders as
  // `active` — they would fire stale on the next scheduler tick.
  createPeriodManual: (
    input: {
      periodStart: Date;
      periodEnd: Date;
      deadline: Date;
      weekLabel: string | null;
      periodState: PeriodState;
    },
    now?: Date,
  ) => Promise<{
    id: string;
    periodStart: Date;
    periodEnd: Date;
    deadline: Date;
    periodState: PeriodState;
  }>;
  // read a single period's current envelope for the update path.
  // Returns null when the id does not resolve so the service can throw
  // `AdminPeriodNotFoundError` (maps to NOT_FOUND). The current envelope
  // is also used for the audit `from`-snapshot of changed fields.
  readPeriodById: (periodId: string) => Promise<{
    id: string;
    periodStart: Date;
    periodEnd: Date;
    deadline: Date | null;
    weekLabel: string | null;
    periodState: PeriodState;
  } | null>;
  // patch the date envelope + weekLabel of an existing Report.
  // Repository writes only the keys present in `data` (partial PATCH);
  // returns the updated row in the same projection used by `readPeriodById`.
  updatePeriodManual: (input: {
    reportId: string;
    data: {
      periodStart?: Date;
      periodEnd?: Date;
      deadline?: Date | null;
      weekLabel?: string | null;
    };
  }) => Promise<{
    id: string;
    periodStart: Date;
    periodEnd: Date;
    deadline: Date | null;
    weekLabel: string | null;
    periodState: PeriodState;
  }>;
  // Explicit Group ↔ Product M:M edge mutations and read paths.
  attachProductToGroup: (input: GroupProductEdgeInput) => Promise<GroupProduct>;
  detachProductFromGroup: (input: GroupProductEdgeInput) => Promise<void>;
  listGroupProducts: (groupId: string) => Promise<AdminProject[]>;
  listProductGroups: (productId: string) => Promise<ReportingGroup[]>;
  // batched owning-group lookup for the "products attached" editor.
  // One query resolves the single owning group for every requested product,
  // replacing the per-product listProductGroups fan-out.
  listProductGroupOwnership: (
    productIds: readonly string[],
  ) => Promise<ProductGroupOwnership[]>;
  // -----------------------------------------------------------------
  // Deactivate/activate user, integrations status, stage catalogue,
  // reopen-request lifecycle (drain-admin-router). Required — every
  // AdminRepository double gets an explicit stub (see
  // `unusedAdminRepositoryStubs` in admin-repository-unused-stubs.ts).
  // -----------------------------------------------------------------
  /** Flip `User.isActive=false`. Session revocation stays the caller's job. */
  deactivateUser: (userId: string) => Promise<void>;
  /** Flip `User.isActive=true`. Session restoration stays the caller's job. */
  activateUser: (userId: string) => Promise<void>;
  /** Count of `TelegramBinding` rows with `active=true`, for the Settings → Integrations sub-tab. */
  countActiveTelegramBindings: () => Promise<number>;
  /** Full SDLC stage catalogue, ordered by `sortOrder`. */
  listStages: () => Promise<StageRow[]>;
  /** Per-project `StageAssignment` counts (single grouped query). */
  listStageAssignmentCounts: () => Promise<StageAssignmentCountRow[]>;
  /** Group-scoped reopen-request list for the Admin Panel / head dashboard. */
  listReopenRequests: (
    input: ListReopenRequestsInput,
  ) => Promise<ReopenRequestRow[]>;
  /** Group-scoped pending-reopen count. */
  countPendingReopenRequests: (session: UserSession) => Promise<number>;
  /**
   * The full race-safe decision: scoped re-load + the compare-and-set
   * transaction. Throws {@link AdminReopenRequestNotFoundError} when the
   * scoped re-load finds nothing.
   */
  decideReopenRequest: (
    input: DecideReopenRequestInput,
  ) => Promise<ReopenDecisionOutcome>;
}
