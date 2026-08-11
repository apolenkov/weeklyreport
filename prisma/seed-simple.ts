/**
 * SIMPLE seed — minimal demo data for live presentation.
 *
 * Clean slate with just enough rows to show every feature without overwhelming:
 *   - 1 head, 1 viewer, 1 admin, 6 leads (RU names)
 *   - 6 products (one per lead)
 *   - 7 SDLC stages
 *   - 8 reports (active, published, archived history, scheduled future)
 *   - Per-lead: project + stage status, items, risk, decisions, priorities
 *   - 2 reminder policies + derived rules (deadline T-24h, escalation T+2h)
 *
 * Differs from seed.ts (advanced, 12 products / 6 leads / dozens of items)
 * which is the canonical fixture for tests. This simple seed is for
 * `pnpm db:seed:middle` only. The supported seed orchestrator runs this
 * relational writer before snapshot finalization and readiness checks.
 *
 * The active period is anchored to the *current* week (Monday..Sunday in
 * UTC) so weeklyReport.get always finds an open report covering today. A
 * static window would drift into the past once its week ends →
 * WeeklyReportDomainError 'No active report period found' on every page load.
 *
 * Every Item.text / Risk.{risk,impact,mitigation} / Decision.text /
 * Priority.text / Project.name / User.name is in Russian Cyrillic. Realistic
 * content for a Development department demo.
 *
 * Run:
 *   pnpm db:seed:middle
 */

import "dotenv/config";

import { createHash } from "node:crypto";

import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  Role,
  ReportSectionStatus,
  ReportStatus,
  TrafficLightStatus,
  ItemType,
  ItemWorkflowStatus,
  PeriodStatus,
  PeriodState,
  ReminderAudience,
  ReminderRuleKind,
  ReminderRuleStatus,
  ReopenRequestStatus,
  UserActionStatus,
} from "@prisma/client";
import { assertNonProdDestructive } from "./_destructive-guard.js";
import { stabilizeSeedRecordIdentities } from "./seed-coverage-check.js";
import {
  ADMIN_EMAIL,
  HEAD_EMAIL,
  LEAD_1_EMAIL,
  VIEWER_EMAIL,
} from "./seed-constants.js";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const HEAD_ID = "a0000000-0000-4000-8000-000000000099";
const VIEWER_ID = "a0000000-0000-4000-8000-000000000098";
const ADMIN_ID = "a0000000-0000-4000-8000-000000000097";
const LEAD_1 = "a0000000-0000-4000-8000-000000000011";
const LEAD_MARIA = "a0000000-0000-4000-8000-000000000012";
const LEAD_IGOR = "a0000000-0000-4000-8000-000000000013";
const LEAD_DMITRY = "a0000000-0000-4000-8000-000000000014";
const LEAD_OLGA = "a0000000-0000-4000-8000-000000000015";
const LEAD_SERGEY = "a0000000-0000-4000-8000-000000000016";
// PM (non-technical) leads — MOBILE/CLOUD/DEVOPS only.
// Boris (LEAD_MOBILE_PM) also owns Plan+Analysis+Design on PROD_CRM,
// Vasily owns Dev+Test+DevOps+Support (4/7) — enables cross-author readonly UAT demo.
const LEAD_MOBILE_PM = "a0000000-0000-4000-8000-000000000022";
const LEAD_CLOUD_PM = "a0000000-0000-4000-8000-000000000023";
const LEAD_DEVOPS_PM = "a0000000-0000-4000-8000-000000000024";
// Activity-only lead: attached to an activity but owning ZERO products, so the
// activity-only-submit relaxation (a section with no product content) is an
// exercised path rather than dead code. No Project.leadId ever points here.
const LEAD_ACTIVITY_ONLY = "a0000000-0000-4000-8000-000000000025";

const PROD_CRM = "a0000000-0000-4000-8000-000000000201";
const PROD_MOBILE = "a0000000-0000-4000-8000-000000000203";
const PROD_CLOUD = "a0000000-0000-4000-8000-000000000205";
const PROD_DEVOPS = "a0000000-0000-4000-8000-000000000207";
const PROD_PAYMENTS = "a0000000-0000-4000-8000-000000000209";
const PROD_HR = "a0000000-0000-4000-8000-00000000020b";
// Vasily's 3 extra products (small-MVP demo — product-switcher + co-author overlay)
const PROD_CRM_SALES = "a0000000-0000-4000-8000-00000000020d";
const PROD_CRM_DATA = "a0000000-0000-4000-8000-00000000020f";
const PROD_CRM_360 = "a0000000-0000-4000-8000-000000000211";

const STAGE_PLAN = "a0000000-0000-4000-8000-000000000701";
const STAGE_ANALYSIS = "a0000000-0000-4000-8000-000000000702";
const STAGE_DESIGN = "a0000000-0000-4000-8000-000000000703";
const STAGE_DEV = "a0000000-0000-4000-8000-000000000704";
const STAGE_TEST = "a0000000-0000-4000-8000-000000000705";
const STAGE_DEVOPS = "a0000000-0000-4000-8000-000000000706";
const STAGE_SUPPORT = "a0000000-0000-4000-8000-000000000707";

const REPORT_ACTIVE = "a0000000-0000-4000-8000-000000000001";
const REPORT_PUBLISHED = "a0000000-0000-4000-8000-000000000002";
const DEFAULT_REPORTING_GROUP_ID = "a0000000-0000-4000-8000-000000000301";
// Second group so head scoping can be tested (head only sees own group's leads)
const FINANCE_GROUP_ID = "a0000000-0000-4000-8000-000000000302";
const POLICY_DEADLINE = "a0000000-0000-4000-8000-000000000a01";
const POLICY_ESCALATION = "a0000000-0000-4000-8000-000000000a02";

const deterministicSeedId = (...parts: readonly (string | number)[]): string => {
  const digest = createHash("sha256")
    .update(parts.join(":"), "utf8")
    .digest("hex")
    .slice(0, 12);
  return `a0000000-0000-4000-8000-${digest}`;
};

// Activity-only lead fixture anchors (own id range, distinct from the ca/cb/cc
// product-activity rows below). One activity, its lead link + product label,
// the lead's ACTIVE section and its per-activity status.
const ACTIVITY_ONLY_ID = "a0000000-0000-4000-8000-00000000cae0";
const ACTIVITY_ONLY_LEAD_LINK_ID = "a0000000-0000-4000-8000-00000000cbe0";
const ACTIVITY_ONLY_STATUS_ID = "a0000000-0000-4000-8000-00000000cce0";
const ACTIVITY_ONLY_PRODUCT_LINK_ID = "a0000000-0000-4000-8000-00000000cde0";
const ACTIVITY_ONLY_SECTION_ID = "a0000000-0000-4000-8000-00000000040a";

// ---- Date helpers ----
// Compute the current ISO week in UTC so the active period always covers
// "today" no matter when the seed runs. Mirrors the derivation in
// prisma/seed-constants.ts so both seeds agree on the period bounds.
function mondayOfWeekUTC(d: Date): Date {
  const monday = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  // ISO week: Monday=0..Sunday=6
  const dayNum = (monday.getUTCDay() + 6) % 7;
  monday.setUTCDate(monday.getUTCDate() - dayNum);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

function plusDaysUTC(d: Date, days: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + days);
  return r;
}

function endOfDayUTC(d: Date): Date {
  const r = new Date(d);
  r.setUTCHours(23, 59, 59, 0);
  return r;
}

function isoWeekNumber(d: Date): number {
  const t = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const dayNum = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const firstThursdayDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(
    firstThursday.getUTCDate() - firstThursdayDayNum + 3,
  );
  return (
    1 +
    Math.round(
      (t.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000),
    )
  );
}

const NOW = new Date();
const ACTIVE_MONDAY = mondayOfWeekUTC(NOW);
const ACTIVE_SUNDAY = endOfDayUTC(plusDaysUTC(ACTIVE_MONDAY, 6));
const ACTIVE_FRIDAY_DEADLINE = (() => {
  const friday = plusDaysUTC(ACTIVE_MONDAY, 4);
  return new Date(
    Date.UTC(
      friday.getUTCFullYear(),
      friday.getUTCMonth(),
      friday.getUTCDate(),
      15,
      0,
      0,
      0,
    ),
  );
})();
const PREV_MONDAY = plusDaysUTC(ACTIVE_MONDAY, -7);
const PREV_SUNDAY = endOfDayUTC(plusDaysUTC(PREV_MONDAY, 6));
const PREV_FRIDAY_DEADLINE = (() => {
  const friday = plusDaysUTC(PREV_MONDAY, 4);
  return new Date(
    Date.UTC(
      friday.getUTCFullYear(),
      friday.getUTCMonth(),
      friday.getUTCDate(),
      15,
      0,
      0,
      0,
    ),
  );
})();
const PREV_SUBMIT_AT = plusDaysUTC(PREV_MONDAY, 3); // Thursday of previous week

// Extra historical + future periods so the Periods admin tab and
// /reports archive show realistic data instead of a 1-row "0/1 Submission"
// dashboard. Historical = published (deeper history), future = open
// (so admins can preview upcoming weeks). Each period gets a deterministic
// UUID so re-running the seed is idempotent.
function fridayDeadlineFor(monday: Date): Date {
  const friday = plusDaysUTC(monday, 4);
  return new Date(
    Date.UTC(
      friday.getUTCFullYear(),
      friday.getUTCMonth(),
      friday.getUTCDate(),
      15,
      0,
      0,
      0,
    ),
  );
}

type ExtraReportSeed = {
  id: string;
  monday: Date;
  status: ReportStatus;
  periodStatus: PeriodStatus;
  publishedAt?: Date;
};

const EXTRA_REPORTS: ExtraReportSeed[] = [
  // 4 historical published periods (oldest → most recent before PREV)
  {
    id: "a0000000-0000-4000-8000-000000000003",
    monday: plusDaysUTC(ACTIVE_MONDAY, -35),
    status: ReportStatus.published,
    periodStatus: PeriodStatus.published,
    publishedAt: endOfDayUTC(plusDaysUTC(ACTIVE_MONDAY, -29)),
  },
  {
    id: "a0000000-0000-4000-8000-000000000004",
    monday: plusDaysUTC(ACTIVE_MONDAY, -28),
    status: ReportStatus.published,
    periodStatus: PeriodStatus.published,
    publishedAt: endOfDayUTC(plusDaysUTC(ACTIVE_MONDAY, -22)),
  },
  {
    id: "a0000000-0000-4000-8000-000000000005",
    monday: plusDaysUTC(ACTIVE_MONDAY, -21),
    status: ReportStatus.published,
    periodStatus: PeriodStatus.published,
    publishedAt: endOfDayUTC(plusDaysUTC(ACTIVE_MONDAY, -15)),
  },
  {
    id: "a0000000-0000-4000-8000-000000000006",
    monday: plusDaysUTC(ACTIVE_MONDAY, -14),
    status: ReportStatus.published,
    periodStatus: PeriodStatus.published,
    publishedAt: endOfDayUTC(plusDaysUTC(ACTIVE_MONDAY, -8)),
  },
  // 2 future open periods (next + week after)
  {
    id: "a0000000-0000-4000-8000-000000000007",
    monday: plusDaysUTC(ACTIVE_MONDAY, 7),
    status: ReportStatus.draft,
    periodStatus: PeriodStatus.open,
  },
  {
    id: "a0000000-0000-4000-8000-000000000008",
    monday: plusDaysUTC(ACTIVE_MONDAY, 14),
    status: ReportStatus.draft,
    periodStatus: PeriodStatus.open,
  },
];

