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
import { Injectable } from "@nestjs/common";
import type { ReportStatus } from "@prisma/client";

import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { PolicyApplicatorService } from "../reminders/policy-applicator.service";
import type { AdminRepository, PeriodRowFromRepo } from "./admin.service";
import * as groupQueries from "./admin-group.queries";
import * as groupProductQueries from "./admin-group-product.queries";
import * as periodQueries from "./admin-period.queries";
import * as policyQueries from "./admin-reminder-policy.queries";
import * as settingsQueries from "./admin-settings.queries";
import * as snapshotQueries from "./admin-snapshot.queries";
import * as snapshotWriteQueries from "./admin-snapshot-write.queries";

/**
 * Prisma implementation of AdminRepository.
 *
 * R3a-4 split: this class is a thin DI facade. The per-domain Prisma logic
 * lives in sibling `admin-*.queries.ts` modules (settings / group /
 * reminder-policy / snapshot / period / group-product); each method delegates
 * to a free function taking `this.prisma` (and, for snapshot writes,
 * `this.policyApplicator`). Method signatures are unchanged so the DI token,
 * the AdminRepository interface, and the integration tests are unaffected.
 * All output is parsed through Zod schemas in the query modules (REPO-09).
 */
@Injectable()
export class AdminPrismaRepository implements AdminRepository {
  constructor(
    private readonly prisma: PrismaService,
    // UFB-036 (Phase 44-03): post-create hook that materializes one
    // ReminderRule per active ReminderPolicy whose validity window
    // covers the new period's deadline. Wired in admin.module.ts.
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
    return groupQueries.saveStageAssignment(this.prisma, data);
  }

  deleteStageAssignment(id: string): Promise<void> {
    return groupQueries.deleteStageAssignment(this.prisma, id);
  }

  listStageAssignments(projectId: string): Promise<StageAssignment[]> {
    return groupQueries.listStageAssignments(this.prisma, projectId);
  }

  // ---- ReminderPolicy (UFB-036 / Phase 44-02) ----

  listReminderPolicies(): Promise<ReminderPolicy[]> {
    return policyQueries.listReminderPolicies(this.prisma);
  }

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

  // ---- Periods (UFB-052 / 063 / 067) ----

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
    input: {
      periodStart: Date;
      periodEnd: Date;
      deadline: Date;
      weekLabel: string | null;
      periodState: PeriodState;
    },
    now?: Date,
  ): Promise<{
    id: string;
    periodStart: Date;
    periodEnd: Date;
    deadline: Date;
    periodState: PeriodState;
  }> {
    const created = await periodQueries.createPeriodManual(this.prisma, input);
    // UFB-036 parity: materialize one ReminderRule per active policy on the
    // freshly-created period — like `saveSnapshot` (snapshot periods) and
    // `period-factory` (scheduler/login periods). `now` is forwarded so a
    // backfilled period whose deadline is already past does not arm elapsed
    // reminders as `active` (they would fire stale on the next tick) — the
    // applicator drops those when `now` is supplied. Runs AFTER the create
    // commits (an applicator failure cannot roll back the period) and
    // propagates on error so an admin sees the failure, not a silent gap.
    if (this.policyApplicator) {
      await this.policyApplicator.applyToPeriod(created, now);
    }
    return created;
  }

  readPeriodById(periodId: string): Promise<{
    id: string;
    periodStart: Date;
    periodEnd: Date;
    deadline: Date;
    weekLabel: string | null;
    periodState: PeriodState;
  } | null> {
    return periodQueries.readPeriodById(this.prisma, periodId);
  }

  updatePeriodManual(input: {
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
  }> {
    return periodQueries.updatePeriodManual(this.prisma, input);
  }

  archivePeriod(periodId: string): Promise<void> {
    return periodQueries.archivePeriod(this.prisma, periodId);
  }

  unarchivePeriod(periodId: string): Promise<{
    nextPeriodState: PeriodState;
    nextPeriodStatus: PeriodStatus;
  }> {
    return periodQueries.unarchivePeriod(this.prisma, periodId);
  }

  readReportForDelete(
    reportId: string,
  ): Promise<{ status: ReportStatus; periodStatus: PeriodStatus } | null> {
    return periodQueries.readReportForDelete(this.prisma, reportId);
  }

  deleteReport(reportId: string): Promise<void> {
    return periodQueries.deleteReport(this.prisma, reportId);
  }

  // ---- Group ↔ Product M:M (UFB-054 / Phase 56-B) ----

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
}
