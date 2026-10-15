import type {
  AdminProject,
  AdminSnapshot,
  AdminUser,
  AppSettings,
  DraftPeriodState,
  GroupProduct,
  GroupProductEdgeInput,
  PeriodState,
  ReminderPolicy,
  ReportingGroup,
  StageAssignment,
  UserSession,
} from "@weeklyreport/shared";

import type {
  DecideReopenRequestInput,
  ListReopenRequestsInput,
  PeriodListCursor,
  PeriodRowFromRepo,
  ProductGroupOwnership,
  ReopenDecisionOutcome,
  ReopenRequestRow,
  StageAssignmentCountRow,
  StageRow,
} from "./admin-shared-types.js";
import type { PeriodEnvelope } from "./period-admin.envelope.js";

export interface AdminRepository {
  getSnapshot(): Promise<AdminSnapshot>;
  // Admin-recovery restore, run atomically. Additive-only: upserts every
  // supplied row, NEVER deletes/archives a row absent from the payload —
  // removals go exclusively through the targeted remove* methods.
  saveSnapshot(snapshot: AdminSnapshot): Promise<AdminSnapshot>;
  // Targeted single-entity writes: each touches ONLY the named row (upsert /
  // delete / archive by id), so an edit never reconciles an unrelated
  // concurrently-inserted row. Callers re-read getSnapshot for the response.
  upsertUser(user: AdminUser): Promise<void>;
  removeUser(userId: string): Promise<void>;
  upsertProject(project: AdminProject): Promise<void>;
  removeProject(projectId: string): Promise<void>;
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
  listReminderPolicies(): Promise<ReminderPolicy[]>;
  saveReminderPolicy(policy: ReminderPolicy): Promise<{
    policy: ReminderPolicy;
    created: boolean;
  }>;
  deleteReminderPolicy(policyId: string): Promise<void>;
  listPeriodsByState(filter: {
    states: readonly PeriodState[];
    cursor?: PeriodListCursor;
    // Explicit: the service resolves the default and cap upstream.
    limit: number;
  }): Promise<PeriodRowFromRepo[]>;
  archivePeriod(periodId: string): Promise<void>;
  unarchivePeriod(
    periodId: string,
    now: Date,
  ): Promise<{ nextPeriodState: PeriodState }>;
  // Delete a Report only when its lifecycle is still draft/open/non-archived;
  // throws a typed error when the guarded operation matches zero rows.
  deleteReport(reportId: string): Promise<void>;
  // Detect a live scheduled/open Report overlapping the supplied closed range,
  // matching the database exclusion constraint so historical rows remain valid.
  // Returns the newest overlap or null; `excludeId` excludes the edited row.
  findOverlappingPeriod(input: {
    periodStart: Date;
    periodEnd: Date;
    excludeId?: string;
  }): Promise<{ id: string; periodStart: Date; periodEnd: Date } | null>;
  // Mint a Report row with the supplied dates + initial state, then materialise
  // its reminder rules via the PolicyApplicator. `now` is forwarded so a
  // backfilled (past-dated) period does not arm elapsed reminders as active.
  createPeriodManual(
    input: {
      periodStart: Date;
      periodEnd: Date;
      deadline: Date;
      weekLabel: string | null;
      periodState: DraftPeriodState;
    },
    now?: Date,
  ): Promise<{
    id: string;
    periodStart: Date;
    periodEnd: Date;
    deadline: Date;
    periodState: DraftPeriodState;
  }>;
  // Read one period's current envelope for the update path; null → the service
  // throws AdminPeriodNotFoundError. The envelope is also the audit from-snapshot.
  readPeriodById(periodId: string): Promise<{
    id: string;
    periodStart: Date;
    periodEnd: Date;
    deadline: Date | null;
    weekLabel: string | null;
    periodState: PeriodState;
  } | null>;
  // Patch the date envelope + weekLabel of an existing Report (partial PATCH:
  // writes only the keys present in `data`); returns the readPeriodById projection.
  updatePeriodManual(input: {
    reportId: string;
    // Expected state for envelope edits; the repository re-checks it while
    // holding the report row lock so publish/archive races fail closed.
    expectedPeriodState: PeriodState;
    // Changed-field audit before-values; range edits also depend on both bounds.
    expectedEnvelope: PeriodEnvelope;
    data: {
      periodStart?: Date;
      periodEnd?: Date;
      deadline?: Date | null;
      weekLabel?: string | null;
    };
  }): Promise<{
    id: string;
    periodStart: Date;
    periodEnd: Date;
    deadline: Date | null;
    weekLabel: string | null;
    periodState: PeriodState;
  }>;
  // Explicit Group ↔ Product M:M edge mutations and read paths.
  attachProductToGroup(input: GroupProductEdgeInput): Promise<GroupProduct>;
  detachProductFromGroup(input: GroupProductEdgeInput): Promise<void>;
  listGroupProducts(groupId: string): Promise<AdminProject[]>;
  listProductGroups(productId: string): Promise<ReportingGroup[]>;
  // Batched owning-group lookup: one query resolves the owning group for every
  // requested product, replacing the per-product listProductGroups fan-out.
  listProductGroupOwnership(
    productIds: readonly string[],
  ): Promise<ProductGroupOwnership[]>;
  // Deactivate/activate user, stage catalogue, reopen-request lifecycle.
  // Every AdminRepository double gets an explicit stub (see
  // unusedAdminRepositoryStubs). Flip isActive; revocation stays the caller's job.
  deactivateUser(userId: string): Promise<void>;
  // Flip `User.isActive=true`. Session restoration stays the caller's job.
  activateUser(userId: string): Promise<void>;
  // Full SDLC stage catalogue, ordered by `sortOrder`.
  listStages(): Promise<StageRow[]>;
  // Per-project `StageAssignment` counts (single grouped query).
  listStageAssignmentCounts(): Promise<StageAssignmentCountRow[]>;
  // Group-scoped reopen-request list for the Admin Panel / head dashboard.
  listReopenRequests(
    input: ListReopenRequestsInput,
  ): Promise<ReopenRequestRow[]>;
  // Group-scoped pending-reopen count.
  countPendingReopenRequests(session: UserSession): Promise<number>;
  // The full race-safe decision: scoped re-load + the compare-and-set
  // transaction. Throws AdminReopenRequestNotFoundError when the re-load fails.
  decideReopenRequest(
    input: DecideReopenRequestInput,
  ): Promise<ReopenDecisionOutcome>;
}