const ACTIVE_REMINDER_DEADLINE_FIRE = plusDaysUTC(ACTIVE_FRIDAY_DEADLINE, 0);
const ACTIVE_REMINDER_ESCALATION_FIRE = (() => {
  const r = new Date(ACTIVE_FRIDAY_DEADLINE);
  r.setUTCHours(r.getUTCHours() + 2);
  return r;
})();

async function main() {
  // Destructive-guard: refuse on prod-looking DATABASE_URL.
  assertNonProdDestructive("seed-simple");

  console.log("[seed-simple] Wiping existing data...");
  // Delete in FK-safe order. ReopenRequest references ReportSection → must
  // go before ReportSection deletes. Other CASCADE FKs (ProjectStatus →
  // ReportSection, Items → ReportSection, etc.) flow naturally.
  //
  // TelegramBinding → User: drop before User.
  // GroupProduct → Project + ReportingGroup: drop before Project.
  await prisma.reminderExecution.deleteMany({});
  await prisma.reminderRule.deleteMany({});
  await prisma.reminderPolicy.deleteMany({});
  await prisma.decision.deleteMany({});
  await prisma.risk.deleteMany({});
  await prisma.item.deleteMany({});
  await prisma.stageStatus.deleteMany({});
  await prisma.projectStatus.deleteMany({});
  // project-activity-reporting: delete before ReportingGroup/User/Project.
  // ActivityStatus.activityId and ProjectActivity.groupId are RESTRICT, so
  // statuses drop before their activities and activities before their group.
  await prisma.activityStatus.deleteMany({});
  await prisma.projectActivityLead.deleteMany({});
  // ProjectActivityProduct cascades on activity delete, but drop it explicitly
  // to mirror the other activity children and keep the wipe order obvious.
  await prisma.projectActivityProduct.deleteMany({});
  await prisma.projectActivity.deleteMany({});
  await prisma.reopenRequest.deleteMany({});
  await prisma.reportSection.deleteMany({});
  await prisma.pdfExportJob.deleteMany({});
  await prisma.carryOverRecord.deleteMany({});
  await prisma.carryOverExecution.deleteMany({});
  await prisma.report.deleteMany({});
  await prisma.stageAssignment.deleteMany({});
  await prisma.groupProduct.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.stage.deleteMany({});
  await prisma.telegramBinding.deleteMany({});
  await prisma.userActionLog.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.reportingGroup.deleteMany({});

  console.log("[seed-simple] Creating reporting groups...");
  await prisma.reportingGroup.create({
    data: {
      id: DEFAULT_REPORTING_GROUP_ID,
      name: "Software Development",
      description: "Default reporting group for CustomReport demo users",
    },
  });
  // Finance group — LEAD_OLGA + LEAD_SERGEY assigned here so head (in
  // Software Development) only sees 4 leads, proving group-scope isolation.
  await prisma.reportingGroup.create({
    data: {
      id: FINANCE_GROUP_ID,
      name: "Finance",
      description: "Finance and HR reporting group",
    },
  });

  console.log("[seed-simple] Creating organization + app settings...");
  await prisma.organization.upsert({
    where: { id: "singleton" },
    update: {
      shortName: "Demo",
      fullName: "Example Software Department",
    },
    create: {
      id: "singleton",
      shortName: "Demo",
      fullName: "Example Software Department",
    },
  });
  await prisma.appSettings.upsert({
    where: { id: "singleton" },
    update: {
      autoCreatePeriods: false,
      defaultDeadlineDays: 5,
      periodLengthDays: 7,
      gracePeriodHours: 24,
      defaultTimezone: "Europe/Moscow",
      defaultReminderAudience: ReminderAudience.LEAD_WITH_DRAFT,
      allowLateSubmissions: true,
      autoPublishAfterDeadline: false,
      autoArchiveWeeksAfterPublish: 0,
      deadlineTime: "18:00",
      allowReopenAfterPublish: true,
      reopenWindowHours: 72,
    },
    create: {
      id: "singleton",
      autoCreatePeriods: false,
      defaultDeadlineDays: 5,
      periodLengthDays: 7,
      gracePeriodHours: 24,
      defaultTimezone: "Europe/Moscow",
      defaultReminderAudience: ReminderAudience.LEAD_WITH_DRAFT,
      allowLateSubmissions: true,
      autoPublishAfterDeadline: false,
      autoArchiveWeeksAfterPublish: 0,
      deadlineTime: "18:00",
      allowReopenAfterPublish: true,
      reopenWindowHours: 72,
    },
  });
  await prisma.aiProviderControl.upsert({
    where: { id: "singleton" },
    update: { activeConfigurationId: null, enabled: false },
    create: { id: "singleton", activeConfigurationId: null, enabled: false },
  });

  console.log("[seed-simple] Creating users (RU names)...");
  await prisma.user.createMany({
    data: [
      {
        id: HEAD_ID,
        email: HEAD_EMAIL,
        name: "Кедров Антон Сергеевич",
        lastName: "Кедров",
        firstName: "Антон",
        middleName: "Сергеевич",
        position: "Руководитель отдела",
        role: Role.head,
        samlId: "head-1",
        reportingGroupId: DEFAULT_REPORTING_GROUP_ID,
      },
      {
        id: VIEWER_ID,
        email: VIEWER_EMAIL,
        name: "Вязова Дарья Игоревна",
        lastName: "Вязова",
        firstName: "Дарья",
        middleName: "Игоревна",
        position: "Директор по развитию",
        role: Role.viewer,
        samlId: "viewer-1",
        reportingGroupId: null,
      },
      {
        id: ADMIN_ID,
        email: ADMIN_EMAIL,
        name: "Берёзов Михаил Владимирович",
        lastName: "Берёзов",
        firstName: "Михаил",
        middleName: "Владимирович",
        position: "Системный администратор",
        role: Role.admin,
        samlId: "admin-1",
        reportingGroupId: DEFAULT_REPORTING_GROUP_ID,
      },
      {
        id: LEAD_1,
        email: LEAD_1_EMAIL,
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
        id: LEAD_MARIA,
        email: "maria@customreport.local",
        name: "Каштанова Мария Андреевна",
        lastName: "Каштанова",
        firstName: "Мария",
        middleName: "Андреевна",
        position: "Тимлид",
        role: Role.lead,
        samlId: "lead-maria",
        reportingGroupId: DEFAULT_REPORTING_GROUP_ID,
      },
      {
        id: LEAD_IGOR,
        email: "igor@customreport.local",
        name: "Ветров Игорь Олегович",
        lastName: "Ветров",
        firstName: "Игорь",
        middleName: "Олегович",
        position: "Ведущий разработчик",
        role: Role.lead,
        samlId: "lead-igor",
        reportingGroupId: DEFAULT_REPORTING_GROUP_ID,
      },
      {
        id: LEAD_DMITRY,
        email: "dmitry@customreport.local",
        name: "Соснов Дмитрий Максимович",
        lastName: "Соснов",
        firstName: "Дмитрий",
        middleName: "Максимович",
        position: "Тимлид",
        role: Role.lead,
        samlId: "lead-dmitry",
        reportingGroupId: DEFAULT_REPORTING_GROUP_ID,
      },
      {
        // Finance group lead — Olga and Sergey are in Finance so the
        // Software Development head (Anton K.) does NOT see them in their
        // dashboard. This proves group-scope isolation end-to-end.
        id: LEAD_OLGA,
        email: "olga@customreport.local",
        name: "Незабудкина Ольга Сергеевна",
        lastName: "Незабудкина",
        firstName: "Ольга",
        middleName: "Сергеевна",
        position: "Ведущий аналитик",
        role: Role.lead,
        samlId: "lead-olga",
        reportingGroupId: FINANCE_GROUP_ID,
      },
      {
        id: LEAD_SERGEY,
        email: "sergey@customreport.local",
        name: "Тополев Сергей Дмитриевич",
        lastName: "Тополев",
        firstName: "Сергей",
        middleName: "Дмитриевич",
        position: "Тимлид",
        role: Role.lead,
        samlId: "lead-sergey",
        reportingGroupId: FINANCE_GROUP_ID,
      },
      // Non-technical PM leads in Development group (MOBILE/CLOUD/DEVOPS only)
      {
        id: LEAD_MOBILE_PM,
        email: "boris@customreport.local",
        name: "Сиренев Борис",
        lastName: "Сиренев",
        firstName: "Борис",
        middleName: null,
        position: null,
        role: Role.lead,
        samlId: "lead-mobile-pm",
        reportingGroupId: DEFAULT_REPORTING_GROUP_ID,
      },
      {
        id: LEAD_CLOUD_PM,
        email: "viktor@customreport.local",
        name: "Липов Виктор",
        lastName: "Липов",
        firstName: "Виктор",
        middleName: null,
        position: null,
        role: Role.lead,
        samlId: "lead-cloud-pm",
        reportingGroupId: DEFAULT_REPORTING_GROUP_ID,
      },
      {
        id: LEAD_DEVOPS_PM,
        email: "galina@customreport.local",
        name: "Малиновая Галина",
        lastName: "Малиновая",
        firstName: "Галина",
        middleName: null,
        position: null,
        role: Role.lead,
        samlId: "lead-devops-pm",
        reportingGroupId: DEFAULT_REPORTING_GROUP_ID,
      },
      {
        // Activity-only lead: reports a cross-cutting activity, owns no product.
        id: LEAD_ACTIVITY_ONLY,
        email: "activity-lead@customreport.local",
        name: "Фиалков Роман Аркадьевич",
        lastName: "Фиалков",
        firstName: "Роман",
        middleName: "Аркадьевич",
        position: "Ведущий инженер сопровождения",
        role: Role.lead,
        samlId: "lead-activity-only",
        reportingGroupId: DEFAULT_REPORTING_GROUP_ID,
      },
    ],
  });

  console.log("[seed-simple] Creating products (RU names)...");
  await prisma.project.createMany({
    data: [
      {
        id: PROD_CRM,
        name: "Маркетинговый портал",
        leadId: LEAD_1,
        archived: false,
      },
      {
        id: PROD_MOBILE,
        name: "Платформа интеграций",
        leadId: LEAD_MARIA,
        archived: false,
      },
      {
        id: PROD_CLOUD,
        name: "Внутренний BI",
        leadId: LEAD_IGOR,
        archived: false,
      },
      {
        id: PROD_DEVOPS,
        name: "DevOps-инструменты",
        leadId: LEAD_DMITRY,
        archived: false,
      },
      {
        id: PROD_PAYMENTS,
        name: "Платёжный шлюз",
        leadId: LEAD_OLGA,
        archived: false,
      },
      { id: PROD_HR, name: "HR-система", leadId: LEAD_SERGEY, archived: false },
      // Vasily's extra products for small-MVP demo (product-switcher needs ≥2)
      {
        id: PROD_CRM_SALES,
        name: "CRM-Sales Hub",
        leadId: LEAD_1,
        archived: false,
      },
      {
        id: PROD_CRM_DATA,
        name: "CRM-Data Lake",
        leadId: LEAD_1,
        archived: false,
      },
      {
        id: PROD_CRM_360,
        name: "CRM-Customer 360",
        leadId: LEAD_1,
        archived: false,
      },
    ],
  });

  // GroupProduct: one owning group per product (@@unique([productId])).
  // Product group is the report grouping source of truth, so every product
  // gets an explicit edge that matches its lead's reporting group.
  await prisma.groupProduct.createMany({
    data: [
      { groupId: DEFAULT_REPORTING_GROUP_ID, productId: PROD_CRM },
      { groupId: DEFAULT_REPORTING_GROUP_ID, productId: PROD_MOBILE },
      { groupId: DEFAULT_REPORTING_GROUP_ID, productId: PROD_CLOUD },
      { groupId: DEFAULT_REPORTING_GROUP_ID, productId: PROD_DEVOPS },
      { groupId: FINANCE_GROUP_ID, productId: PROD_PAYMENTS },
      { groupId: FINANCE_GROUP_ID, productId: PROD_HR },
      // Vasily's extra products belong to the same group as PROD_CRM
      { groupId: DEFAULT_REPORTING_GROUP_ID, productId: PROD_CRM_SALES },
      { groupId: DEFAULT_REPORTING_GROUP_ID, productId: PROD_CRM_DATA },
      { groupId: DEFAULT_REPORTING_GROUP_ID, productId: PROD_CRM_360 },
    ],
    skipDuplicates: true,
  });

  console.log("[seed-simple] Creating stages...");
  await prisma.stage.createMany({
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

  // A full 7-stage single-owner fixture exists (Vasily on PROD_CRM_DATA /
  // PROD_CRM_360, below) so the case "lead assigned everywhere shows up
  // correctly on /lead/report" is exercised end-to-end. Other leads keep a
  // single-Development assignment — the dashboard variety they provide is
  // still useful and the all-7 case only needs one fixture.
  console.log(
    "[seed-simple] Creating stage assignments (W6: Vasily=Dev/Test/DevOps/Support, Boris=Plan, Victor=Analysis, Galina=Design on PROD_CRM)...",
  );
  const allStageIds = [
    STAGE_PLAN,
    STAGE_ANALYSIS,
    STAGE_DESIGN,
    STAGE_DEV,
    STAGE_TEST,
    STAGE_DEVOPS,
    STAGE_SUPPORT,
  ];
  // Vasily owns only the tech stages (4/7) on PROD_CRM.
  // Boris (LEAD_MOBILE_PM) owns the PM stages (3/7) — enables cross-author readonly UAT demo.
  const vasilyCrmStages = [STAGE_DEV, STAGE_TEST, STAGE_DEVOPS, STAGE_SUPPORT];
  await prisma.stageAssignment.createMany({
    data: [
      ...vasilyCrmStages.map((stageId, idx) => ({
        id: `b0000000-0000-4000-8000-0000000010${(idx + 1).toString().padStart(2, "0")}`,
        projectId: PROD_CRM,
        stageId,
        userId: LEAD_1,
      })),
      {
        id: "b0000000-0000-4000-8000-000000000002",
        projectId: PROD_MOBILE,
        stageId: STAGE_DEV,
        userId: LEAD_MARIA,
      },
      {
        id: "b0000000-0000-4000-8000-000000000003",
        projectId: PROD_CLOUD,
        stageId: STAGE_DEV,
        userId: LEAD_IGOR,
      },
      {
        id: "b0000000-0000-4000-8000-000000000004",
        projectId: PROD_DEVOPS,
        stageId: STAGE_DEV,
        userId: LEAD_DMITRY,
      },
      {
        id: "b0000000-0000-4000-8000-000000000005",
        projectId: PROD_PAYMENTS,
        stageId: STAGE_DEV,
        userId: LEAD_OLGA,
      },
      {
        id: "b0000000-0000-4000-8000-000000000006",
        projectId: PROD_HR,
        stageId: STAGE_DEV,
        userId: LEAD_SERGEY,
      },
      // PM leads — Plan/Analysis stages (non-tech focus)
      // MOBILE-PM: Plan + Analysis + Design
      {
        id: "b0000000-0000-4000-8000-000000000023",
        projectId: PROD_MOBILE,
        stageId: STAGE_PLAN,
        userId: LEAD_MOBILE_PM,
      },
      {
        id: "b0000000-0000-4000-8000-000000000024",
        projectId: PROD_MOBILE,
        stageId: STAGE_ANALYSIS,
        userId: LEAD_MOBILE_PM,
      },
      {
        id: "b0000000-0000-4000-8000-000000000025",
        projectId: PROD_MOBILE,
        stageId: STAGE_DESIGN,
        userId: LEAD_MOBILE_PM,
      },
      // CLOUD-PM: Plan + Analysis + Design
      {
        id: "b0000000-0000-4000-8000-000000000026",
        projectId: PROD_CLOUD,
        stageId: STAGE_PLAN,
        userId: LEAD_CLOUD_PM,
      },
      {
        id: "b0000000-0000-4000-8000-000000000027",
        projectId: PROD_CLOUD,
        stageId: STAGE_ANALYSIS,
        userId: LEAD_CLOUD_PM,
      },
      {
        id: "b0000000-0000-4000-8000-000000000028",
        projectId: PROD_CLOUD,
        stageId: STAGE_DESIGN,
        userId: LEAD_CLOUD_PM,
      },
      // DEVOPS-PM: Plan + Analysis + Support
      {
        id: "b0000000-0000-4000-8000-000000000029",
        projectId: PROD_DEVOPS,
        stageId: STAGE_PLAN,
        userId: LEAD_DEVOPS_PM,
      },
      {
        id: "b0000000-0000-4000-8000-000000000030",
        projectId: PROD_DEVOPS,
        stageId: STAGE_ANALYSIS,
        userId: LEAD_DEVOPS_PM,
      },
      {
        id: "b0000000-0000-4000-8000-000000000031",
        projectId: PROD_DEVOPS,
        stageId: STAGE_DESIGN,
        userId: LEAD_DEVOPS_PM,
      },
      // 3-contributor split on PROD_CRM for cross-author UAT demo.
      // Boris=Planning, Victor=Analysis, Galina=Design (@@unique([stageId, projectId])).
      // Vasily retains Dev+Test+DevOps+Support (4/7 stages).
      {
        id: "b0000000-0000-4000-8000-000000000033",
        projectId: PROD_CRM,
        stageId: STAGE_PLAN,
        userId: LEAD_MOBILE_PM,
      },
      {
        id: "b0000000-0000-4000-8000-000000000034",
        projectId: PROD_CRM,
        stageId: STAGE_ANALYSIS,
        userId: LEAD_CLOUD_PM,
      },
      {
        id: "b0000000-0000-4000-8000-000000000035",
        projectId: PROD_CRM,
        stageId: STAGE_DESIGN,
        userId: LEAD_DEVOPS_PM,
      },
      // Vasily owns stages on his 3 extra products.
      // On PROD_CRM_SALES Boris (LEAD_MOBILE_PM) owns STAGE_PLAN (co-author demo),
      // so Vasily gets the remaining 6 stages (Analysis through Support).
      // On PROD_CRM_DATA and PROD_CRM_360 Vasily owns all 7 stages.
      ...allStageIds
        .filter((s) => s !== STAGE_PLAN)
        .map((stageId, idx) => ({
          id: `b0000000-0000-4000-8000-0000000011${(idx + 1).toString().padStart(2, "0")}`,
          projectId: PROD_CRM_SALES,
          stageId,
          userId: LEAD_1,
        })),
      ...allStageIds.map((stageId, idx) => ({
        id: `b0000000-0000-4000-8000-0000000012${(idx + 1).toString().padStart(2, "0")}`,
        projectId: PROD_CRM_DATA,
        stageId,
        userId: LEAD_1,
      })),
      ...allStageIds.map((stageId, idx) => ({
        id: `b0000000-0000-4000-8000-0000000013${(idx + 1).toString().padStart(2, "0")}`,
        projectId: PROD_CRM_360,
        stageId,
        userId: LEAD_1,
      })),
      // Co-author: Boris (LEAD_MOBILE_PM) owns Plan stage on PROD_CRM_SALES
      // (@@unique([stageId, projectId]) — one owner per stage×product pair).
      // Boris = PM → Planning; Vasily = tech lead → Analysis+Dev+Test+DevOps+Design+Support.
      {
        id: "b0000000-0000-4000-8000-000000000032",
        projectId: PROD_CRM_SALES,
        stageId: STAGE_PLAN,
        userId: LEAD_MOBILE_PM,
      },
    ],
  });

  console.log(
    "[seed-simple] Creating reports (active=current week, published=previous week)...",
  );
  await prisma.report.createMany({
    data: [
      {
        id: REPORT_ACTIVE,
        periodStart: ACTIVE_MONDAY,
        periodEnd: ACTIVE_SUNDAY,
        deadline: ACTIVE_FRIDAY_DEADLINE,
        weekLabel: `Week ${isoWeekNumber(ACTIVE_MONDAY)}`,
        periodStatus: PeriodStatus.open,
        status: ReportStatus.draft,
        periodState: PeriodState.open,
      },
      {
        id: REPORT_PUBLISHED,
        periodStart: PREV_MONDAY,
        periodEnd: PREV_SUNDAY,
        deadline: PREV_FRIDAY_DEADLINE,
        weekLabel: `Week ${isoWeekNumber(PREV_MONDAY)}`,
        periodStatus: PeriodStatus.published,
        status: ReportStatus.published,
        publishedAt: PREV_SUNDAY,
        publishedById: HEAD_ID,
        periodState: PeriodState.published,
      },
      ...EXTRA_REPORTS.map((r) => {
        const periodEnd = endOfDayUTC(plusDaysUTC(r.monday, 6));
        const deadline = fridayDeadlineFor(r.monday);
        const isPublished = r.status === ReportStatus.published;

        return {
          id: r.id,
          periodStart: r.monday,
          periodEnd,
          deadline,
          weekLabel: `Week ${isoWeekNumber(r.monday)}`,
          periodStatus: r.periodStatus,
          status: r.status,
          archived: isPublished,
          periodState: isPublished
            ? PeriodState.archived
            : PeriodState.scheduled,
          publishedAt: r.publishedAt,
          publishedById: r.publishedAt ? HEAD_ID : null,
        };
      }),
    ],
  });

  console.log(
    "[seed-simple] Creating sections + items + risks + priorities (RU)...",
  );
  // Active report — 6 sections, one per lead. Mix of statuses + traffic lights
  // so the dashboard has visible variety. `name` is the user's FULL display
  // name; it seeds each decision's `owner` purely as the displayed author label.
  // Edit/Delete rights are decided id-based from the section's authorId (the
  // `foreign` flag), NOT by matching this name — so the value need not equal
  // `data.currentUser.name`. `label` is the short chip form, used only in demo
  // prose strings.
  type LeadCfg = {
    id: string;
    productId: string;
    status: ReportSectionStatus;
    lightStatus: TrafficLightStatus;
    label: string;
    name: string;
  };
  const leads: LeadCfg[] = [
    {
      id: LEAD_1,
      productId: PROD_CRM,
      status: ReportSectionStatus.draft,
      lightStatus: TrafficLightStatus.red,
      label: "Василий И.",
      name: "Иванов Василий Петрович",
    },
    {
      id: LEAD_MARIA,
      productId: PROD_MOBILE,
      status: ReportSectionStatus.submitted,
      lightStatus: TrafficLightStatus.yellow,
      label: "Мария К.",
      name: "Каштанова Мария Андреевна",
    },
    {
      id: LEAD_IGOR,
      productId: PROD_CLOUD,
      status: ReportSectionStatus.draft,
      lightStatus: TrafficLightStatus.green,
      label: "Игорь В.",
      name: "Ветров Игорь Олегович",
    },
    {
      id: LEAD_DMITRY,
      productId: PROD_DEVOPS,
      status: ReportSectionStatus.submitted,
      lightStatus: TrafficLightStatus.green,
      label: "Дмитрий С.",
      name: "Соснов Дмитрий Максимович",
    },
    {
      id: LEAD_OLGA,
      productId: PROD_PAYMENTS,
      status: ReportSectionStatus.draft,
      lightStatus: TrafficLightStatus.yellow,
      label: "Ольга Н.",
      name: "Незабудкина Ольга Сергеевна",
    },
    {
      id: LEAD_SERGEY,
      productId: PROD_HR,
      status: ReportSectionStatus.draft,
      lightStatus: TrafficLightStatus.green,
      label: "Сергей Т.",
      name: "Тополев Сергей Дмитриевич",
    },
    // PM leads — non-technical, Plan/Analysis/Design focus
    {
      id: LEAD_MOBILE_PM,
      productId: PROD_MOBILE,
      status: ReportSectionStatus.draft,
      lightStatus: TrafficLightStatus.yellow,
      label: "Борис С.",
      name: "Сиренев Борис",
    },
    {
      id: LEAD_CLOUD_PM,
      productId: PROD_CLOUD,
      status: ReportSectionStatus.draft,
      lightStatus: TrafficLightStatus.green,
      label: "Виктор Л.",
      name: "Липов Виктор",
    },
    {
      id: LEAD_DEVOPS_PM,
      productId: PROD_DEVOPS,
      status: ReportSectionStatus.draft,
      lightStatus: TrafficLightStatus.yellow,
      label: "Галина М.",
      name: "Малиновая Галина",
    },
  ];

  const ALL_PRODUCT_IDS: readonly string[] = [
    PROD_CRM,
    PROD_MOBILE,
    PROD_CLOUD,
    PROD_DEVOPS,
    PROD_PAYMENTS,
    PROD_HR,
    PROD_CRM_SALES,
    PROD_CRM_DATA,
    PROD_CRM_360,
  ];

  // RU content for each lead. Realistic weekly status updates.
  type LeadContent = {
    currentItems: {
      text: string;
      tag: string;
      status: ItemWorkflowStatus;
      carriedOver?: boolean;
    }[];
    nextItems: { text: string; tag: string; status?: ItemWorkflowStatus }[];
    risk?: {
      risk: string;
      impact: string;
      mitigation: string;
      severity: "at-risk" | "blocked";
    };
    decisions: {
      text: string;
      impact: string;
      deadline?: Date;
    }[];
    priorities: string[];
  };

  const contentByLead: Record<string, LeadContent> = {
    [LEAD_1]: {
      currentItems: [
        {
          text: "Завершил рефакторинг модуля авторизации в Маркетинговом портале",
          tag: "feature",
          status: ItemWorkflowStatus.in_progress,
        },
        {
          text: "Зафиксил 4 бага по интеграции SDK с CRM",
          tag: "bugfix",
          status: ItemWorkflowStatus.done,
        },
        {
          text: "Перенёс A/B тесты на новую инфраструктуру",
          tag: "infra",
          status: ItemWorkflowStatus.in_progress,
          carriedOver: true,
        },
        // Paused exemplar — the middle tier must show every Progress state.
        {
          text: "Миграция шаблонов писем на паузе: ждём финальный брендбук",
          tag: "feature",
          status: ItemWorkflowStatus.paused,
        },
      ],
      nextItems: [
        { text: "Запланировал ревью архитектуры с платформенной командой", tag: "ops" },
        { text: "Подготовка демо для квартального ревью", tag: "feature" },
        // Postponed exemplar — consciously pushed beyond this period.
        {
          text: "Апгрейд SDK статистики отложили до стабилизации API партнёра",
          tag: "infra",
          status: ItemWorkflowStatus.postponed,
        },
      ],
      risk: {
        risk: "Риск: внешний API контрагента нестабилен на пике трафика",
        impact: "Влияние: задержка релиза Q2 на одну неделю",
        mitigation:
          "Митигация: фолбэк через очередь повтора + эскалация партнёру",
        // The demo's blocked pill derives from THIS risk (no stored blocked
        // item status exists) — keep the severity explicit.
        severity: "blocked",
      },
      decisions: [
        {
          text: "Решение: переезд на новый IdP до конца месяца",
          impact: "Закрывает риск устаревшего OAuth-провайдера",
        },
        {
          text: "Решение: согласовать наём двух middle-разработчиков на Q3",
          impact: "Разгружает критический путь по интеграциям",
          deadline: plusDaysUTC(ACTIVE_MONDAY, 14),
        },
      ],
      priorities: [
        "Стабилизация production-релиза Маркетингового портала",
        "Ревью архитектуры с платформенной командой до пятницы",
        "Найм middle-разработчика (собеседования на этой неделе)",
      ],
    },
    [LEAD_MARIA]: {
      currentItems: [
        {
          text: "Закрыли 12 из 15 регресс-кейсов чекаута",
          tag: "feature",
          status: ItemWorkflowStatus.in_progress,
        },
        {
          text: "Подключили contract-тесты с провайдером платежей",
          tag: "infra",
          status: ItemWorkflowStatus.done,
        },
        {
          text: "Подготовили smoke-тесты для прода",
          tag: "ops",
          status: ItemWorkflowStatus.in_progress,
        },
      ],
      nextItems: [
        {
          text: "Сценарии валидации промокодов (включая edge-cases)",
          tag: "feature",
        },
        {
          text: "Тесты сохранности корзины при смене устройства",
          tag: "feature",
        },
      ],
      risk: {
        risk: "Риск: провайдер платежей выкатывает breaking changes без анонса",
        impact: "Влияние: возможные простои чекаута на 1-2 часа",
        mitigation: "Митигация: контракт-тесты в CI + фича-флаг для отката",
        severity: "at-risk",
      },
      decisions: [
        {
          text: "Решение: завести E2E-сьют чекаута в обязательный ночной прогон",
          impact: "Снижает риск регрессий в проде на ~70%",
        },
        {
          text: "Решение: согласовать выделенный bug-bash день перед релизом",
          impact: "Закрывает остаточные P2-баги до raise-the-floor",
          deadline: plusDaysUTC(ACTIVE_MONDAY, 10),
        },
      ],
      priorities: [
        "Подписать регресс-сьют (15 из 15 кейсов зелёных)",
        "Стабилизировать чекаут (закрыть последние 3 P2-бага)",
        "Завести контракт-тесты с провайдером платежей в CI",
      ],
    },
    [LEAD_IGOR]: {
      currentItems: [
        {
          text: "Тюнинг pool_size в PgBouncer: p99 latency упало на 22%",
          tag: "infra",
          status: ItemWorkflowStatus.done,
        },
        {
          text: "Подключили GPU autoscaling по custom metrics",
          tag: "infra",
          status: ItemWorkflowStatus.in_progress,
        },
        {
          text: "Обновили DR-runbook (multi-region failover checklist)",
          tag: "ops",
          status: ItemWorkflowStatus.done,
        },
      ],
      nextItems: [
        {
          text: "Dry-run multi-region failover (запланирован на четверг)",
          tag: "ops",
        },
        {
          text: "Финализировать ADR по миграции на новый shard-балансировщик",
          tag: "infra",
        },
      ],
      decisions: [
        {
          text: "Решение: утвердить maintenance-window для миграции PgBouncer (Сб 02:00 МСК)",
          impact: "Закрывает tech-debt по пулу соединений",
          deadline: plusDaysUTC(ACTIVE_MONDAY, 5),
        },
        {
          text: "Решение: выделить бюджет на observability stack v2",
          impact: "Снижает MTTR инцидентов в DevOps на 30%",
        },
      ],
      priorities: [
        "Закатить новый pool_size PgBouncer на прод после dry-run",
        "Подтвердить GPU autoscaling на нагрузочном тесте",
        "Опубликовать обновлённый DR-runbook для дежурных",
      ],
    },
    [LEAD_DMITRY]: {
      currentItems: [
        {
          text: "Миграция CI/CD на GitHub Actions: 8 из 12 пайплайнов перенесены",
          tag: "infra",
          status: ItemWorkflowStatus.in_progress,
        },
        {
          text: "Интеграция security scanner в pre-merge (блокирует Critical/High)",
          tag: "infra",
          status: ItemWorkflowStatus.done,
        },
        {
          text: "Тюнинг WAF: ложных срабатываний минус 40%",
          tag: "ops",
          status: ItemWorkflowStatus.done,
        },
      ],
      nextItems: [
        {
          text: "Автоматизация ротации секретов (Vault transit-engine)",
          tag: "infra",
        },
        { text: "Оптимизация build-cache в Docker BuildKit", tag: "infra" },
      ],
      decisions: [
        {
          text: "Решение: дать зелёный свет фазовой раскатке WAF в shadow-mode",
          impact: "Снижает риск инцидентов на проде, безопасный rollback",
        },
        {
          text: "Решение: выделить SDET-инженера на покрытие security-сценариев",
          impact: "Закрывает гэп по автотестам безопасности до релиза",
        },
      ],
      priorities: [
        "Финализировать миграцию CI/CD на GitHub Actions",
        "Раскатать тюнинг WAF после shadow-mode валидации",
        "Автоматизировать ротацию секретов через Vault transit",
      ],
    },
    [LEAD_OLGA]: {
      currentItems: [
        {
          text: "Закрыли интеграцию 3DS v2 — пилот на 5% трафика",
          tag: "feature",
          status: ItemWorkflowStatus.in_progress,
        },
        {
          text: "Перевели аутентификацию на короткие сессии (refresh 24 ч)",
          tag: "feature",
          status: ItemWorkflowStatus.done,
        },
        {
          text: "Починили двойное списание при timeout (idempotency-key через Redis)",
          tag: "bugfix",
          status: ItemWorkflowStatus.done,
        },
      ],
      nextItems: [
        {
          text: "Подключить СБП-эквайринг (sandbox-ключи ожидаются 8 числа)",
          tag: "feature",
        },
        {
          text: "Biometric-вход — закрыть acceptance-критерии с UX",
          tag: "feature",
        },
      ],
      risk: {
        risk: "Риск: задержка ключей СБП-эквайринга от партнёра",
        impact: "Влияние: сдвиг релиза мобильного приложения на одну неделю",
        mitigation:
          "Митигация: ежедневный sync с менеджером партнёра, готов фолбэк-флоу",
        severity: "at-risk",
      },
      decisions: [
        {
          text: "Решение: раскатать 3DS v2 на 100% трафика после стабилизации",
          impact: "Закрывает требование PSD2 для платёжного шлюза",
          deadline: plusDaysUTC(ACTIVE_MONDAY, 14),
        },
        {
          text: "Решение: согласовать UX-сценарий восстановления при отмене 3DS",
          impact: "Снижает abandonment-rate на чекауте",
        },
      ],
      priorities: [
        "Стабилизация 3DS v2 на проде (закрыть L2-инциденты)",
        "Раскатка СБП-эквайринга на 100% трафика после получения ключей",
        "Завести нагрузочный тест платёжного шлюза в CI",
      ],
    },
    [LEAD_SERGEY]: {
      currentItems: [
        {
          text: "Закатили обновлённую модель прав доступа в HR-системе",
          tag: "feature",
          status: ItemWorkflowStatus.done,
        },
        {
          text: "Перенесли отчёты по найму на новый BI-движок",
          tag: "feature",
          status: ItemWorkflowStatus.in_progress,
        },
        {
          text: "Починили баги по экспорту в Excel (3 тикета закрыты)",
          tag: "bugfix",
          status: ItemWorkflowStatus.done,
        },
      ],
      nextItems: [
        {
          text: "Подготовить демо HR-аналитики для совета директоров",
          tag: "feature",
        },
        {
          text: "Согласовать новый календарь периодов оценки сотрудников",
          tag: "ops",
        },
      ],
      decisions: [
        {
          text: "Решение: выделить slot на интеграцию с корпоративным SSO для HR",
          impact: "Снижает onboarding-трение для новых сотрудников",
        },
        {
          text: "Решение: согласовать архитектуру модуля 360-feedback",
          impact: "Закрывает roadmap-цель Q3 по HR-аналитике",
        },
      ],
      priorities: [
        "Демо HR-аналитики для совета директоров",
        "Интеграция с корпоративным SSO для HR-системы",
        "Архитектура модуля 360-feedback",
      ],
    },
    // PM leads — Plan/Analysis focus, non-technical vocabulary
    [LEAD_MOBILE_PM]: {
      currentItems: [
        {
          text: "Разработала концепт нового onboarding-флоу для мобильного приложения",
          tag: "analysis",
          status: ItemWorkflowStatus.in_progress,
        },
        {
          text: "Провела интервью с 8 пользователями по болям чекаута",
          tag: "analysis",
          status: ItemWorkflowStatus.done,
        },
        {
          text: "Подготовила спецификацию для push-уведомлений",
          tag: "feature",
          status: ItemWorkflowStatus.done,
        },
      ],
      nextItems: [
        { text: "Прототип онбординга на Figma для A/B теста", tag: "analysis" },
        {
          text: "Составить acceptance-критерии для push-уведомлений",
          tag: "ops",
        },
      ],
      decisions: [
        {
          text: "Решение: запустить A/B тест нового онбординга на 10% аудитории",
          impact: "Данные для решения о полном переходе через 4 недели",
          deadline: plusDaysUTC(ACTIVE_MONDAY, 10),
        },
      ],
      priorities: [
        "Финализировать концепт онбординга и передать дизайнеру",
        "Согласовать acceptance-критерии push-уведомлений с командой",
        "Запуск A/B теста онбординга в течение двух недель",
      ],
    },
    [LEAD_CLOUD_PM]: {
      currentItems: [
        {
          text: "Документировала архитектуру data governance для внутреннего BI",
          tag: "analysis",
          status: ItemWorkflowStatus.in_progress,
        },
        {
          text: "Согласовала требования к дашборду с 3 аналитическими командами",
          tag: "analysis",
          status: ItemWorkflowStatus.done,
        },
        {
          text: "Подготовила roadmap перехода на self-service BI",
          tag: "ops",
          status: ItemWorkflowStatus.done,
        },
      ],
      nextItems: [
        {
          text: "Валидация data model с командой Data Engineering",
          tag: "analysis",
        },
        {
          text: "Прототип нового дашборда для пилота с аналитиками",
          tag: "analysis",
        },
      ],
      decisions: [
        {
          text: "Решение: запустить пилот self-service BI с аналитической командой маркетинга",
          impact: "Снижает нагрузку на DE-команду на 30%",
          deadline: plusDaysUTC(ACTIVE_MONDAY, 21),
        },
      ],
      priorities: [
        "Финализировать data governance документацию",
        "Запустить пилот self-service BI с маркетинговой командой",
        "Валидация data model готова до начала разработки",
      ],
    },
    [LEAD_DEVOPS_PM]: {
      currentItems: [
        {
          text: "Согласовала стандарты документирования infrastructure-as-code",
          tag: "ops",
          status: ItemWorkflowStatus.done,
        },
        {
          text: "Провела анализ инцидентов Q2 и подготовила action plan",
          tag: "analysis",
          status: ItemWorkflowStatus.in_progress,
        },
        {
          text: "Актуализировала SLA-соглашения со смежными командами",
          tag: "ops",
          status: ItemWorkflowStatus.done,
        },
      ],
      nextItems: [
        {
          text: "Presentation action plan по инцидентам Q2 для CTO",
          tag: "ops",
        },
        {
          text: "Составить план обучения по IaC-практикам для команды",
          tag: "ops",
        },
      ],
      decisions: [
        {
          text: "Решение: внедрить runbook-driven incident response для all P1/P2",
          impact: "Снижает MTTR на 40% за счёт стандартизации response",
        },
      ],
      priorities: [
        "Завершить action plan по инцидентам Q2",
        "Внедрить runbook-driven incident response",
        "Обучение команды по IaC-стандартам",
      ],
    },
  };

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i]!;
    const content = contentByLead[lead.id]!;
    const sectionId = `a0000000-0000-4000-8000-00000000040${(i + 1).toString(16)}`;
    await prisma.reportSection.create({
      data: {
        id: sectionId,
        reportId: REPORT_ACTIVE,
        authorId: lead.id,
        status: lead.status,
        submittedAt:
          lead.status === ReportSectionStatus.submitted
            ? plusDaysUTC(ACTIVE_MONDAY, 3)
            : null,
      },
    });

    // Each lead's section gets ProjectStatus rows for primary product +
    // 2 secondaries — keeps the SDLC pipeline + product picker varied.
    // Vasily uses his 3 extra products as SECONDARY so items/statuses
    // reference PROD_CRM_SALES and PROD_CRM_DATA rather than other leads' products.
    const SECONDARY =
      lead.id === LEAD_1
        ? ([PROD_CRM_SALES, PROD_CRM_DATA] as string[])
        : ALL_PRODUCT_IDS.filter((p) => p !== lead.productId).slice(0, 2);
    // Vasily's section shows ProjectStatus for all 4 of his products.
    const STATUS_PRODUCTS: readonly string[] =
      lead.id === LEAD_1
        ? [PROD_CRM, PROD_CRM_SALES, PROD_CRM_DATA, PROD_CRM_360]
        : [lead.productId, ...SECONDARY];
    for (let pIdx = 0; pIdx < STATUS_PRODUCTS.length; pIdx++) {
      const pid = STATUS_PRODUCTS[pIdx]!;
      const isPrimary = pid === lead.productId;
      await prisma.projectStatus.create({
        data: {
          id: `a0000000-0000-4000-8000-0000000006${i + 1}${pIdx + 1}`,
          reportSectionId: sectionId,
          projectId: pid,
          status: isPrimary ? lead.lightStatus : TrafficLightStatus.green,
        },
      });
    }

    // Vasily owns Dev+Test on PROD_CRM for StageStatus rows.
    // Plan/Analysis/Design belong to Boris — no StageStatus rows for those here.
    const ownedStageIds =
      lead.id === LEAD_1 ? [STAGE_DEV, STAGE_TEST] : [STAGE_DEV];
    await prisma.stageStatus.createMany({
      data: ownedStageIds.map((stageId, sIdx) => ({
        id: `a0000000-0000-4000-8000-0000000f0${i + 1}1${sIdx + 1}`,
        reportSectionId: sectionId,
        projectId: lead.productId,
        stageId,
        status: sIdx === 0 ? lead.lightStatus : TrafficLightStatus.green,
      })),
    });

    // Pick a default stage to seed on every Item / Risk / Decision /
    // Priority row so the post-seed UI doesn't show every entry as the '—'
    // legacy placeholder. "Development" matches the seeded Stage.name and
    // the lead's StageAssignment for secondary leads. For the primary seeded lead
    // we vary stages across his 7-stage CRM ownership so the demo
    // exercises the per-stage scoping.
    const SEED_STAGE_ROTATION = [
      "Development",
      "Testing",
      "Design",
      "DevOps",
      "Planning",
    ];
    const stageFor = (idx: number) =>
      lead.id === LEAD_1
        ? (SEED_STAGE_ROTATION[idx % SEED_STAGE_ROTATION.length] ??
          "Development")
        : "Development";

    const itemRows = [
      ...content.currentItems.map((it, idx) => ({
        id: `a0000000-0000-4000-8000-00000005${i + 1}00${idx + 1}`,
        reportSectionId: sectionId,
        type: ItemType.current,
        projectId:
          idx === 0 ? lead.productId : SECONDARY[(idx - 1) % SECONDARY.length]!,
        text: it.text,
        tag: it.tag,
        workflowStatus: it.status,
        carriedOver: it.carriedOver ?? false,
        stageNames: [stageFor(idx)],
        priorityRank: idx < content.priorities.length ? idx + 1 : null,
      })),
      ...content.nextItems.map((it, idx) => ({
        id: `a0000000-0000-4000-8000-00000005${i + 1}01${idx + 1}`,
        reportSectionId: sectionId,
        type: ItemType.next,
        projectId:
          idx === 0 ? lead.productId : SECONDARY[idx % SECONDARY.length]!,
        text: it.text,
        tag: it.tag,
        // Next-week items default to planned — the per-type CHECK constraint
        // allows only ItemWorkflowStatus.planned or .postponed here.
        workflowStatus: it.status ?? ItemWorkflowStatus.planned,
        carriedOver: false,
        stageNames: [stageFor(idx + 100)],
      })),
    ];
    await prisma.item.createMany({ data: itemRows });

    if (content.risk) {
      await prisma.risk.create({
        data: {
          id: `a0000000-0000-4000-8000-00000000090${i + 1}`,
          reportSectionId: sectionId,
          projectId: lead.productId,
          risk: content.risk.risk,
          impact: content.risk.impact,
          mitigation: content.risk.mitigation,
          severity: content.risk.severity,
          stageNames: [stageFor(0)],
        },
      });
    }

    await prisma.decision.createMany({
      data: content.decisions.map((d, dIdx) => ({
        id:
          dIdx === 0
            ? `a0000000-0000-4000-8000-00000000070${i + 1}`
            : deterministicSeedId("simple", "active", "decision", i, dIdx),
        reportSectionId: sectionId,
        productId: lead.productId,
        text: d.text,
        owner: lead.name,
        impact: d.impact,
        deadline: d.deadline ?? null,
        stageNames: [stageFor(dIdx)],
      })),
    });

  }

  // W6: 3-contributor cross-author overlay on PROD_CRM.
  // Boris (section 407, Planning) — CW item + NW item + Risk + Decision + Priority.
  // Victor (section 408, Analysis) — same 5-section spread.
  // Galina (section 409, Design) — same 5-section spread.
  // When Vasily opens /lead/report/<id> he sees all 3 contributors' content
  // merged inline in each of the 5 accordion sections with 🔒 next to author name.

  const borisSectionId = `a0000000-0000-4000-8000-000000000407`;
  await prisma.projectStatus.create({
    data: {
      id: "a0000000-0000-4000-8000-000000006791",
      reportSectionId: borisSectionId,
      projectId: PROD_CRM_SALES,
      // D4: Boris has no own seeded StageStatus rows on PROD_CRM_SALES, so this
      // row must not claim a severity — a status hue needs a visible stage
      // correlate. Green is the calm default the app itself would aggregate to.
      status: TrafficLightStatus.green,
    },
  });
  await prisma.item.create({
    data: {
      id: "a0000000-0000-4000-8000-000000007001",
      reportSectionId: borisSectionId,
      type: ItemType.next,
      projectId: PROD_CRM_SALES,
      text: "PM-обзор: подключить выгрузку sales-метрик в CRM-Sales Hub",
      tag: "analysis",
      workflowStatus: ItemWorkflowStatus.planned,
      carriedOver: false,
      stageNames: ["Planning"],
    },
  });
  await prisma.risk.create({
    data: {
      id: "a0000000-0000-4000-8000-000000009001",
      reportSectionId: borisSectionId,
      projectId: PROD_CRM_SALES,
      risk: "Sales API rate-limit на пиках нагрузки",
      impact: "Деградация дашборда для отдела продаж",
      mitigation: "PM эскалирует задачу на инфра-команду",
      severity: "at-risk",
      stageNames: ["Planning"],
    },
  });
  // Boris PROD_CRM — CW + NW items (already seeded), Risk, Decision, Priority.
  // ProjectStatus for PROD_CRM is already created in the main leads loop (SECONDARY=[PROD_CRM,...]).
  await prisma.item.createMany({
    data: [
      {
        id: "a0000000-0000-4000-8000-000000007002",
        reportSectionId: borisSectionId,
        type: ItemType.current,
        projectId: PROD_CRM,
        text: "PM: согласование требований к модулю портальной аналитики",
        tag: "analysis",
        workflowStatus: ItemWorkflowStatus.in_progress,
        carriedOver: false,
        stageNames: ["Planning"],
        priorityRank: 1,
      },
      {
        id: "a0000000-0000-4000-8000-000000007003",
        reportSectionId: borisSectionId,
        type: ItemType.next,
        projectId: PROD_CRM,
        text: "Стартовать дискавери-сессию с командой дизайна",
        tag: "feature",
        workflowStatus: ItemWorkflowStatus.planned,
        carriedOver: false,
        stageNames: ["Planning"],
      },
    ],
  });
  await prisma.risk.create({
    data: {
      id: "a0000000-0000-4000-8000-000000009002",
      reportSectionId: borisSectionId,
      projectId: PROD_CRM,
      risk: "Требования к аналитическому модулю не финализированы до старта разработки",
      impact: "Задержка Design-спринта на 1 неделю",
      mitigation: "PM фасилитирует воркшоп с заказчиком до пятницы",
      severity: "at-risk",
      stageNames: ["Planning"],
    },
  });
  await prisma.decision.create({
    data: {
      id: "a0000000-0000-4000-8000-000000007004",
      reportSectionId: borisSectionId,
      productId: PROD_CRM,
      text: "Утвердить структуру аналитического API до начала разработки",
      owner: "Сиренев Борис",
      impact: "Позволяет Design-команде начать прототипирование немедленно",
      stageNames: ["Planning"],
    },
  });
  // fix-lead-surface-name-resolution: cross-stage reproducer. Boris owns
  // NO StageAssignment on PROD_PAYMENTS ("Payment Gateway"), so this risk
  // and decision reference a project outside his stage-owned `projects`.
  // Pre-fix these rendered "Unknown" (risk) / "Group" (decision) on
  // /lead/report; post-fix they must show the real product name via the
  // read model's name-only `referencedProjects`.
  await prisma.risk.create({
    data: {
      id: "a0000000-0000-4000-8000-000000009003",
      reportSectionId: borisSectionId,
      projectId: PROD_PAYMENTS,
      risk: "Интеграция с платёжным шлюзом не согласована с командой Ольги",
      impact: "Мобильный чек-аут не сможет принимать платежи в релизе",
      mitigation: "Борис назначает синк с командой Платёжного шлюза",
      severity: "at-risk",
      stageNames: ["Planning"],
    },
  });
  await prisma.decision.create({
    data: {
      id: "a0000000-0000-4000-8000-000000007005",
      reportSectionId: borisSectionId,
      productId: PROD_PAYMENTS,
      text: "Согласовать SLA платёжного API для мобильного чек-аута",
      owner: "Сиренев Борис",
      impact: "Снимает блокер интеграции до начала Dev-фазы",
      stageNames: ["Planning"],
    },
  });
  // Victor (LEAD_CLOUD_PM) owns Analysis on PROD_CRM (section 408).
  // ProjectStatus for PROD_CRM already exists (SECONDARY=[PROD_CRM, PROD_MOBILE] from loop).
  const victorSectionId = `a0000000-0000-4000-8000-000000000408`;
  await prisma.item.createMany({
    data: [
      {
        id: "a0000000-0000-4000-8000-000000007010",
        reportSectionId: victorSectionId,
        type: ItemType.current,
        projectId: PROD_CRM,
        text: "Анализ пользовательских сценариев для нового дашборда",
        tag: "analysis",
        workflowStatus: ItemWorkflowStatus.in_progress,
        carriedOver: false,
        stageNames: ["Analysis"],
        priorityRank: 1,
      },
      {
        id: "a0000000-0000-4000-8000-000000007011",
        reportSectionId: victorSectionId,
        type: ItemType.next,
        projectId: PROD_CRM,
        text: "Согласовать схему данных с бэкенд-командой",
        tag: "feature",
        workflowStatus: ItemWorkflowStatus.planned,
        carriedOver: false,
        stageNames: ["Analysis"],
      },
    ],
  });
  await prisma.risk.create({
    data: {
      id: "a0000000-0000-4000-8000-000000009010",
      reportSectionId: victorSectionId,
      projectId: PROD_CRM,
      risk: "Нет согласованной модели данных — аналитика блокирует разработку",
      impact: "Задержка старта Dev-фазы на 2 недели",
      mitigation: "Виктор организует межкомандный воркшоп по схеме данных",
      severity: "blocked",
      stageNames: ["Analysis"],
    },
  });
  await prisma.decision.create({
    data: {
      id: "a0000000-0000-4000-8000-000000007012",
      reportSectionId: victorSectionId,
      productId: PROD_CRM,
      text: "Использовать GraphQL вместо REST для аналитического слоя",
      owner: "Липов Виктор",
      impact: "Единая точка доступа, меньше over-fetching",
      stageNames: ["Analysis"],
    },
  });
  // Galina (LEAD_DEVOPS_PM) owns Design on PROD_CRM (section 409).
  // ProjectStatus for PROD_CRM already exists (SECONDARY=[PROD_CRM, PROD_MOBILE] from loop).
  const galinaSectionId = `a0000000-0000-4000-8000-000000000409`;
  await prisma.item.createMany({
    data: [
      {
        id: "a0000000-0000-4000-8000-000000007020",
        reportSectionId: galinaSectionId,
        type: ItemType.current,
        projectId: PROD_CRM,
        text: "Разработка UI-kit для нового портала — компоненты форм и таблиц",
        tag: "feature",
        workflowStatus: ItemWorkflowStatus.in_progress,
        carriedOver: false,
        stageNames: ["Design"],
        priorityRank: 1,
      },
      {
        id: "a0000000-0000-4000-8000-000000007021",
        reportSectionId: galinaSectionId,
        type: ItemType.next,
        projectId: PROD_CRM,
        text: "Провести usability-тест с 5 пользователями по прототипу",
        tag: "analysis",
        workflowStatus: ItemWorkflowStatus.planned,
        carriedOver: false,
        stageNames: ["Design"],
      },
    ],
  });
  await prisma.risk.create({
    data: {
      id: "a0000000-0000-4000-8000-000000009020",
      reportSectionId: galinaSectionId,
      projectId: PROD_CRM,
      risk: "Figma-прототип не согласован с PM — риск переработки верстки",
      impact: "Переработка компонентов на этапе Dev",
      mitigation: "Галина организует review с Boris и стейкхолдерами",
      severity: "at-risk",
      stageNames: ["Design"],
    },
  });
  await prisma.decision.create({
    data: {
      id: "a0000000-0000-4000-8000-000000007022",
      reportSectionId: galinaSectionId,
      productId: PROD_CRM,
      text: "Принять Material Design 3 как базовую дизайн-систему для портала",
      owner: "Малиновая Галина",
      impact: "Ускоряет разработку компонентов на 30%",
      stageNames: ["Design"],
    },
  });

  // C3 (project-activity-reporting): stage-less Project Activities beside the
  // products, so the assembled report's "Project Activities" band renders out
  // of the box. Mirrors the per-section ProjectStatus seeding above — 2..4
  // activities per product (groupId from the product's group; the product is
  // linked M:N as a label via ProjectActivityProduct, since an activity no
  // longer carries a direct projectId), the product's own lead attached (M:M),
  // and one ActivityStatus per activity on the ACTIVE section that lead authored
  // (authorId === Project.leadId, sections ...0401..0404 from the leads loop).
  // Statuses carry a deliberate green/yellow/red mix; both SUBMITTED sections
  // (402, 404) get a full spread so the band stays meaningful under the §7
  // submitted-only filter.
  console.log(
    "[seed-simple] Creating project activities + weekly statuses (C3)...",
  );
  type ActivitySeed = {
    productId: string;
    groupId: string;
    leadId: string;
    sectionId: string;
    activities: readonly {
      name: string;
      status: TrafficLightStatus;
      note?: string;
    }[];
  };
  const activitySeeds: readonly ActivitySeed[] = [
    {
      productId: PROD_CRM,
      groupId: DEFAULT_REPORTING_GROUP_ID,
      leadId: LEAD_1,
      sectionId: "a0000000-0000-4000-8000-000000000401",
      activities: [
        { name: "Поддержка и сопровождение", status: TrafficLightStatus.green },
        {
          name: "Технический долг и рефакторинг",
          status: TrafficLightStatus.yellow,
        },
        {
          name: "Исследование новых интеграций",
          status: TrafficLightStatus.red,
          note: "Партнёр задерживает доступ к API",
        },
      ],
    },
    {
      productId: PROD_MOBILE,
      groupId: DEFAULT_REPORTING_GROUP_ID,
      leadId: LEAD_MARIA,
      sectionId: "a0000000-0000-4000-8000-000000000402",
      activities: [
        { name: "Дежурство по инцидентам", status: TrafficLightStatus.green },
        {
          name: "Миграция на новый API-шлюз",
          status: TrafficLightStatus.red,
          note: "Ждём подтверждения от инфраструктурной команды",
        },
        {
          name: "Нагрузочное тестирование",
          status: TrafficLightStatus.yellow,
        },
      ],
    },
    {
      productId: PROD_CLOUD,
      groupId: DEFAULT_REPORTING_GROUP_ID,
      leadId: LEAD_IGOR,
      sectionId: "a0000000-0000-4000-8000-000000000403",
      activities: [
        { name: "Мониторинг и алертинг", status: TrafficLightStatus.green },
        {
          name: "Оптимизация затрат на облако",
          status: TrafficLightStatus.yellow,
        },
      ],
    },
    {
      productId: PROD_DEVOPS,
      groupId: DEFAULT_REPORTING_GROUP_ID,
      leadId: LEAD_DMITRY,
      sectionId: "a0000000-0000-4000-8000-000000000404",
      activities: [
        { name: "Сопровождение CI/CD", status: TrafficLightStatus.green },
        {
          name: "Ротация секретов и аудит доступа",
          status: TrafficLightStatus.yellow,
        },
        {
          name: "Обновление базового образа",
          status: TrafficLightStatus.red,
          note: "Уязвимость в текущем образе, нужен срочный патч",
        },
      ],
    },
  ];

  // Deterministic ids (idempotent re-run): 00000000c{a|b|c|d}{product}{activity}
  // — a=activity, b=lead-link, c=status, d=product-link; the position-9 'c' slot
  // is unused by other seed anchors. product/activity indices stay single hex
  // digits.
  const activityRows = activitySeeds.flatMap((seed, pIdx) =>
    seed.activities.map((activity, aIdx) => {
      const suffix = `${pIdx}${aIdx}`;
      return {
        activityId: `a0000000-0000-4000-8000-00000000ca${suffix}`,
        leadLinkId: `a0000000-0000-4000-8000-00000000cb${suffix}`,
        statusId: `a0000000-0000-4000-8000-00000000cc${suffix}`,
        productLinkId: `a0000000-0000-4000-8000-00000000cd${suffix}`,
        productId: seed.productId,
        groupId: seed.groupId,
        leadId: seed.leadId,
        sectionId: seed.sectionId,
        name: activity.name,
        status: activity.status,
        note: activity.note ?? null,
      };
    }),
  );

  await prisma.projectActivity.createMany({
    data: activityRows.map((row) => ({
      id: row.activityId,
      name: row.name,
      groupId: row.groupId,
    })),
  });
  await prisma.projectActivityLead.createMany({
    data: activityRows.map((row) => ({
      id: row.leadLinkId,
      activityId: row.activityId,
      leadId: row.leadId,
    })),
  });
  // Product label link (M:N): what an activity reports against, shown as the
  // linkedProducts chip on every surface. Each demo activity links its one
  // product; UNIQUE(activityId, productId) holds since pairs are distinct.
  await prisma.projectActivityProduct.createMany({
    data: activityRows.map((row) => ({
      id: row.productLinkId,
      activityId: row.activityId,
      productId: row.productId,
    })),
  });
  // One ActivityStatus per attached activity on the lead's own section —
  // mirrors seedProjectStatuses; UNIQUE(reportSectionId, activityId) holds
  // since each activity binds to exactly one product → one section.
  await prisma.activityStatus.createMany({
    data: activityRows.map((row) => ({
      id: row.statusId,
      reportSectionId: row.sectionId,
      activityId: row.activityId,
      status: row.status,
      note: row.note,
    })),
  });

  // Activity-parented records on Maria's SUBMITTED section (402), attached to her
  // first activity ("Incident Duty", ...ca10 — already lead-linked,
  // status-carrying, and product-labelled from the loop above). XOR parent shape:
  // the product FK is null, `activityId` is set, and `stageNames` is [] because an
  // activity has no SDLC stage. This makes the activity render POPULATED (records +
  // linked product) on the lead form and the head report, not just a status strip.
  console.log(
    "[seed-simple] Creating activity-parented item/risk/decision (populated activity)...",
  );
  const populatedActivityId = "a0000000-0000-4000-8000-00000000ca10";
  const populatedActivitySectionId = "a0000000-0000-4000-8000-000000000402";
  await prisma.item.create({
    data: {
      id: "a0000000-0000-4000-8000-00000000ac10",
      reportSectionId: populatedActivitySectionId,
      type: ItemType.current,
      projectId: null,
      activityId: populatedActivityId,
      text: "Разобрали 6 инцидентов дежурства, ускорили типовой ответ вдвое",
      tag: "ops",
      workflowStatus: ItemWorkflowStatus.in_progress,
      carriedOver: false,
      stageNames: [],
    },
  });
  await prisma.risk.create({
    data: {
      id: "a0000000-0000-4000-8000-00000000ad10",
      reportSectionId: populatedActivitySectionId,
      projectId: null,
      activityId: populatedActivityId,
      risk: "Пиковая нагрузка на дежурную смену на праздничной неделе",
      impact: "Рост времени реакции на инциденты сверх SLA",
      mitigation: "Усилили дежурную смену и подготовили runbook эскалации",
      severity: "at-risk",
      stageNames: [],
    },
  });
  await prisma.decision.create({
    data: {
      id: "a0000000-0000-4000-8000-00000000ae10",
      reportSectionId: populatedActivitySectionId,
      productId: null,
      activityId: populatedActivityId,
      text: "Решение: закрепить второго дежурного на праздничную неделю",
      owner: "Каштанова Мария Андреевна",
      impact: "Держит время реакции по инцидентам в рамках SLA",
      stageNames: [],
    },
  });

  // Activity-only lead: attached to a cross-cutting activity, owns no product, so
  // his ACTIVE section carries activity content only. Seeds the activity, the
  // lead M:M link, a product LABEL link (linkedProducts still renders), the
  // section + its ActivityStatus, and activity-parented records — exercising the
  // activity-only-submit relaxation end to end.
  console.log("[seed-simple] Creating activity-only lead + section (Q4)...");
  await prisma.projectActivity.create({
    data: {
      id: ACTIVITY_ONLY_ID,
      name: "Кросс-командная поддержка релизов",
      groupId: DEFAULT_REPORTING_GROUP_ID,
    },
  });
  await prisma.projectActivityLead.create({
    data: {
      id: ACTIVITY_ONLY_LEAD_LINK_ID,
      activityId: ACTIVITY_ONLY_ID,
      leadId: LEAD_ACTIVITY_ONLY,
    },
  });
  await prisma.projectActivityProduct.create({
    data: {
      id: ACTIVITY_ONLY_PRODUCT_LINK_ID,
      activityId: ACTIVITY_ONLY_ID,
      productId: PROD_CRM,
    },
  });
  await prisma.reportSection.create({
    data: {
      id: ACTIVITY_ONLY_SECTION_ID,
      reportId: REPORT_ACTIVE,
      authorId: LEAD_ACTIVITY_ONLY,
      status: ReportSectionStatus.submitted,
      submittedAt: plusDaysUTC(ACTIVE_MONDAY, 3),
    },
  });
  await prisma.activityStatus.create({
    data: {
      id: ACTIVITY_ONLY_STATUS_ID,
      reportSectionId: ACTIVITY_ONLY_SECTION_ID,
      activityId: ACTIVITY_ONLY_ID,
      status: TrafficLightStatus.green,
      note: "Поддержали 3 релиза без простоя",
    },
  });
  await prisma.item.create({
    data: {
      id: "a0000000-0000-4000-8000-00000000ace0",
      reportSectionId: ACTIVITY_ONLY_SECTION_ID,
      type: ItemType.current,
      projectId: null,
      activityId: ACTIVITY_ONLY_ID,
      text: "Сопроводили 3 релиза смежных команд без простоя прод-среды",
      tag: "ops",
      workflowStatus: ItemWorkflowStatus.done,
      carriedOver: false,
      stageNames: [],
    },
  });
  await prisma.decision.create({
    data: {
      id: "a0000000-0000-4000-8000-00000000aee0",
      reportSectionId: ACTIVITY_ONLY_SECTION_ID,
      productId: null,
      activityId: ACTIVITY_ONLY_ID,
      text: "Решение: ввести общий чек-лист готовности релиза для смежных команд",
      owner: "Фиалков Роман Аркадьевич",
      impact: "Снижает число откатов релизов на стыке команд",
      stageNames: [],
    },
  });

  console.log(
    "[seed-simple] Creating searchable primary-Lead sections for future periods...",
  );
  const futureReports = EXTRA_REPORTS.filter(
    (report) => report.periodStatus === PeriodStatus.open,
  );
  for (const [index, report] of futureReports.entries()) {
    const sectionId = deterministicSeedId("simple", "future", "section", index);
    await prisma.reportSection.create({
      data: {
        id: sectionId,
        reportId: report.id,
        authorId: LEAD_1,
        status: ReportSectionStatus.draft,
      },
    });
    await prisma.projectStatus.create({
      data: {
        id: deterministicSeedId("simple", "future", "status", index),
        reportSectionId: sectionId,
        projectId: PROD_CRM,
        status: TrafficLightStatus.green,
      },
    });
    await prisma.item.create({
      data: {
        id: deterministicSeedId("simple", "future", "item", index),
        reportSectionId: sectionId,
        projectId: PROD_CRM,
        type: ItemType.next,
        text: `Плановый фокус периода по продукту «Маркетинговый портал» (${index + 1})`,
        tag: "feature",
        workflowStatus: ItemWorkflowStatus.planned,
        stageNames: ["Development"],
      },
    });
  }

  console.log(
    '[seed-simple] Creating published-week sections (RU "Fill from Previous" content)...',
  );
  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i]!;
    const prevSectionId = `a0000000-0000-4000-8000-00000000041${i + 1}`;
    await prisma.reportSection.create({
      data: {
        id: prevSectionId,
        reportId: REPORT_PUBLISHED,
        authorId: lead.id,
        status: ReportSectionStatus.submitted,
        submittedAt: PREV_SUBMIT_AT,
      },
    });

    await prisma.projectStatus.create({
      data: {
        id: deterministicSeedId("simple", "published", "status", i),
        reportSectionId: prevSectionId,
        projectId: lead.productId,
        status: TrafficLightStatus.green,
      },
    });

    await prisma.item.createMany({
      data: [
        {
          id: deterministicSeedId("simple", "published", "current", i),
          reportSectionId: prevSectionId,
          type: ItemType.current,
          projectId: lead.productId,
          text: `Закрыли спринтовые цели команды ${lead.label} на прошлой неделе`,
          tag: "feature",
          workflowStatus: ItemWorkflowStatus.done,
          carriedOver: false,
          priorityRank: 1,
        },
        {
          id: deterministicSeedId("simple", "published", "next", i),
          reportSectionId: prevSectionId,
          type: ItemType.next,
          projectId: lead.productId,
          text: `Перенос: продолжить рефакторинг авторизации`,
          tag: "feature",
          workflowStatus: ItemWorkflowStatus.planned,
          carriedOver: false,
        },
      ],
    });
  }

  console.log(
    "[seed-simple] Creating archived lead history sections (4 periods)...",
  );
  const archivedReports = EXTRA_REPORTS.filter(
    (report) => report.status === ReportStatus.published,
  );
  const archiveTrafficByPeriod = [
    TrafficLightStatus.green,
    TrafficLightStatus.yellow,
    TrafficLightStatus.green,
    TrafficLightStatus.red,
  ] as const;

  for (let reportIdx = 0; reportIdx < archivedReports.length; reportIdx++) {
    const report = archivedReports[reportIdx]!;
    const submittedAt =
      report.publishedAt ?? endOfDayUTC(plusDaysUTC(report.monday, 6));
    const createdAt = plusDaysUTC(report.monday, 1);

    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i]!;
      const archiveSectionId = `a0000000-0000-4000-8000-0000000005${reportIdx + 1}${i + 1}`;
      const lightStatus =
        i === 0 ? archiveTrafficByPeriod[reportIdx]! : TrafficLightStatus.green;

      await prisma.reportSection.create({
        data: {
          id: archiveSectionId,
          reportId: report.id,
          authorId: lead.id,
          status: ReportSectionStatus.submitted,
          submittedAt,
          createdAt,
          updatedAt: submittedAt,
        },
      });

      await prisma.projectStatus.create({
        data: {
          id: deterministicSeedId(
            "simple",
            "history",
            "status",
            reportIdx,
            i,
          ),
          reportSectionId: archiveSectionId,
          projectId: lead.productId,
          status: lightStatus,
          createdAt,
          updatedAt: submittedAt,
        },
      });

      await prisma.item.createMany({
        data: [
          {
            id: deterministicSeedId(
              "simple",
              "history",
              "current",
              reportIdx,
              i,
            ),
            reportSectionId: archiveSectionId,
            type: ItemType.current,
            projectId: lead.productId,
            text: `Архив: закрыли ключевые задачи периода для команды ${lead.label}`,
            tag: "feature",
            workflowStatus: ItemWorkflowStatus.done,
            carriedOver: false,
            stageNames: ["Development"],
            priorityRank: 1,
            createdAt,
            updatedAt: submittedAt,
          },
          {
            id: deterministicSeedId(
              "simple",
              "history",
              "next",
              reportIdx,
              i,
            ),
            reportSectionId: archiveSectionId,
            type: ItemType.next,
            projectId: lead.productId,
            text: `Архив: перенесли следующий фокус команды ${lead.label} в новый период`,
            tag: "ops",
            workflowStatus: ItemWorkflowStatus.planned,
            carriedOver: false,
            stageNames: ["Development"],
            createdAt,
            updatedAt: submittedAt,
          },
        ],
      });
    }
  }

  // Backfill the seed group's headUserId to the seeded head user and grant
  // the viewer access to it. Lets the dashboard render with a
  // configured leader and a viewer who already sees the group's reports.
  console.log(
    "[seed-simple] Setting group leader + viewer access (UFB-039)...",
  );
  await prisma.reportingGroup.update({
    where: { id: DEFAULT_REPORTING_GROUP_ID },
    data: { headUserId: HEAD_ID },
  });
  await prisma.viewerGroupAccess.create({
    data: {
      id: "a0000000-0000-4000-8000-000000000901",
      viewerUserId: VIEWER_ID,
      groupId: DEFAULT_REPORTING_GROUP_ID,
    },
  });

  console.log(
    "[seed-simple] Creating one reopen request for Admin → Reopen...",
  );
  await prisma.reopenRequest.create({
    data: {
      id: "a0000000-0000-4000-8000-000000000d01",
      reportSectionId: "a0000000-0000-4000-8000-000000000411",
      requestedById: LEAD_1,
      reason:
        "Нужно уточнить перенос работ по авторизации после комментариев head review.",
      status: ReopenRequestStatus.pending,
    },
  });

  console.log("[seed-simple] Creating action-log examples...");
  await prisma.userActionLog.createMany({
    data: [
      {
        id: "a0000000-0000-4000-8000-000000000e01",
        userId: ADMIN_ID,
        role: Role.admin,
        procedure: "admin.updateSettings",
        targetId: "singleton",
        status: UserActionStatus.success,
        reason: "Seeded demo action: settings viewed during MVP UAT.",
        ip: "127.0.0.1",
        correlationId: "seed-simple-settings",
        durationMs: 42,
      },
      {
        id: "a0000000-0000-4000-8000-000000000e02",
        userId: HEAD_ID,
        role: Role.head,
        procedure: "review.publish",
        targetId: REPORT_PUBLISHED,
        status: UserActionStatus.success,
        reason: "Seeded demo action: previous weekly report published.",
        ip: "127.0.0.1",
        correlationId: "seed-simple-publish",
        durationMs: 86,
      },
    ],
  });

  console.log("[seed-simple] Creating reminder policies + derived rules...");
  await prisma.reminderPolicy.createMany({
    data: [
      {
        id: POLICY_DEADLINE,
        kind: ReminderRuleKind.deadline,
        offsetMinutes: -1440,
        timezone: "Europe/Moscow",
        audience: ReminderAudience.LEAD_WITH_DRAFT,
        active: true,
        validFrom: ACTIVE_MONDAY,
      },
      {
        id: POLICY_ESCALATION,
        kind: ReminderRuleKind.escalation,
        offsetMinutes: 120,
        timezone: "Europe/Moscow",
        audience: ReminderAudience.HEAD_OF_LATE,
        active: true,
        validFrom: ACTIVE_MONDAY,
      },
    ],
  });
  await prisma.reminderRule.createMany({
    data: [
      {
        id: "a0000000-0000-4000-8000-000000000801",
        reportId: REPORT_ACTIVE,
        policyId: POLICY_DEADLINE,
        kind: ReminderRuleKind.deadline,
        fireAt: ACTIVE_REMINDER_DEADLINE_FIRE,
        timezone: "Europe/Moscow",
        status: ReminderRuleStatus.active,
        version: 1,
      },
      {
        id: "a0000000-0000-4000-8000-000000000802",
        reportId: REPORT_ACTIVE,
        policyId: POLICY_ESCALATION,
        kind: ReminderRuleKind.escalation,
        fireAt: ACTIVE_REMINDER_ESCALATION_FIRE,
        timezone: "Europe/Moscow",
        status: ReminderRuleStatus.active,
        version: 1,
      },
    ],
  });

  const counts = {
    users: await prisma.user.count(),
    projects: await prisma.project.count({ where: { archived: false } }),
    stages: await prisma.stage.count(),
    stageStatuses: await prisma.stageStatus.count(),
    reports: await prisma.report.count(),
    sections: await prisma.reportSection.count(),
    items: await prisma.item.count(),
    statuses: await prisma.projectStatus.count(),
    activities: await prisma.projectActivity.count(),
    activityStatuses: await prisma.activityStatus.count(),
    activityProducts: await prisma.projectActivityProduct.count(),
    activityParentedItems: await prisma.item.count({
      where: { activityId: { not: null } },
    }),
    risks: await prisma.risk.count(),
    decisions: await prisma.decision.count(),
    priorityItems: await prisma.item.count({ where: { priorityRank: { not: null } } }),
    reminderPolicies: await prisma.reminderPolicy.count(),
    reminders: await prisma.reminderRule.count(),
    reopenRequests: await prisma.reopenRequest.count(),
    actionLogs: await prisma.userActionLog.count(),
    organization: await prisma.organization.count(),
    appSettings: await prisma.appSettings.count(),
  };
  console.log(`[seed-simple] Done: ${JSON.stringify(counts)}`);
  console.log(
    `[seed-simple] Active period: ${ACTIVE_MONDAY.toISOString().slice(0, 10)}..${ACTIVE_SUNDAY.toISOString().slice(0, 10)}`,
  );
  await stabilizeSeedRecordIdentities(prisma);
}

main()
  .catch((err) => {
    console.error("[seed-simple] Failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
