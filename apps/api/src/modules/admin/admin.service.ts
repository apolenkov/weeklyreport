import type {
  AdminCreatePeriodManualInput,
  AdminCreatePeriodManualResult,
  AdminProject,
  AdminReminderRule,
  AdminSnapshot,
  AdminUpdatePeriodManualInput,
  AdminUpdatePeriodManualResult,
  AdminUser,
  AppSettings,
  GroupProduct,
  GroupProductEdgeInput,
  PeriodListBucket,
  PeriodListItem,
  PeriodState,
  ReminderPolicy,
  ReportingGroup,
  ReportPeriod,
  StageAssignment,
  UserSession,
} from "@customreport/shared";

import { type AppLogger, createNullLogger } from "../../lib/logger";
import type {
  AdminRepository,
  ProductGroupOwnership,
  StageAssignmentCountRow,
  StageRow,
} from "./admin-shared";
import {
  type AdminTelemetry,
  NOOP_ADMIN_TELEMETRY,
} from "./admin-telemetry.port.js";
import type { ReopenRequestListItem } from "./period-admin.envelope";
import { PeriodAdminService } from "./period-admin.service";
import { ProjectAdminService } from "./project-admin.service";
import { ReminderAdminService } from "./reminder-admin.service";
import type {
  ListReopenRequestsArgs,
  RespondReopenRequestArgs,
  RespondReopenRequestResult,
} from "./reopen-request-admin.service";
import { ReopenRequestAdminService } from "./reopen-request-admin.service";
import { SnapshotAdminService } from "./snapshot-admin.service";

// Re-export the error classes and shared types from their original module
// path so every existing importer (`./admin.service`) resolves unchanged
// after the decomposition (code-quality-modernization, Wave 3). The error
// classes have exactly one definition (in `admin-shared.ts`) so `instanceof`
// checks in the tRPC error-mapper stay valid.
export type {
  AdminRepository,
  DecideReopenRequestInput,
  ListReopenRequestsInput,
  PeriodRowFromRepo,
  ProductGroupOwnership,
  ReopenDecisionOutcome,
  ReopenRequestRow,
  ReopenRequestStatusFilter,
  StageAssignmentCountRow,
  StageRow,
} from "./admin-shared";
export {
  AdminAccessError,
  AdminGroupProductConflictError,
  AdminPeriodAlreadyArchivedError,
  AdminPeriodNotFoundError,
  AdminPeriodOverlapError,
  AdminReopenRequestAlreadyProcessedError,
  AdminReopenRequestNotFoundError,
  AdminUserConflictError,
} from "./admin-shared";

/**
 * Thin delegating facade over five focused admin services
 * (`SnapshotAdminService`, `ProjectAdminService`, `ReminderAdminService`,
 * `PeriodAdminService`, `ReopenRequestAdminService`). Decomposed in
 * code-quality-modernization (Wave 3); the public method surface,
 * signatures, and behavior are unchanged.
 *
 * The sub-services are constructed internally from the same repository +
 * logger so callers (the tRPC router, integration tests doing
 * `new AdminService(repo)`) keep a single injection point.
 */
export class AdminService {
  private readonly logger: AppLogger;
  private readonly snapshotAdmin: SnapshotAdminService;
  private readonly projectAdmin: ProjectAdminService;
  private readonly reminderAdmin: ReminderAdminService;
  private readonly periodAdmin: PeriodAdminService;
  private readonly reopenRequestAdmin: ReopenRequestAdminService;

  constructor(
    repository: AdminRepository,
    logger?: AppLogger,
    telemetry: AdminTelemetry = NOOP_ADMIN_TELEMETRY,
  ) {
    this.logger = logger ?? createNullLogger();
    this.snapshotAdmin = new SnapshotAdminService(repository, this.logger);
    this.projectAdmin = new ProjectAdminService(repository, this.logger);
    this.reminderAdmin = new ReminderAdminService(repository, this.logger);
    this.periodAdmin = new PeriodAdminService(repository, this.logger);
    this.reopenRequestAdmin = new ReopenRequestAdminService(
      repository,
      this.logger,
      telemetry,
    );
  }

  /** Get application settings singleton. */
  getSettings(): Promise<AppSettings> {
    return this.snapshotAdmin.getSettings();
  }

  /** Update application settings (partial). */
  updateSettings(data: Partial<AppSettings>): Promise<AppSettings> {
    return this.snapshotAdmin.updateSettings(data);
  }

  getSnapshot(): Promise<AdminSnapshot> {
    return this.snapshotAdmin.getSnapshot();
  }

  upsertUser(user: AdminUser): Promise<AdminSnapshot> {
    return this.snapshotAdmin.upsertUser(user);
  }

  upsertReportingGroup(group: ReportingGroup): Promise<ReportingGroup> {
    return this.projectAdmin.upsertReportingGroup(group);
  }

  archiveReportingGroup(groupId: string): Promise<ReportingGroup> {
    return this.projectAdmin.archiveReportingGroup(groupId);
  }

  removeUser(userId: string): Promise<AdminSnapshot> {
    return this.snapshotAdmin.removeUser(userId);
  }

  upsertProject(project: AdminProject): Promise<AdminSnapshot> {
    return this.projectAdmin.upsertProject(project);
  }

  upsertPeriod(period: ReportPeriod): Promise<AdminSnapshot> {
    return this.periodAdmin.upsertPeriod(period);
  }

  upsertReminderRule(rule: AdminReminderRule): Promise<AdminSnapshot> {
    return this.reminderAdmin.upsertReminderRule(rule);
  }

