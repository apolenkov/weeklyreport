import type {
  AdminProject,
  AdminSnapshot,
  AdminUser,
  AppSettings,
  GroupProduct,
  GroupProductEdgeInput,
  PeriodState,
  PeriodStatus,
  ReminderPolicy,
  ReportingGroup,
  StageAssignment,
  UserSession,
} from "@customreport/shared";
import { Inject, Injectable } from "@nestjs/common";

import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { PolicyApplicatorService } from "../reminders/index.js";
import * as entityWriteQueries from "./admin-entity-write.queries";
import * as groupQueries from "./admin-group.queries";
import * as groupProductQueries from "./admin-group-product.queries";
import * as periodQueries from "./admin-period.queries";
import * as periodLifecycle from "./admin-period-lifecycle";
import * as policyQueries from "./admin-reminder-policy.queries";
import * as reopenQueries from "./admin-reopen-request-lifecycle.js";
import * as settingsQueries from "./admin-settings.queries";
import type {
  AdminRepository,
  DecideReopenRequestInput,
  ListReopenRequestsInput,
  PeriodRowFromRepo,
  ProductGroupOwnership,
  ReopenDecisionOutcome,
  ReopenRequestRow,
  StageAssignmentCountRow,
  StageRow,
} from "./admin-shared";
import * as snapshotQueries from "./admin-snapshot.queries";
import * as snapshotWriteQueries from "./admin-snapshot-write.queries";
import * as stageQueries from "./admin-stage.queries";

