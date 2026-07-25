// Factory-reset wipe + reseed for manual UAT; reuses seed-constants IDs for E2E stability.

import "dotenv/config";

import net from "node:net";

import { PrismaPg } from "@prisma/adapter-pg";
import {
  PeriodState,
  PeriodStatus,
  PrismaClient,
  ReminderAudience,
  ReminderRuleKind,
  ReminderRuleStatus,
  ReportSectionStatus,
  ReportStatus,
  Role,
} from "@prisma/client";
import pg from "pg";

import { assertNonProdDestructive } from "./_destructive-guard.js";
import {
  ACTIVE_REPORT_ID,
  DEFAULT_REPORTING_GROUP_ID,
  HEAD_USER_ID,
  LEAD_1_ID,
  LEAD_DMITRY_ID,
  LEAD_IGOR_ID,
  LEAD_MARIA_ID,
  LEAD_OLGA_ID,
  LEAD_SERGEY_ID,
  SEED_REPORTS,
  VIEWER_USER_ID,
} from "./seed-constants.js";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

type CountMap = Record<string, number>;

// Extra users/group so wipe lands with two groups (admin + finance head/lead).
const ADMIN_USER_ID = "a0000000-0000-4000-8000-000000000097";
const FINANCE_HEAD_USER_ID = "a0000000-0000-4000-8000-000000000095";
const FINANCE_LEAD_USER_ID = "a0000000-0000-4000-8000-000000000094";
const FINANCE_GROUP_ID = "a0000000-0000-4000-8000-000000000302";

// 6 active products (one per primary lead). IDs match the canonical
// `seed-simple.ts` mapping so existing E2E specs (DevOps-инструменты, etc.)
// keep working without rename churn.
const PROD_CRM = "a0000000-0000-4000-8000-000000000201"; // Маркетинговый портал → LEAD_1
const PROD_MOBILE = "a0000000-0000-4000-8000-000000000203"; // Платформа интеграций → Мария
const PROD_CLOUD = "a0000000-0000-4000-8000-000000000205"; // Внутренний BI → Игорь
const PROD_DEVOPS = "a0000000-0000-4000-8000-000000000207"; // DevOps-инструменты → Дмитрий
const PROD_PAYMENTS = "a0000000-0000-4000-8000-000000000209"; // Платёжный шлюз → Ольга
const PROD_HR = "a0000000-0000-4000-8000-00000000020b"; // HR-система → Сергей

const STAGE_PLAN = "a0000000-0000-4000-8000-000000000701";
const STAGE_ANALYSIS = "a0000000-0000-4000-8000-000000000702";
const STAGE_DESIGN = "a0000000-0000-4000-8000-000000000703";
const STAGE_DEV = "a0000000-0000-4000-8000-000000000704";
const STAGE_TEST = "a0000000-0000-4000-8000-000000000705";
const STAGE_DEVOPS = "a0000000-0000-4000-8000-000000000706";
const STAGE_SUPPORT = "a0000000-0000-4000-8000-000000000707";

function writeRedisCommand(command: string, ...args: string[]): Buffer {
  const parts = [command, ...args];
  return Buffer.from(
    `*${parts.length}\r\n${parts
      .map((part) => `$${Buffer.byteLength(part)}\r\n${part}`)
      .join("\r\n")}\r\n`,
    "utf8",
  );
}

export async function flushRedisDb(): Promise<
  { flushed: true } | { flushed: false; reason: string }
> {
  if (process.env.MANUAL_UAT_WIPE_FLUSH_REDIS === "false") {
    return { flushed: false, reason: "disabled-by-env" };
  }

  const host = process.env.REDIS_HOST ?? "localhost";
  const port = Number(process.env.REDIS_PORT ?? "6379");
  if (!Number.isInteger(port) || port <= 0) {
    return { flushed: false, reason: "invalid-redis-port" };
  }

  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({ flushed: false, reason: "timeout" });
    }, 5000);

    let response = "";
    socket.once("connect", () => {
      socket.write(writeRedisCommand("FLUSHDB"));
    });
    socket.on("data", (chunk) => {
      response += chunk.toString("utf8");
      if (!response.includes("\r\n") || settled) return;
      settled = true;
      clearTimeout(timer);
      socket.end();
      if (response.startsWith("+OK")) {
        resolve({ flushed: true });
      } else {
        resolve({ flushed: false, reason: response.trim().slice(0, 200) });
      }
    });
    socket.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ flushed: false, reason: error.message });
    });
    socket.once("close", () => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      resolve({ flushed: false, reason: "closed-before-reply" });
    });
  });
}