  removeProject(projectId: string): Promise<AdminSnapshot> {
    return this.projectAdmin.removeProject(projectId);
  }

  /** Upsert a stage assignment (unique on stageId+projectId). */
  saveStageAssignment(data: {
    userId: string;
    stageId: string;
    projectId: string;
  }): Promise<StageAssignment> {
    return this.projectAdmin.saveStageAssignment(data);
  }

  /** Delete a stage assignment by ID. */
  deleteStageAssignment(id: string): Promise<{ success: true }> {
    return this.projectAdmin.deleteStageAssignment(id);
  }

  /** List stage assignments for a project. */
  listStageAssignments(projectId: string): Promise<StageAssignment[]> {
    return this.projectAdmin.listStageAssignments(projectId);
  }

  removeReminderRule(ruleId: string): Promise<AdminSnapshot> {
    return this.reminderAdmin.removeReminderRule(ruleId);
  }

  // -----------------------------------------------------------------
  // ReminderPolicy surface
  // -----------------------------------------------------------------

  listPolicies(): Promise<ReminderPolicy[]> {
    return this.reminderAdmin.listPolicies();
  }

  policyExists(policyId: string): Promise<boolean> {
    return this.reminderAdmin.policyExists(policyId);
  }

  savePolicy(policy: ReminderPolicy): Promise<ReminderPolicy> {
    return this.reminderAdmin.savePolicy(policy);
  }

  removePolicy(policyId: string): Promise<{ success: true }> {
    return this.reminderAdmin.removePolicy(policyId);
  }

  // -----------------------------------------------------------------
  // Admin Periods tab read/archive surface
  // -----------------------------------------------------------------

  listPeriodsByState(input: {
    bucket: PeriodListBucket;
    limit?: number;
  }): Promise<PeriodListItem[]> {
    return this.periodAdmin.listPeriodsByState(input);
  }

  archivePeriod(periodId: string): Promise<{ success: true }> {
    return this.periodAdmin.archivePeriod(periodId);
  }

  createPeriodManual(
    rawInput: AdminCreatePeriodManualInput,
    options: { now?: Date } = {},
  ): Promise<AdminCreatePeriodManualResult> {
    return this.periodAdmin.createPeriodManual(rawInput, options);
  }

  updatePeriodManual(rawInput: AdminUpdatePeriodManualInput): Promise<{
    result: AdminUpdatePeriodManualResult;
    diff: Partial<{
      periodStart: { from: Date; to: Date };
      periodEnd: { from: Date; to: Date };
      deadline: { from: Date; to: Date };
      weekLabel: { from: string | null; to: string | null };
    }>;
  }> {
    return this.periodAdmin.updatePeriodManual(rawInput);
  }

  unarchivePeriod(
    periodId: string,
  ): Promise<{ success: true; periodState: PeriodState }> {
    return this.periodAdmin.unarchivePeriod(periodId);
  }

  deleteReport(reportId: string): Promise<{ success: true }> {
    return this.periodAdmin.deleteReport(reportId);
  }

  // -----------------------------------------------------------------
  // Group ↔ Product M:M surface
  // -----------------------------------------------------------------

  attachProductToGroup(input: GroupProductEdgeInput): Promise<GroupProduct> {
    return this.projectAdmin.attachProductToGroup(input);
  }

  detachProductFromGroup(
    input: GroupProductEdgeInput,
  ): Promise<{ success: true }> {
    return this.projectAdmin.detachProductFromGroup(input);
  }

  listGroupProducts(groupId: string): Promise<AdminProject[]> {
    return this.projectAdmin.listGroupProducts(groupId);
  }

  listProductGroups(productId: string): Promise<ReportingGroup[]> {
    return this.projectAdmin.listProductGroups(productId);
  }

  listProductGroupOwnership(
    productIds: readonly string[],
  ): Promise<ProductGroupOwnership[]> {
    return this.projectAdmin.listProductGroupOwnership(productIds);
  }

  // -----------------------------------------------------------------
  // Deactivate/activate user, integrations status, stage catalogue
  // -----------------------------------------------------------------

  deactivateUser(userId: string): Promise<{ success: true }> {
    return this.snapshotAdmin.deactivateUser(userId);
  }

  activateUser(userId: string): Promise<{ success: true }> {
    return this.snapshotAdmin.activateUser(userId);
  }

  integrationsStatus(
    configured: boolean,
  ): Promise<{ telegram: { configured: boolean; bindings: number } }> {
    return this.snapshotAdmin.integrationsStatus(configured);
  }

  listStages(): Promise<StageRow[]> {
    return this.projectAdmin.listStages();
  }

  listStageAssignmentCounts(): Promise<StageAssignmentCountRow[]> {
    return this.projectAdmin.listStageAssignmentCounts();
  }

  // -----------------------------------------------------------------
  // Reopen-request lifecycle (reopen-request-lifecycle, ADR 0008)
  // -----------------------------------------------------------------

  listReopenRequests(
    input: ListReopenRequestsArgs,
  ): Promise<ReopenRequestListItem[]> {
    return this.reopenRequestAdmin.listReopenRequests(input);
  }

  pendingReopenCount(session: UserSession): Promise<{ count: number }> {
    return this.reopenRequestAdmin.pendingReopenCount(session);
  }

  respondReopenRequest(
    input: RespondReopenRequestArgs,
  ): Promise<RespondReopenRequestResult> {
    return this.reopenRequestAdmin.respondReopenRequest(input);
  }
}