// Prisma implementation of AdminRepository — a thin DI facade delegating to
// sibling `admin-*.queries.ts` modules, with output parsed through their Zod
// schemas. Method signatures match the AdminRepository interface + DI token.
@Injectable()
export class AdminPrismaRepository implements AdminRepository {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    // post-create hook that materializes one
    // ReminderRule per active ReminderPolicy whose validity window
    // covers the new period's deadline. Wired in admin.module.ts.
    @Inject(PolicyApplicatorService)
    private readonly policyApplicator?: PolicyApplicatorService,
  ) {}

  // ---- AppSettings ----

  getSettings(): Promise<AppSettings> {
    return settingsQueries.getSettings(this.prisma);
  }

  updateSettings(data: Partial<AppSettings>): Promise<AppSettings> {
    return settingsQueries.updateSettings(this.prisma, data);
  }

  // ---- ReportingGroup + StageAssignment ----

  saveReportingGroup(group: ReportingGroup): Promise<ReportingGroup> {
    return groupQueries.saveReportingGroup(this.prisma, group);
  }

  archiveReportingGroup(groupId: string): Promise<ReportingGroup> {
    return groupQueries.archiveReportingGroup(this.prisma, groupId);
  }

  saveStageAssignment(data: {
    userId: string;
    stageId: string;
    projectId: string;
  }): Promise<StageAssignment> {
    return stageQueries.saveStageAssignment(this.prisma, data);
  }

  deleteStageAssignment(id: string): Promise<void> {
    return stageQueries.deleteStageAssignment(this.prisma, id);
  }

  listStageAssignments(projectId: string): Promise<StageAssignment[]> {
    return stageQueries.listStageAssignments(this.prisma, projectId);
  }

  // ---- ReminderPolicy ----

  listReminderPolicies(): Promise<ReminderPolicy[]> {
    return policyQueries.listReminderPolicies(this.prisma);
  }

  readonly reminderPolicyExists = (policyId: string): Promise<boolean> =>
    policyQueries.reminderPolicyExists(this.prisma, policyId);

  saveReminderPolicy(policy: ReminderPolicy): Promise<ReminderPolicy> {
    return policyQueries.saveReminderPolicy(this.prisma, policy);
  }

  deleteReminderPolicy(policyId: string): Promise<void> {
    return policyQueries.deleteReminderPolicy(this.prisma, policyId);
  }

  // ---- AdminSnapshot ----

  getSnapshot(): Promise<AdminSnapshot> {
    return snapshotQueries.getSnapshot(this.prisma);
  }

  saveSnapshot(snapshot: AdminSnapshot): Promise<AdminSnapshot> {
    return snapshotWriteQueries.saveSnapshot(
      this.prisma,
      this.policyApplicator,
      snapshot,
    );
  }

  // ---- Targeted single-entity writes ----

  upsertUser(user: AdminUser): Promise<void> {
    return entityWriteQueries.upsertUser(this.prisma, user);
  }

  removeUser(userId: string): Promise<void> {
    return entityWriteQueries.removeUser(this.prisma, userId);
  }

  upsertProject(project: AdminProject): Promise<void> {
    return entityWriteQueries.upsertProject(this.prisma, project);
  }

  removeProject(projectId: string): Promise<void> {
    return entityWriteQueries.removeProject(this.prisma, projectId);
  }

  // ---- Periods ----

  listPeriodsByState(filter: {
    states: readonly PeriodState[];
    limit: number;
  }): Promise<PeriodRowFromRepo[]> {
    return periodQueries.listPeriodsByState(this.prisma, filter);
  }

  findOverlappingPeriod(input: {
    periodStart: Date;
    periodEnd: Date;
    excludeId?: string;
  }): Promise<{ id: string; periodStart: Date; periodEnd: Date } | null> {
    return periodQueries.findOverlappingPeriod(this.prisma, input);
  }

  async createPeriodManual(
    input: Parameters<AdminRepository["createPeriodManual"]>[0],
    now?: Date,
  ): ReturnType<AdminRepository["createPeriodManual"]> {
    const created = await periodLifecycle.createPeriodManual(
      this.prisma,
      input,
    );
    // Materialize one ReminderRule per active policy on the fresh period. `now`
    // is forwarded so a backfilled period with a past deadline does not arm
    // elapsed reminders as active. Runs after the create; errors propagate.
    if (this.policyApplicator) {
      await this.policyApplicator.applyToPeriod(created, now);
    }
    return created;
  }

  readPeriodById(
    periodId: string,
  ): ReturnType<AdminRepository["readPeriodById"]> {
    return periodQueries.readPeriodById(this.prisma, periodId);
  }

  updatePeriodManual(
    input: Parameters<AdminRepository["updatePeriodManual"]>[0],
  ): ReturnType<AdminRepository["updatePeriodManual"]> {
    return periodLifecycle.updatePeriodManual(this.prisma, input);
  }

  archivePeriod(periodId: string): Promise<void> {
    return periodLifecycle.archivePeriod(this.prisma, periodId);
  }

  unarchivePeriod(periodId: string): Promise<{
    nextPeriodState: PeriodState;
    nextPeriodStatus: PeriodStatus;
  }> {
    return periodLifecycle.unarchivePeriod(this.prisma, periodId);
  }

  deleteReport(reportId: string): Promise<void> {
    return periodQueries.deleteReport(this.prisma, reportId);
  }

  // ---- Group ↔ Product M:M ----

  attachProductToGroup(input: GroupProductEdgeInput): Promise<GroupProduct> {
    return groupProductQueries.attachProductToGroup(this.prisma, input);
  }

  detachProductFromGroup(input: GroupProductEdgeInput): Promise<void> {
    return groupProductQueries.detachProductFromGroup(this.prisma, input);
  }

  listGroupProducts(groupId: string): Promise<AdminProject[]> {
    return groupProductQueries.listGroupProducts(this.prisma, groupId);
  }

  listProductGroups(productId: string): Promise<ReportingGroup[]> {
    return groupProductQueries.listProductGroups(this.prisma, productId);
  }

  listProductGroupOwnership(
    productIds: readonly string[],
  ): Promise<ProductGroupOwnership[]> {
    return groupProductQueries.listProductGroupOwnership(
      this.prisma,
      productIds,
    );
  }

  // ---- Deactivate/activate user, integrations status, stage catalogue ----

  deactivateUser(userId: string): Promise<void> {
    return entityWriteQueries.deactivateUser(this.prisma, userId);
  }

  activateUser(userId: string): Promise<void> {
    return entityWriteQueries.activateUser(this.prisma, userId);
  }

  listStages(): Promise<StageRow[]> {
    return stageQueries.listStages(this.prisma);
  }

  listStageAssignmentCounts(): Promise<StageAssignmentCountRow[]> {
    return stageQueries.listStageAssignmentCounts(this.prisma);
  }

  // ---- Reopen-request lifecycle ----

  listReopenRequests(
    input: ListReopenRequestsInput,
  ): Promise<ReopenRequestRow[]> {
    return reopenQueries.listReopenRequests(this.prisma, input);
  }

  countPendingReopenRequests(session: UserSession): Promise<number> {
    return reopenQueries.countPendingReopenRequests(this.prisma, session);
  }

  decideReopenRequest(
    input: DecideReopenRequestInput,
  ): Promise<ReopenDecisionOutcome> {
    return reopenQueries.decideReopenRequest(this.prisma, input);
  }
}
