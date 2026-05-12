import { Injectable } from "@nestjs/common";
import {
  adminSnapshotSchema,
  adminUserSchema,
  adminProjectSchema,
  appSettingsSchema,
  groupProductSchema,
  reminderPolicySchema,
  reportingGroupSchema,
  stageAssignmentSchema,
  reportPeriodSchema,
  adminReminderRuleSchema,
  adminReminderExecutionSchema,
  type AdminProject,
  type AdminSnapshot,
  type AppSettings,
  type GroupProduct,
  type GroupProductEdgeInput,
  type PeriodState,
  type PeriodStatus,
  type ReminderAudience,
  type ReminderPolicy,
  type ReportingGroup,
  type StageAssignment,
  type WorkingDays,
} from "@customreport/shared";
import {
  ReminderAudience as PrismaReminderAudience,
  WorkingDays as PrismaWorkingDays,
  ReportStatus,
} from "@prisma/client";

import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { PolicyApplicatorService } from "../reminders/policy-applicator.service";
import type {
  AdminRepository,
  PeriodRowFromRepo,
} from "./admin.service";

/**
 * UFB-036 (Phase 44-02): wire format ↔ Prisma enum mappers for
 * `ReminderAudience`. The Prisma model uses screaming-snake
 * (`LEAD_WITH_DRAFT | HEAD_OF_LATE`); the wire/zod contract uses
 * lowercase-hyphen (`lead-with-draft | head-of-late`). Keeping the
 * translation here keeps one boundary instead of leaking the DB
 * convention into the rest of the codebase.
 */
const audienceFromPrisma: Record<PrismaReminderAudience, ReminderAudience> = {
  LEAD_WITH_DRAFT: "lead-with-draft",
  HEAD_OF_LATE: "head-of-late",
};
const audienceToPrisma: Record<ReminderAudience, PrismaReminderAudience> = {
  "lead-with-draft": "LEAD_WITH_DRAFT",
  "head-of-late": "HEAD_OF_LATE",
};

/**
 * UFB-048 (Phase 48-B): wire ↔ Prisma translators for the new
 * `WorkingDays` enum. Mirrors the audience mappers above so the DB
 * convention (`MON_FRI | MON_SAT | MON_SUN`) does not leak past this
 * boundary into shared schemas or the React UI.
 */
const workingDaysFromPrisma: Record<PrismaWorkingDays, WorkingDays> = {
  MON_FRI: "mon-fri",
  MON_SAT: "mon-sat",
  MON_SUN: "mon-sun",
};
const workingDaysToPrisma: Record<WorkingDays, PrismaWorkingDays> = {
  "mon-fri": "MON_FRI",
  "mon-sat": "MON_SAT",
  "mon-sun": "MON_SUN",
};

const DEFAULT_REPORTING_GROUP_ID = "a0000000-0000-4000-8000-000000000301";
const DEFAULT_REPORTING_GROUP_NAME = "Software Development";

/**
 * Extracts recipientEmail from dedupeKey format: "ruleId:isoDate:email".
 */
function extractRecipientEmail(dedupeKey: string): string {
  const emailMatch = dedupeKey.match(/Z:(.+)$/);
  return emailMatch?.[1] ?? "";
}

