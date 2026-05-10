import { Injectable } from "@nestjs/common";
import {
  adminSnapshotSchema,
  adminUserSchema,
  adminProjectSchema,
  appSettingsSchema,
  reminderPolicySchema,
  reportingGroupSchema,
  stageAssignmentSchema,
  reportPeriodSchema,
  adminReminderRuleSchema,
  adminReminderExecutionSchema,
  type AdminSnapshot,
  type AppSettings,
  type PeriodCadence,
  type ReminderAudience,
  type ReminderPolicy,
  type ReportingGroup,
  type StageAssignment,
  type WorkingDays,
} from "@customreport/shared";
import {
  ReminderAudience as PrismaReminderAudience,
  WorkingDays as PrismaWorkingDays,
} from "@prisma/client";

import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { PolicyApplicatorService } from "../reminders/policy-applicator.service";
import type { AdminRepository } from "./admin.service";

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
    // UFB-051 (Phase 51-A): period-cycle knobs. `periodCadence` is stored
    // as TEXT in Postgres so admin-level extensions (`monthly`, …) do not
    // require a Prisma migration — the zod enum on the wire is the only
    // place that needs an update.
    firstDayOfWeek: number;
    deadlineDayOfWeek: number;
    deadlineTime: string;
    periodCadence: string;
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
      // UFB-051 (Phase 51-A): pass-through. `periodCadence` round-trips as
      // a plain string — `appSettingsSchema` re-parses through the zod
      // enum guard so a hand-corrupted DB row (e.g. `'biweekly'` typo)
      // would still be caught at the service boundary.
      firstDayOfWeek: row.firstDayOfWeek,
      deadlineDayOfWeek: row.deadlineDayOfWeek,
      deadlineTime: row.deadlineTime,
      periodCadence: row.periodCadence as PeriodCadence,
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
    // UFB-051 (Phase 51-A): period-cycle knobs. Plain pass-through — the
    // zod schema on the service boundary has already validated ranges
    // (`firstDayOfWeek`/`deadlineDayOfWeek` ∈ [1..7], `deadlineTime`
    // matches HH:MM, `periodCadence` ∈ {weekly, bi-weekly}, …).
    if (data.firstDayOfWeek !== undefined)
      dbData.firstDayOfWeek = data.firstDayOfWeek;
    if (data.deadlineDayOfWeek !== undefined)
      dbData.deadlineDayOfWeek = data.deadlineDayOfWeek;
    if (data.deadlineTime !== undefined)
      dbData.deadlineTime = data.deadlineTime;
    if (data.periodCadence !== undefined)
      dbData.periodCadence = data.periodCadence;
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
}