async function main() {
  assertNonProdDestructive("wipe-manual-uat");

  const result = await prisma.$transaction(
    async (tx) => {
      // FK-safe wipe: reminder rules before policies (RESTRICT); activities before groups.
      const deleted: CountMap = {
        reminderExecution: (await tx.reminderExecution.deleteMany({})).count,
        reminderRule: (await tx.reminderRule.deleteMany({})).count,
        reminderPolicy: (await tx.reminderPolicy.deleteMany({})).count,
        // priorityRank is a column on Item, cleared by item.deleteMany below —
        // no separate priority wipe.
        decision: (await tx.decision.deleteMany({})).count,
        risk: (await tx.risk.deleteMany({})).count,
        item: (await tx.item.deleteMany({})).count,
        stageStatus: (await tx.stageStatus.deleteMany({})).count,
        projectStatus: (await tx.projectStatus.deleteMany({})).count,
        reopenRequest: (await tx.reopenRequest.deleteMany({})).count,
        reportSection: (await tx.reportSection.deleteMany({})).count,
        // Statuses reference their activity; ProjectActivity.groupId and
        // ProjectActivityProduct.productId are RESTRICT, so every activity row
        // must drop before reportingGroup/project below or those deletes FK-fail.
        activityStatus: (await tx.activityStatus.deleteMany({})).count,
        projectActivityLead: (await tx.projectActivityLead.deleteMany({}))
          .count,
        projectActivityProduct: (await tx.projectActivityProduct.deleteMany({}))
          .count,
        projectActivity: (await tx.projectActivity.deleteMany({})).count,
        pdfExportJob: (await tx.pdfExportJob.deleteMany({})).count,
        carryOverRecord: (await tx.carryOverRecord.deleteMany({})).count,
        carryOverExecution: (await tx.carryOverExecution.deleteMany({})).count,
        report: (await tx.report.deleteMany({})).count,
        stageAssignment: (await tx.stageAssignment.deleteMany({})).count,
        groupProduct: (await tx.groupProduct.deleteMany({})).count,
        project: (await tx.project.deleteMany({})).count,
        stage: (await tx.stage.deleteMany({})).count,
        telegramBinding: (await tx.telegramBinding.deleteMany({})).count,
        viewerGroupAccess: (await tx.viewerGroupAccess.deleteMany({})).count,
        userActionLog: (await tx.userActionLog.deleteMany({})).count,
        user: (await tx.user.deleteMany({})).count,
        reportingGroup: (await tx.reportingGroup.deleteMany({})).count,
        organization: (await tx.organization.deleteMany({})).count,
        appSettings: (await tx.appSettings.deleteMany({})).count,
      };

      // Two groups so head dashboards have a realistic «pick a group» state.
      // headUserId is wired below after Users are created.
      await tx.reportingGroup.create({
        data: {
          id: DEFAULT_REPORTING_GROUP_ID,
          name: "Core Development",
          description: "Default reporting group for CustomReport demo users",
        },
      });
      await tx.reportingGroup.create({
        data: {
          id: FINANCE_GROUP_ID,
          name: "Finance",
          description: "Secondary demo group",
        },
      });

      // Re-uses canonical UUIDs from seed-constants so existing E2E specs
      // (admin-stage-reassignment, admin-groups) continue to match Игорь /
      // Мария / DevOps-инструменты by name.
      await tx.user.createMany({
        data: [
          {
            id: HEAD_USER_ID,
            email: "head@customreport.local",
            name: "Климов Антон Сергеевич",
            lastName: "Климов",
            firstName: "Антон",
            middleName: "Сергеевич",
            position: "Руководитель отдела",
            role: Role.head,
            samlId: "head-1",
            reportingGroupId: DEFAULT_REPORTING_GROUP_ID,
          },
          {
            id: VIEWER_USER_ID,
            email: "viewer@customreport.local",
            name: "Власова Дарья Игоревна",
            lastName: "Власова",
            firstName: "Дарья",
            middleName: "Игоревна",
            position: "Директор по развитию",
            role: Role.viewer,
            samlId: "viewer-1",
            reportingGroupId: null,
          },
          {
            id: ADMIN_USER_ID,
            email: "admin@customreport.local",
            name: "Баленков Михаил Владимирович",
            lastName: "Баленков",
            firstName: "Михаил",
            middleName: "Владимирович",
            position: "Системный администратор",
            role: Role.admin,
            samlId: "admin-1",
            reportingGroupId: DEFAULT_REPORTING_GROUP_ID,
          },
          {
            id: LEAD_1_ID,
            email: "lead1@customreport.local",
            name: "Иванов Василий Петрович",
            lastName: "Иванов",
            firstName: "Василий",
            middleName: "Петрович",
            position: "Тимлид",
            role: Role.lead,
            samlId: "lead-1",
            reportingGroupId: DEFAULT_REPORTING_GROUP_ID,
          },
          {
            id: LEAD_MARIA_ID,
            email: "maria@customreport.local",
            name: "Кузнецова Мария Андреевна",
            lastName: "Кузнецова",
            firstName: "Мария",
            middleName: "Андреевна",
            position: "Тимлид",
            role: Role.lead,
            samlId: "lead-maria",
            reportingGroupId: DEFAULT_REPORTING_GROUP_ID,
          },
          {
            id: LEAD_IGOR_ID,
            email: "igor@customreport.local",
            name: "Волков Игорь Олегович",
            lastName: "Волков",
            firstName: "Игорь",
            middleName: "Олегович",
            position: "Ведущий разработчик",
            role: Role.lead,
            samlId: "lead-igor",
            reportingGroupId: DEFAULT_REPORTING_GROUP_ID,
          },
          {
            id: LEAD_DMITRY_ID,
            email: "dmitry@customreport.local",
            name: "Соколов Дмитрий Максимович",
            lastName: "Соколов",
            firstName: "Дмитрий",
            middleName: "Максимович",
            position: "Тимлид",
            role: Role.lead,
            samlId: "lead-dmitry",
            reportingGroupId: DEFAULT_REPORTING_GROUP_ID,
          },
          {
            id: LEAD_OLGA_ID,
            email: "olga@customreport.local",
            name: "Никитина Ольга Сергеевна",
            lastName: "Никитина",
            firstName: "Ольга",
            middleName: "Сергеевна",
            position: "Ведущий аналитик",
            role: Role.lead,
            samlId: "lead-olga",
            reportingGroupId: FINANCE_GROUP_ID,
          },
          {
            id: LEAD_SERGEY_ID,
            email: "sergey@customreport.local",
            name: "Тихонов Сергей Дмитриевич",
            lastName: "Тихонов",
            firstName: "Сергей",
            middleName: "Дмитриевич",
            position: "Тимлид",
            role: Role.lead,
            samlId: "lead-sergey",
            reportingGroupId: FINANCE_GROUP_ID,
          },
          // Finance group — own head + one lead so the second group is not
          // a ghost.
          {
            id: FINANCE_HEAD_USER_ID,
            email: "finance-head@customreport.local",
            name: "Наталья П.",
            lastName: "Наталья",
            firstName: "П",
            middleName: null,
            position: null,
            role: Role.head,
            samlId: "finance-head-1",
            reportingGroupId: FINANCE_GROUP_ID,
          },
          {
            id: FINANCE_LEAD_USER_ID,
            email: "finance-lead@customreport.local",
            name: "Артём З.",
            lastName: "Артём",
            firstName: "З",
            middleName: null,
            position: null,
            role: Role.lead,
            samlId: "finance-lead-1",
            reportingGroupId: FINANCE_GROUP_ID,
          },
        ],
      });

      // Wire group leaders now that the FK targets exist.
      await tx.reportingGroup.update({
        where: { id: DEFAULT_REPORTING_GROUP_ID },
        data: { headUserId: HEAD_USER_ID },
      });
      await tx.reportingGroup.update({
        where: { id: FINANCE_GROUP_ID },
        data: { headUserId: FINANCE_HEAD_USER_ID },
      });

      // Viewer gets read-only access to the default group out of the box so
      // /viewer/* lands on a non-empty dashboard.
      await tx.viewerGroupAccess.create({
        data: {
          id: "a0000000-0000-4000-8000-000000000901",
          viewerUserId: VIEWER_USER_ID,
          groupId: DEFAULT_REPORTING_GROUP_ID,
        },
      });

      await tx.project.createMany({
        data: [
          {
            id: PROD_CRM,
            name: "Маркетинговый портал",
            leadId: LEAD_1_ID,
            archived: false,
          },
          {
            id: PROD_MOBILE,
            name: "Платформа интеграций",
            leadId: LEAD_MARIA_ID,
            archived: false,
          },
          {
            id: PROD_CLOUD,
            name: "Внутренний BI",
            leadId: LEAD_IGOR_ID,
            archived: false,
          },
          {
            id: PROD_DEVOPS,
            name: "DevOps-инструменты",
            leadId: LEAD_DMITRY_ID,
            archived: false,
          },
          {
            id: PROD_PAYMENTS,
            name: "Платёжный шлюз",
            leadId: LEAD_OLGA_ID,
            archived: false,
          },
          {
            id: PROD_HR,
            name: "HR-система",
            leadId: LEAD_SERGEY_ID,
            archived: false,
          },
        ],
      });

      // Current invariant is one owning group per product. Keep the demo
      // split aligned with the seeded lead's reporting group so Products,
      // Groups, dashboard scoping, and viewer access all tell the same story.
      await tx.groupProduct.createMany({
        data: [
          { groupId: DEFAULT_REPORTING_GROUP_ID, productId: PROD_CRM },
          { groupId: DEFAULT_REPORTING_GROUP_ID, productId: PROD_MOBILE },
          { groupId: DEFAULT_REPORTING_GROUP_ID, productId: PROD_CLOUD },
          { groupId: DEFAULT_REPORTING_GROUP_ID, productId: PROD_DEVOPS },
          { groupId: FINANCE_GROUP_ID, productId: PROD_PAYMENTS },
          { groupId: FINANCE_GROUP_ID, productId: PROD_HR },
        ],
      });

      await tx.stage.createMany({
        data: [
          { id: STAGE_PLAN, name: "Planning", sortOrder: 0 },
          { id: STAGE_ANALYSIS, name: "Analysis", sortOrder: 1 },
          { id: STAGE_DESIGN, name: "Design", sortOrder: 2 },
          { id: STAGE_DEV, name: "Development", sortOrder: 3 },
          { id: STAGE_TEST, name: "Testing", sortOrder: 4 },
          { id: STAGE_DEVOPS, name: "DevOps", sortOrder: 5 },
          { id: STAGE_SUPPORT, name: "Support", sortOrder: 6 },
        ],
      });

      // Primary lead owns all 7 stages of CRM; other leads own Development of
      // their primary product so the SDLC pipeline picker has data.
      const allStageIds = [
        STAGE_PLAN,
        STAGE_ANALYSIS,
        STAGE_DESIGN,
        STAGE_DEV,
        STAGE_TEST,
        STAGE_DEVOPS,
        STAGE_SUPPORT,
      ];
      await tx.stageAssignment.createMany({
        data: [
          ...allStageIds.map((stageId, idx) => ({
            id: `b0000000-0000-4000-8000-0000000010${(idx + 1)
              .toString()
              .padStart(2, "0")}`,
            projectId: PROD_CRM,
            stageId,
            userId: LEAD_1_ID,
          })),
          {
            id: "b0000000-0000-4000-8000-000000000002",
            projectId: PROD_MOBILE,
            stageId: STAGE_DEV,
            userId: LEAD_MARIA_ID,
          },
          {
            id: "b0000000-0000-4000-8000-000000000003",
            projectId: PROD_CLOUD,
            stageId: STAGE_DEV,
            userId: LEAD_IGOR_ID,
          },
          {
            id: "b0000000-0000-4000-8000-000000000004",
            projectId: PROD_DEVOPS,
            stageId: STAGE_DEV,
            userId: LEAD_DMITRY_ID,
          },
          {
            id: "b0000000-0000-4000-8000-000000000005",
            projectId: PROD_PAYMENTS,
            stageId: STAGE_DEV,
            userId: LEAD_OLGA_ID,
          },
          {
            id: "b0000000-0000-4000-8000-000000000006",
            projectId: PROD_HR,
            stageId: STAGE_DEV,
            userId: LEAD_SERGEY_ID,
          },
        ],
      });

      await tx.organization.create({
        data: {
          id: "singleton",
          shortName: "PEO",
          fullName: "Product Engineering & Operations",
        },
      });

      // Empty `data` hydrates every column from its @default(...) so future
      // schema additions don't silently drift.
      await tx.appSettings.create({ data: { id: "singleton" } });

      const report = await tx.report.create({
        data: {
          id: ACTIVE_REPORT_ID,
          periodStart: new Date(SEED_REPORTS.active.periodStart),
          periodEnd: new Date(SEED_REPORTS.active.periodEnd),
          deadline: new Date(SEED_REPORTS.active.deadline),
          weekLabel: SEED_REPORTS.active.weekLabel,
          periodStatus: PeriodStatus.open,
          periodState: PeriodState.open,
          status: ReportStatus.draft,
        },
      });

      // One empty draft section per primary lead so /lead/report has an
      // open form on login. Finance lead also gets a section so the second
      // group's head sees one.
      const leadIds = [
        LEAD_1_ID,
        LEAD_MARIA_ID,
        LEAD_IGOR_ID,
        LEAD_DMITRY_ID,
        LEAD_OLGA_ID,
        LEAD_SERGEY_ID,
        FINANCE_LEAD_USER_ID,
      ];
      const sections: { id: string; authorId: string }[] = [];
      for (const authorId of leadIds) {
        const section = await tx.reportSection.create({
          data: {
            reportId: report.id,
            authorId,
            status: ReportSectionStatus.draft,
          },
          select: { id: true, authorId: true },
        });
        sections.push(section);
      }

      // Mirrors seed-simple.ts so the reminder dashboard has visible policy
      // rows AND concrete derived rules under each policy.
      const deadlineFire = new Date(SEED_REPORTS.active.deadline);
      const escalationFire = new Date(deadlineFire);
      escalationFire.setUTCHours(escalationFire.getUTCHours() + 2);
      await tx.reminderPolicy.createMany({
        data: [
          {
            id: "a0000000-0000-4000-8000-000000000a01",
            kind: ReminderRuleKind.deadline,
            offsetMinutes: -1440,
            timezone: "Europe/Moscow",
            audience: ReminderAudience.LEAD_WITH_DRAFT,
            active: true,
          },
          {
            id: "a0000000-0000-4000-8000-000000000a02",
            kind: ReminderRuleKind.escalation,
            timezone: "Europe/Moscow",
            offsetMinutes: 120,
            audience: ReminderAudience.HEAD_OF_LATE,
            active: true,
          },
        ],
      });
      await tx.reminderRule.createMany({
        data: [
          {
            id: "a0000000-0000-4000-8000-000000000801",
            reportId: ACTIVE_REPORT_ID,
            policyId: "a0000000-0000-4000-8000-000000000a01",
            kind: ReminderRuleKind.deadline,
            fireAt: deadlineFire,
            timezone: "Europe/Moscow",
            status: ReminderRuleStatus.active,
            version: 1,
          },
          {
            id: "a0000000-0000-4000-8000-000000000802",
            reportId: ACTIVE_REPORT_ID,
            policyId: "a0000000-0000-4000-8000-000000000a02",
            kind: ReminderRuleKind.escalation,
            fireAt: escalationFire,
            timezone: "Europe/Moscow",
            status: ReminderRuleStatus.active,
            version: 1,
          },
        ],
      });

      const after = {
        users: await tx.user.count(),
        leads: await tx.user.count({ where: { role: Role.lead } }),
        reportingGroups: await tx.reportingGroup.count(),
        projects: await tx.project.count({ where: { archived: false } }),
        groupProducts: await tx.groupProduct.count(),
        stages: await tx.stage.count(),
        stageAssignments: await tx.stageAssignment.count(),
        organization: await tx.organization.count(),
        appSettings: await tx.appSettings.count(),
        reports: await tx.report.count(),
        openReports: await tx.report.count({
          where: { periodStatus: PeriodStatus.open },
        }),
        sections: await tx.reportSection.count(),
        reminderRules: await tx.reminderRule.count(),
        reminderPolicies: await tx.reminderPolicy.count(),
        userActionLog: await tx.userActionLog.count(),
        telegramBindings: await tx.telegramBinding.count(),
      };

      return {
        deleted,
        after,
        activeReport: {
          id: report.id,
          weekLabel: report.weekLabel,
          periodStart: report.periodStart.toISOString(),
          periodEnd: report.periodEnd.toISOString(),
          leadSections: sections.length,
        },
      };
    },
    {
      // Default Prisma tx timeout is 5s; full wipe + 30+ creates needs more
      // headroom. tRPC ceiling for the manual-uat variant is 60s
      // (trpc.router.ts), so stay well under.
      timeout: 30_000,
      maxWait: 10_000,
    },
  );

  const redis = await flushRedisDb();

  console.log(
    `[wipe-manual-uat] Done: ${JSON.stringify({ ...result, redis })}`,
  );
}

if (typeof require !== "undefined" && require.main === module) {
  void main()
    .catch((error: unknown) => {
      console.error("[wipe-manual-uat] Failed:", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
      await pool.end();
    });
}