/**
 * Prisma implementation of AdminRepository.
 * Reads/writes users, projects, periods (reports), and reminder rules as AdminSnapshot.
 * All output is parsed through Zod schemas before returning (REPO-09).
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

  private async ensureFallbackReportingGroup(): Promise<string> {
    const existing = await this.prisma.reportingGroup.findFirst({
      where: { archived: false },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (existing) return existing.id;

    const created = await this.prisma.reportingGroup.upsert({
      where: { id: DEFAULT_REPORTING_GROUP_ID },
      create: {
        id: DEFAULT_REPORTING_GROUP_ID,
        name: DEFAULT_REPORTING_GROUP_NAME,
        description: "Default reporting group for newly provisioned users",
        archived: false,
      },
      update: { archived: false },
      select: { id: true },
    });
    return created.id;
  }

  /**
   * UFB-048 (Phase 48-B): map a Prisma `AppSettings` row to the wire shape.
   * The screaming-snake `WorkingDays` and `ReminderAudience` enums are
   * translated here (single boundary) so callers see only lowercase-hyphen.
   */
  private rowToAppSettings(row: {
    autoCreatePeriods: boolean;
    defaultDeadlineDays: number;
    periodLengthDays: number;
    workingDays: PrismaWorkingDays;
    gracePeriodHours: number;
    defaultTimezone: string;
    defaultReminderAudience: PrismaReminderAudience;
    notificationFromEmail: string | null;
    allowLateSubmissions: boolean;
    autoPublishAfterDeadline: boolean;
    autoArchiveWeeksAfterPublish: number;
    // UFB-051 (Phase 51-A): period-cycle knobs.
    firstDayOfWeek: number;
    deadlineDayOfWeek: number;
    deadlineTime: string;
    maxOpenPeriods: number;
    requireAllSectionsToPublish: boolean;
    allowReopenAfterPublish: boolean;
    reopenWindowHours: number;
  }): AppSettings {
    // UFB-047 / Phase 49-01: `departmentName` no longer flows through this
    // mapper — the column is being dropped in the same migration that
    // ships this code path. Brand identity lives on the `Organization`
    // singleton (Identity tab in Settings) and is exposed via
    // `OrganizationService` / `auth.me.organization`.
    return appSettingsSchema.parse({
      autoCreatePeriods: row.autoCreatePeriods,
      defaultDeadlineDays: row.defaultDeadlineDays,
      periodLengthDays: row.periodLengthDays,
      workingDays: workingDaysFromPrisma[row.workingDays],
      gracePeriodHours: row.gracePeriodHours,
      defaultTimezone: row.defaultTimezone,
      defaultReminderAudience: audienceFromPrisma[row.defaultReminderAudience],
      notificationFromEmail: row.notificationFromEmail,
      allowLateSubmissions: row.allowLateSubmissions,
      autoPublishAfterDeadline: row.autoPublishAfterDeadline,
      autoArchiveWeeksAfterPublish: row.autoArchiveWeeksAfterPublish,
      firstDayOfWeek: row.firstDayOfWeek,
      deadlineDayOfWeek: row.deadlineDayOfWeek,
      deadlineTime: row.deadlineTime,
      maxOpenPeriods: row.maxOpenPeriods,
      requireAllSectionsToPublish: row.requireAllSectionsToPublish,
      allowReopenAfterPublish: row.allowReopenAfterPublish,
      reopenWindowHours: row.reopenWindowHours,
    });
  }

  async getSettings(): Promise<AppSettings> {
    const row = await this.prisma.appSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton" },
      update: {},
    });

    return this.rowToAppSettings(row);
  }

  async updateSettings(data: Partial<AppSettings>): Promise<AppSettings> {
    // UFB-048: translate enum fields explicitly (mon-fri → MON_FRI, etc.)
    // before handing the payload to Prisma. Other fields pass through.
    // (UFB-047 / Phase 49-01: `departmentName` removed from the
    // AppSettings shape — see `rowToAppSettings` for the rationale.)
    const dbData: Record<string, unknown> = {};
    if (data.autoCreatePeriods !== undefined)
      dbData.autoCreatePeriods = data.autoCreatePeriods;
    if (data.defaultDeadlineDays !== undefined)
      dbData.defaultDeadlineDays = data.defaultDeadlineDays;
    if (data.periodLengthDays !== undefined)
      dbData.periodLengthDays = data.periodLengthDays;
    if (data.workingDays !== undefined)
      dbData.workingDays = workingDaysToPrisma[data.workingDays];
    if (data.gracePeriodHours !== undefined)
      dbData.gracePeriodHours = data.gracePeriodHours;
    if (data.defaultTimezone !== undefined)
      dbData.defaultTimezone = data.defaultTimezone;
    if (data.defaultReminderAudience !== undefined)
      dbData.defaultReminderAudience =
        audienceToPrisma[data.defaultReminderAudience];
    if (data.notificationFromEmail !== undefined)
      dbData.notificationFromEmail = data.notificationFromEmail;
    if (data.allowLateSubmissions !== undefined)
      dbData.allowLateSubmissions = data.allowLateSubmissions;
    if (data.autoPublishAfterDeadline !== undefined)
      dbData.autoPublishAfterDeadline = data.autoPublishAfterDeadline;
    if (data.autoArchiveWeeksAfterPublish !== undefined)
      dbData.autoArchiveWeeksAfterPublish = data.autoArchiveWeeksAfterPublish;
    if (data.firstDayOfWeek !== undefined)
      dbData.firstDayOfWeek = data.firstDayOfWeek;
    if (data.deadlineDayOfWeek !== undefined)
      dbData.deadlineDayOfWeek = data.deadlineDayOfWeek;
    if (data.deadlineTime !== undefined)
      dbData.deadlineTime = data.deadlineTime;
    if (data.maxOpenPeriods !== undefined)
      dbData.maxOpenPeriods = data.maxOpenPeriods;
    if (data.requireAllSectionsToPublish !== undefined)
      dbData.requireAllSectionsToPublish = data.requireAllSectionsToPublish;
    if (data.allowReopenAfterPublish !== undefined)
      dbData.allowReopenAfterPublish = data.allowReopenAfterPublish;
    if (data.reopenWindowHours !== undefined)
      dbData.reopenWindowHours = data.reopenWindowHours;

    const row = await this.prisma.appSettings.upsert({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        ...dbData,
      },
      update: dbData,
    });

    return this.rowToAppSettings(row);
  }

  async saveReportingGroup(group: ReportingGroup): Promise<ReportingGroup> {
    const row = await this.prisma.reportingGroup.upsert({
      where: { id: group.id },
      create: {
        id: group.id,
        name: group.name,
        description: group.description ?? null,
        archived: group.archived,
        headUserId: group.headUserId ?? null,
      },
      update: {
        name: group.name,
        description: group.description ?? null,
        archived: group.archived,
        headUserId: group.headUserId ?? null,
      },
    });

    return reportingGroupSchema.parse(row);
  }

  async archiveReportingGroup(groupId: string): Promise<ReportingGroup> {
    const row = await this.prisma.reportingGroup.update({
      where: { id: groupId },
      data: { archived: true },
    });

    return reportingGroupSchema.parse(row);
  }

  async saveStageAssignment(data: {
    userId: string;
    stageId: string;
    projectId: string;
  }): Promise<StageAssignment> {
    const existing = await this.prisma.stageAssignment.findFirst({
      where: { stageId: data.stageId, projectId: data.projectId },
      select: { id: true },
    });

    const row = existing
      ? await this.prisma.stageAssignment.update({
          where: { id: existing.id },
          data: { userId: data.userId },
          include: {
            stage: { select: { name: true } },
            user: { select: { name: true } },
          },
        })
      : await this.prisma.stageAssignment.create({
          data,
          include: {
            stage: { select: { name: true } },
            user: { select: { name: true } },
          },
        });

    return stageAssignmentSchema.parse({
      id: row.id,
      userId: row.userId,
      stageId: row.stageId,
      projectId: row.projectId,
      stageName: row.stage.name,
      userName: row.user.name,
    });
  }

  async deleteStageAssignment(id: string): Promise<void> {
    await this.prisma.stageAssignment.delete({ where: { id } });
  }

  async listStageAssignments(projectId: string): Promise<StageAssignment[]> {
    const rows = await this.prisma.stageAssignment.findMany({
      where: { projectId },
      include: {
        stage: { select: { name: true } },
        user: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return rows.map((row) =>
      stageAssignmentSchema.parse({
        id: row.id,
        userId: row.userId,
        stageId: row.stageId,
        projectId: row.projectId,
        stageName: row.stage.name,
        userName: row.user.name,
      }),
    );
  }

  // -------------------------------------------------------------------
  // UFB-036 (Phase 44-02): ReminderPolicy CRUD
  // -------------------------------------------------------------------

  async listReminderPolicies(): Promise<ReminderPolicy[]> {
    const rows = await this.prisma.reminderPolicy.findMany({
      orderBy: [{ kind: "asc" }, { offsetMinutes: "asc" }],
    });
    return rows.map((row) =>
      reminderPolicySchema.parse({
        id: row.id,
        kind: row.kind,
        offsetMinutes: row.offsetMinutes,
        timezone: row.timezone,
        audience: audienceFromPrisma[row.audience],
        active: row.active,
        // UFB-036 (Phase 44-04): surface the validity window so the
        // Reminders Tab can render and edit it.
        validFrom: row.validFrom,
        validUntil: row.validUntil,
      }),
    );
  }

  async saveReminderPolicy(policy: ReminderPolicy): Promise<ReminderPolicy> {
    const parsed = reminderPolicySchema.parse(policy);
    const data = {
      kind: parsed.kind,
      offsetMinutes: parsed.offsetMinutes,
      timezone: parsed.timezone,
      audience: audienceToPrisma[parsed.audience],
      active: parsed.active,
      validFrom: parsed.validFrom,
      validUntil: parsed.validUntil,
    };
    const row = await this.prisma.reminderPolicy.upsert({
      where: { id: parsed.id },
      create: { id: parsed.id, ...data },
      update: data,
    });
    return reminderPolicySchema.parse({
      id: row.id,
      kind: row.kind,
      offsetMinutes: row.offsetMinutes,
      timezone: row.timezone,
      audience: audienceFromPrisma[row.audience],
      active: row.active,
      validFrom: row.validFrom,
      validUntil: row.validUntil,
    });
  }

  /**
   * Soft-delete by flipping `active=false`. Hard delete is only allowed
   * when no `ReminderRule` row references this policy — this matches the
   * 44-01 schema decision (FK is `ON DELETE SET NULL` so a hard delete
   * would orphan rules silently). Caller surfaces the explicit guard.
   */
  async archiveReminderPolicy(policyId: string): Promise<void> {
    const derivedRuleCount = await this.prisma.reminderRule.count({
      where: { policyId },
    });
    if (derivedRuleCount === 0) {
      await this.prisma.reminderPolicy.delete({ where: { id: policyId } });
      return;
    }
    await this.prisma.reminderPolicy.update({
      where: { id: policyId },
      data: { active: false },
    });
  }

  async getSnapshot(): Promise<AdminSnapshot> {
    const [
      groups,
      users,
      projects,
      periods,
      reminderRules,
      reminderExecutions,
      reminderPolicies,
    ] = await Promise.all([
      this.prisma.reportingGroup.findMany({ orderBy: { name: "asc" } }),
      this.prisma.user.findMany({
        include: { reportingGroup: true },
        orderBy: { name: "asc" },
      }),
      this.prisma.project.findMany({
        include: { lead: true },
        orderBy: { name: "asc" },
      }),
      this.prisma.report.findMany({ orderBy: { periodStart: "desc" } }),
      this.prisma.reminderRule.findMany({ orderBy: { createdAt: "desc" } }),
      this.prisma.reminderExecution.findMany({
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.reminderPolicy.findMany({
        orderBy: [{ kind: "asc" }, { offsetMinutes: "asc" }],
      }),
    ]);

    return adminSnapshotSchema.parse({
      groups: groups.map((group) => reportingGroupSchema.parse(group)),
      users: users.map((u) =>
        adminUserSchema.parse({
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role,
          reportingGroupId: u.reportingGroupId,
          reportingGroupName: u.reportingGroup.name,
          // A2 (UAT-v7 2026-05-12): surface the soft-deactivation flag.
          isActive: u.isActive,
        }),
      ),
      projects: projects.map((p) =>
        adminProjectSchema.parse({
          id: p.id,
          name: p.name,
          archived: p.archived,
          leadId: p.leadId,
          leadName: p.lead.name,
        }),
      ),
      periods: periods.map((r) =>
        reportPeriodSchema.parse({
          id: r.id,
          periodStart: r.periodStart,
          periodEnd: r.periodEnd,
          deadline: r.deadline,
          status: r.status,
        }),
      ),
      reminderRules: reminderRules.map((rule) =>
        adminReminderRuleSchema.parse({
          id: rule.id,
          reportId: rule.reportId,
          // UFB-036 (Phase 44-04): expose the policy FK so the admin
          // UI can group derived rules under their owning policy.
          policyId: rule.policyId,
          kind: rule.kind,
          fireAt: rule.fireAt,
          timezone: rule.timezone,
          status: rule.status,
          version: rule.version,
        }),
      ),
      reminderExecutions: reminderExecutions.map((exec) =>
        adminReminderExecutionSchema.parse({
          id: exec.id,
          ruleId: exec.ruleId,
          reportId: null,
          dedupeKey: exec.dedupeKey,
          status: exec.status === "pending" ? "queued" : exec.status,
          scheduledFor: exec.createdAt,
          sentAt: exec.sentAt,
          recipientEmail: extractRecipientEmail(exec.dedupeKey),
          errorMessage: exec.error,
        }),
      ),
      // UFB-036 (Phase 44-02): policies surfaced inline so the admin
      // snapshot fetch is one round trip on the wire.
      policies: reminderPolicies.map((row) =>
        reminderPolicySchema.parse({
          id: row.id,
          kind: row.kind,
          offsetMinutes: row.offsetMinutes,
          timezone: row.timezone,
          audience: audienceFromPrisma[row.audience],
          active: row.active,
          validFrom: row.validFrom,
          validUntil: row.validUntil,
        }),
      ),
    });
  }

  async saveSnapshot(snapshot: AdminSnapshot): Promise<AdminSnapshot> {
    const currentGroups = await this.prisma.reportingGroup.findMany();
    const currentUsers = await this.prisma.user.findMany();
    const currentProjects = await this.prisma.project.findMany();
    const currentReports = await this.prisma.report.findMany();
    const currentRules = await this.prisma.reminderRule.findMany();

    // Upsert reporting groups before users so required User.reportingGroupId
    // can be validated by the database.
    const currentGroupIds = new Set(currentGroups.map((g) => g.id));
    for (const group of snapshot.groups) {
      if (currentGroupIds.has(group.id)) {
        await this.prisma.reportingGroup.update({
          where: { id: group.id },
          data: {
            name: group.name,
            description: group.description ?? null,
            archived: group.archived,
          },
        });
      } else {
        await this.prisma.reportingGroup.create({
          data: {
            id: group.id,
            name: group.name,
            description: group.description ?? null,
            archived: group.archived,
          },
        });
      }
    }

    const fallbackReportingGroupId =
      snapshot.groups.find((group) => !group.archived)?.id ??
      (await this.ensureFallbackReportingGroup());

    // Upsert users
    const currentUserIds = new Set(currentUsers.map((u) => u.id));
    const snapshotUserIds = new Set(snapshot.users.map((u) => u.id));

    for (const user of snapshot.users) {
      if (currentUserIds.has(user.id)) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            email: user.email,
            name: user.name,
            role: user.role,
            reportingGroupId: user.reportingGroupId ?? fallbackReportingGroupId,
          },
        });
      } else {
        await this.prisma.user.create({
          data: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            samlId: user.email,
            reportingGroupId: user.reportingGroupId ?? fallbackReportingGroupId,
          },
        });
      }
    }

    // Delete removed users (only those not referenced by sections/projects)
    const removedUserIds = [...currentUserIds].filter(
      (id) => !snapshotUserIds.has(id),
    );
    for (const userId of removedUserIds) {
      const hasReferences =
        (await this.prisma.reportSection.count({
          where: { authorId: userId },
        })) > 0 ||
        (await this.prisma.project.count({
          where: { leadId: userId },
        })) > 0;

      if (!hasReferences) {
        try {
          await this.prisma.user.delete({ where: { id: userId } });
        } catch (error: unknown) {
          // Handle FK constraint violations (Prisma P2003)
          const prismaError = error as { code?: string };
          if (prismaError.code === "P2003") {
            // Skip deletion if user is referenced by other tables
            continue;
          }
          throw error;
        }
      }
    }

    // Upsert projects (archive removed ones instead of deleting)
    const currentProjectIds = new Set(currentProjects.map((p) => p.id));
    const snapshotProjectIds = new Set(snapshot.projects.map((p) => p.id));

    for (const project of snapshot.projects) {
      if (currentProjectIds.has(project.id)) {
        await this.prisma.project.update({
          where: { id: project.id },
          data: {
            name: project.name,
            archived: project.archived,
            leadId: project.leadId,
          },
        });
      } else {
        await this.prisma.project.create({
          data: {
            id: project.id,
            name: project.name,
            archived: project.archived,
            leadId: project.leadId,
          },
        });
      }
    }

    // Archive removed projects
    const removedProjectIds = [...currentProjectIds].filter(
      (id) => !snapshotProjectIds.has(id),
    );
    if (removedProjectIds.length > 0) {
      await this.prisma.project.updateMany({
        where: { id: { in: removedProjectIds } },
        data: { archived: true },
      });
    }

    // Upsert report periods
    const currentReportIds = new Set(currentReports.map((r) => r.id));
    // UFB-036 (Phase 44-03): track which periods are NEW so we can run
    // PolicyApplicator on them AFTER the upsert loop commits. Updates
    // do not re-trigger the applicator — policies attach once at create.
    const newlyCreatedPeriods: Array<{ id: string; deadline: Date }> = [];

    for (const period of snapshot.periods) {
      if (currentReportIds.has(period.id)) {
        await this.prisma.report.update({
          where: { id: period.id },
          data: {
            periodStart: period.periodStart,
            periodEnd: period.periodEnd,
            deadline: period.deadline,
            status: period.status,
          },
        });
      } else {
        await this.prisma.report.create({
          data: {
            id: period.id,
            periodStart: period.periodStart,
            periodEnd: period.periodEnd,
            deadline: period.deadline,
            status: period.status,
          },
        });
        newlyCreatedPeriods.push({
          id: period.id,
          deadline: period.deadline,
        });
      }
    }

    // Upsert reminder rules
    const currentRuleIds = new Set(currentRules.map((r) => r.id));
    const snapshotRuleIds = new Set(snapshot.reminderRules.map((r) => r.id));

    for (const rule of snapshot.reminderRules) {
      const ruleData = {
        kind: rule.kind as "deadline" | "follow_up" | "escalation",
        fireAt: rule.fireAt,
        timezone: rule.timezone,
        status: rule.status as "active" | "paused",
        version: rule.version,
        reportId: rule.reportId || null,
      };

      if (currentRuleIds.has(rule.id)) {
        await this.prisma.reminderRule.update({
          where: { id: rule.id },
          data: ruleData,
        });
      } else {
        await this.prisma.reminderRule.create({
          data: { id: rule.id, ...ruleData },
        });
      }
    }

    // Delete removed reminder rules
    const removedRuleIds = [...currentRuleIds].filter(
      (id) => !snapshotRuleIds.has(id),
    );
    if (removedRuleIds.length > 0) {
      await this.prisma.reminderRule.deleteMany({
        where: { id: { in: removedRuleIds } },
      });
    }

    // UFB-036 (Phase 44-03): materialize one ReminderRule per active
    // policy on each newly-created Period. Run AFTER the per-row
    // commits so a failure in the applicator (e.g. unreachable Prisma
    // engine) cannot roll back the periods themselves.
    if (this.policyApplicator) {
      for (const newPeriod of newlyCreatedPeriods) {
        await this.policyApplicator.applyToPeriod(newPeriod);
      }
    }

    return this.getSnapshot();
  }

  // -------------------------------------------------------------------
  // UFB-052 (Phase 51-B): Admin Periods tab — list + archive + unarchive
  // -------------------------------------------------------------------

  /**
   * Fetch periods matching the supplied state set, sorted newest-first
   * by `periodStart`. Submission progress (submitted vs total section
   * count) is fetched in a single grouped query so the list endpoint
   * stays at O(1) round-trips regardless of page size.
   *
   * Uses the `(periodState, periodStart desc)` composite index from
   * 51-C — no plan-time index gap.
   */
  async listPeriodsByState(filter: {
    states: readonly PeriodState[];
    limit: number;
  }): Promise<PeriodRowFromRepo[]> {
    const reports = await this.prisma.report.findMany({
      where: { periodState: { in: filter.states as PeriodState[] } },
      orderBy: { periodStart: "desc" },
      take: filter.limit,
      select: {
        id: true,
        periodStart: true,
        periodEnd: true,
        deadline: true,
        publishedAt: true,
        periodState: true,
        periodStatus: true,
        archived: true,
        autoPublished: true,
        autoArchived: true,
      },
    });

    if (reports.length === 0) return [];

    const reportIds = reports.map((r) => r.id);

    // Section progress in two grouped queries (one for totals, one for
    // submitted). Cheaper than N per-period counts and cheaper than a
    // single `groupBy` with a `where: status: submitted` because the
    // totals query also reveals zero-total periods (newly created with
    // no sections yet — the auto-creator may not have run section
    // provisioning yet).
    const [totalRows, submittedRows] = await Promise.all([
      this.prisma.reportSection.groupBy({
        by: ["reportId"],
        where: { reportId: { in: reportIds } },
        _count: { _all: true },
      }),
      this.prisma.reportSection.groupBy({
        by: ["reportId"],
        where: { reportId: { in: reportIds }, status: "submitted" },
        _count: { _all: true },
      }),
    ]);

    const totalsById = new Map(
      totalRows.map((row) => [row.reportId, row._count._all]),
    );
    const submittedById = new Map(
      submittedRows.map((row) => [row.reportId, row._count._all]),
    );

    return reports.map((r) => ({
      id: r.id,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      deadline: r.deadline,
      publishedAt: r.publishedAt,
      periodState: r.periodState as PeriodState,
      periodStatus: r.periodStatus as PeriodStatus,
      archived: r.archived,
      autoPublished: r.autoPublished,
      autoArchived: r.autoArchived,
      submittedCount: submittedById.get(r.id) ?? 0,
      totalCount: totalsById.get(r.id) ?? 0,
    }));
  }

  /**
   * UFB-063: find the most recent Report whose [periodStart, periodEnd]
   * range overlaps the supplied half-open range. Used by the service's
   * pre-create overlap gate to surface the blocking row's date span.
   * Returns null when the range is free.
   *
   * Half-open intersect: a.start <= b.end AND a.end >= b.start.
   */
  async findOverlappingPeriod(input: {
    periodStart: Date;
    periodEnd: Date;
    /**
     * UFB-067: excluded id so the update path can re-run the overlap
     * gate without self-conflicting against the row being edited. The
     * Prisma `NOT: { id }` clause stays out of the WHERE when the
     * caller omits the field — pure additive change for create callers.
     */
    excludeId?: string;
  }): Promise<{ id: string; periodStart: Date; periodEnd: Date } | null> {
    const row = await this.prisma.report.findFirst({
      where: {
        periodStart: { lte: input.periodEnd },
        periodEnd: { gte: input.periodStart },
        ...(input.excludeId ? { NOT: { id: input.excludeId } } : {}),
      },
      orderBy: { periodStart: "desc" },
      select: { id: true, periodStart: true, periodEnd: true },
    });
    return row ?? null;
  }

  /**
   * UFB-063: mint a Report row with the supplied dates + initial state.
   * Mirrors `PeriodCreatorScheduler.runOnce`'s bare `report.create` —
   * `status` defaults to 'draft' and `periodStatus` defaults to 'open'
   * at the DB layer (see schema.prisma defaults). No PolicyApplicator
   * call here — the scheduler also skips it (pre-existing gap,
   * documented in the 063 SUMMARY); fixing both paths is deferred to
   * keep this plan additive.
   */
  async createPeriodManual(input: {
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
  }> {
    const created = await this.prisma.report.create({
      data: {
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        deadline: input.deadline,
        periodState: input.periodState,
        weekLabel: input.weekLabel,
      },
      select: {
        id: true,
        periodStart: true,
        periodEnd: true,
        deadline: true,
        periodState: true,
      },
    });
    return {
      id: created.id,
      periodStart: created.periodStart,
      periodEnd: created.periodEnd,
      deadline: created.deadline,
      periodState: created.periodState as PeriodState,
    };
  }

  /**
   * UFB-067: read a single Report's edit envelope. Used by the service's
   * updatePeriodManual to surface a `NOT_FOUND` error early and to grab
   * the `from`-snapshot for the audit envelope.
   */
  async readPeriodById(periodId: string): Promise<{
    id: string;
    periodStart: Date;
    periodEnd: Date;
    deadline: Date;
    weekLabel: string | null;
    periodState: PeriodState;
  } | null> {
    const row = await this.prisma.report.findUnique({
      where: { id: periodId },
      select: {
        id: true,
        periodStart: true,
        periodEnd: true,
        deadline: true,
        weekLabel: true,
        periodState: true,
      },
    });
    if (!row) return null;
    return {
      id: row.id,
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      deadline: row.deadline,
      weekLabel: row.weekLabel,
      periodState: row.periodState as PeriodState,
    };
  }

  /**
   * UFB-067: patch an existing Report's date envelope + weekLabel. The
   * service has already filtered `data` down to actually-changed fields,
   * so Prisma's partial-update semantics are exactly what we want — only
   * supplied keys are written, the rest of the row stays untouched.
   *
   * `periodState` is NOT touched here. State transitions belong to the
   * lifecycle actions (`publish`, `reopen`, `archive`, scheduler). The
   * Edit dialog only moves dates / label; if a date shift implies a
   * state transition, that's a follow-up plan.
   */
  async updatePeriodManual(input: {
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
    const updated = await this.prisma.report.update({
      where: { id: input.reportId },
      data: input.data,
      select: {
        id: true,
        periodStart: true,
        periodEnd: true,
        deadline: true,
        weekLabel: true,
        periodState: true,
      },
    });
    return {
      id: updated.id,
      periodStart: updated.periodStart,
      periodEnd: updated.periodEnd,
      deadline: updated.deadline,
      weekLabel: updated.weekLabel,
      periodState: updated.periodState as PeriodState,
    };
  }

  /**
   * UFB-052 (Phase 51-B): manual archive. Writes both the legacy
   * `archived` boolean and the new `periodState='archived'` atomically
   * so the two-state-machine invariant from 51-C (Open Question 1)
   * holds even when the auto-archiver scheduler hasn't run yet.
   */
  async archivePeriod(periodId: string): Promise<void> {
    await this.prisma.report.update({
      where: { id: periodId },
      data: {
        archived: true,
        periodState: "archived",
      },
    });
  }

  /**
   * UFB-052 (Phase 51-B): un-archive — flips `archived=false` and
   * derives the next `periodState` from the legacy tuple. The legacy
   * `(status, periodStatus)` pair is the only ground truth left after
   * a row was set to `'archived'`, so we read it on the same row and
   * project back:
   *
   *   status='published' OR periodStatus IN ('published','reopened')
   *     → periodState='published'
   *   else
   *     → periodState='open'
   *
   * The scheduled→open distinction is lost across an archive round-trip;
   * that is acceptable because admin archive of a SCHEDULED period is
   * a tiny edge case (the PeriodCreator scheduler would just re-mint
   * the row anyway). Documented in the 51-B SUMMARY.
   */
  async unarchivePeriod(
    periodId: string,
  ): Promise<{ nextPeriodState: PeriodState; nextPeriodStatus: PeriodStatus }> {
    const row = await this.prisma.report.findUnique({
      where: { id: periodId },
      select: { status: true, periodStatus: true },
    });
    if (!row) {
      throw new Error(`Report ${periodId} not found.`);
    }
    const nextPeriodState: PeriodState =
      row.status === "published" || row.periodStatus !== "open"
        ? "published"
        : "open";
    const nextPeriodStatus = row.periodStatus as PeriodStatus;
    await this.prisma.report.update({
      where: { id: periodId },
      data: {
        archived: false,
        periodState: nextPeriodState,
      },
    });
    return { nextPeriodState, nextPeriodStatus };
  }

  /**
   * A27: read a Report's status fields for delete-guard checks.
   * Returns null if not found.
   */
  async readReportForDelete(
    reportId: string,
  ): Promise<{ status: ReportStatus; periodStatus: PeriodStatus } | null> {
    const row = await this.prisma.report.findUnique({
      where: { id: reportId },
      select: { status: true, periodStatus: true },
    });
    if (!row) return null;
    return {
      status: row.status,
      periodStatus: row.periodStatus as PeriodStatus,
    };
  }

  /**
   * A27: delete a Report and cascade-delete all child rows via Prisma relations
   * (onDelete: Cascade on ReportSection, Item, Risk, Decision, Priority, etc.).
   */
  async deleteReport(reportId: string): Promise<void> {
    await this.prisma.report.delete({ where: { id: reportId } });
  }

  // -----------------------------------------------------------------
  // UFB-054 (Phase 56-B): Group ↔ Product M:M edge mutations + reads
  // -----------------------------------------------------------------

  /**
   * Idempotent attach via Prisma upsert on the (groupId, productId)
   * unique tuple. The `update: {}` branch is a no-op write so re-calls
   * return the existing row instead of throwing P2002. Returns the
   * canonical row (with server-assigned id + createdAt) so the service
   * can echo the createdAt into the audit envelope.
   */
  async attachProductToGroup(
    input: GroupProductEdgeInput,
  ): Promise<GroupProduct> {
    const row = await this.prisma.groupProduct.upsert({
      where: {
        groupId_productId: {
          groupId: input.groupId,
          productId: input.productId,
        },
      },
      create: {
        groupId: input.groupId,
        productId: input.productId,
      },
      update: {},
    });
    return groupProductSchema.parse(row);
  }

  /**
   * No-op safe detach. `deleteMany` on the unique tuple returns
   * `{ count: 0 }` if the edge is already absent (vs `delete` which
   * throws). This keeps the UI toggle resilient against double-clicks
   * and races without a pre-read.
   */
  async detachProductFromGroup(input: GroupProductEdgeInput): Promise<void> {
    await this.prisma.groupProduct.deleteMany({
      where: { groupId: input.groupId, productId: input.productId },
    });
  }

  /**
   * Return Projects attached to a ReportingGroup ordered by name. The
   * Project rows are projected to {@link AdminProject} so the UI
   * consumer can render alongside the existing snapshot.projects rows
   * without a separate shape.
   */
  async listGroupProducts(groupId: string): Promise<AdminProject[]> {
    const rows = await this.prisma.groupProduct.findMany({
      where: { groupId },
      include: { product: { include: { lead: true } } },
      orderBy: { product: { name: "asc" } },
    });
    return rows.map((row) =>
      adminProjectSchema.parse({
        id: row.product.id,
        name: row.product.name,
        archived: row.product.archived,
        leadId: row.product.leadId,
        leadName: row.product.lead.name,
      }),
    );
  }

  /**
   * Return ReportingGroups attached to a Project ordered by group name.
   */
  async listProductGroups(productId: string): Promise<ReportingGroup[]> {
    const rows = await this.prisma.groupProduct.findMany({
      where: { productId },
      include: { group: true },
      orderBy: { group: { name: "asc" } },
    });
    return rows.map((row) => reportingGroupSchema.parse(row.group));
  }
}
