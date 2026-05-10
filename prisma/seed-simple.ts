/**
 * SIMPLE seed — minimal demo data for live presentation.
 *
 * Clean slate with just enough rows to show every feature without overwhelming:
 *   - 1 head, 1 viewer, 1 admin, 6 leads (RU names — Phase 35-08)
 *   - 6 products (one per lead)
 *   - 7 SDLC stages
 *   - 2 reports (current week active + previous week published — dynamic dates)
 *   - Per-lead: 1 ProjectStatus + 5 items + 1 risk + 2 decisions + 3 priorities
 *   - 2 reminder rules (deadline T-24h, escalation T+2h)
 *
 * Differs from seed.ts (advanced, 12 products / 6 leads / dozens of items)
 * which is the canonical fixture for tests. This simple seed is for
 * `pnpm db:seed:simple` only — the migrations.seed in prisma.config.ts
 * still points at seed.ts.
 *
 * Phase 35-08 (FIX-01): the active period is anchored to the *current*
 * week (Monday..Sunday in UTC) so weeklyReport.get always finds an open
 * report covering today. Previously the static 2026-04-13..04-19 window
 * drifted into the past after that week ended → WeeklyReportDomainError
 * 'No active report period found' on every page load.
 *
 * Phase 35-08 (RU): every Item.text / Risk.{risk,impact,mitigation} /
 * Decision.text / Priority.text / Project.name / User.name is in Russian
 * Cyrillic. Realistic content for a Development department demo.
 *
 * Run:
 *   PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION='давай' pnpm db:seed:simple
 */

import "dotenv/config";

import { randomUUID } from "node:crypto";

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
  ReminderRuleKind,
  ReminderRuleStatus,
} from "@prisma/client";

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

const PROD_CRM = "a0000000-0000-4000-8000-000000000201";
const PROD_MOBILE = "a0000000-0000-4000-8000-000000000203";
const PROD_CLOUD = "a0000000-0000-4000-8000-000000000205";
const PROD_DEVOPS = "a0000000-0000-4000-8000-000000000207";
const PROD_PAYMENTS = "a0000000-0000-4000-8000-000000000209";
const PROD_HR = "a0000000-0000-4000-8000-00000000020b";

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

// ---- Date helpers (FIX-01, Phase 35-08) ----
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

// UFB-037: extra historical + future periods so the Periods admin tab and
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
  console.log("[seed-simple] Wiping existing data...");
  // Delete in FK-safe order. ReopenRequest references ReportSection → must
  // go before ReportSection deletes. Other CASCADE FKs (ProjectStatus →
  // ReportSection, Items → ReportSection, etc.) flow naturally.
  await prisma.reminderExecution.deleteMany({});
  await prisma.reminderRule.deleteMany({});
  await prisma.aiInsight.deleteMany({});
  await prisma.priority.deleteMany({});
  await prisma.decision.deleteMany({});
  await prisma.risk.deleteMany({});
  await prisma.item.deleteMany({});
  await prisma.stageStatus.deleteMany({});
  await prisma.projectStatus.deleteMany({});
  await prisma.versionSnapshot.deleteMany({});
  await prisma.reopenRequest.deleteMany({});
  await prisma.reportSection.deleteMany({});
  await prisma.pdfExportJob.deleteMany({});
  await prisma.report.deleteMany({});
  await prisma.stageAssignment.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.stage.deleteMany({});
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

  console.log("[seed-simple] Creating users (RU names)...");
  await prisma.user.createMany({
    data: [
      {
        id: HEAD_ID,
        email: "head@customreport.local",
        name: "Антон К.",
        role: Role.head,
        samlId: "head-1",
        reportingGroupId: DEFAULT_REPORTING_GROUP_ID,
      },
      {
        id: VIEWER_ID,
        email: "viewer@customreport.local",
        name: "Дарья В.",
        role: Role.viewer,
        samlId: "viewer-1",
        reportingGroupId: DEFAULT_REPORTING_GROUP_ID,
      },
      {
        id: ADMIN_ID,
        email: "admin@customreport.local",
        name: "Антон К.",
        role: Role.admin,
        samlId: "admin-1",
        reportingGroupId: DEFAULT_REPORTING_GROUP_ID,
      },
      {
        id: LEAD_1,
        email: "lead1@customreport.local",
        name: "Василий И.",
        role: Role.lead,
        samlId: "lead-1",
        reportingGroupId: DEFAULT_REPORTING_GROUP_ID,
      },
      {
        id: LEAD_MARIA,
        email: "maria@customreport.local",
        name: "Мария К.",
        role: Role.lead,
        samlId: "lead-maria",
        reportingGroupId: DEFAULT_REPORTING_GROUP_ID,
      },
      {
        id: LEAD_IGOR,
        email: "igor@customreport.local",
        name: "Игорь В.",
        role: Role.lead,
        samlId: "lead-igor",
        reportingGroupId: DEFAULT_REPORTING_GROUP_ID,
      },
      {
        id: LEAD_DMITRY,
        email: "dmitry@customreport.local",
        name: "Дмитрий С.",
        role: Role.lead,
        samlId: "lead-dmitry",
        reportingGroupId: DEFAULT_REPORTING_GROUP_ID,
      },
      {
        id: LEAD_OLGA,
        email: "olga@customreport.local",
        name: "Ольга Н.",
        role: Role.lead,
        samlId: "lead-olga",
        reportingGroupId: DEFAULT_REPORTING_GROUP_ID,
      },
      {
        id: LEAD_SERGEY,
        email: "sergey@customreport.local",
        name: "Сергей Т.",
        role: Role.lead,
        samlId: "lead-sergey",
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
    ],
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

  // 35-04 (BUG-143 reproducer): the primary seeded lead owns ALL 7 stages of their
  // primary project (Маркетинговый портал) so the bug case "lead
  // assigned everywhere shows up correctly on /lead/report" can be
  // exercised end-to-end. Other leads stay on the single-Development
  // assignment from before — the dashboard variety they provide is
  // still useful and the all-7 case only needs one fixture.
  console.log(
    "[seed-simple] Creating stage assignments (primary lead owns 7/7 on CRM, others own Development of their product)...",
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
  await prisma.stageAssignment.createMany({
    data: [
      ...allStageIds.map((stageId, idx) => ({
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
      },
      ...EXTRA_REPORTS.map((r) => ({
        id: r.id,
        periodStart: r.monday,
        periodEnd: endOfDayUTC(plusDaysUTC(r.monday, 6)),
        deadline: fridayDeadlineFor(r.monday),
        weekLabel: `Week ${isoWeekNumber(r.monday)}`,
        periodStatus: r.periodStatus,
        status: r.status,
        publishedAt: r.publishedAt,
        publishedById: r.publishedAt ? HEAD_ID : null,
      })),
    ],
  });

  console.log(
    "[seed-simple] Creating sections + items + risks + priorities (RU)...",
  );
  // Active report — 6 sections, one per lead. Mix of statuses + traffic lights
  // so the dashboard has visible variety. `label` mirrors the user's
  // `name` exactly so seeded decision-owner strings stay equal to
  // `data.currentUser.name` once the form loads.
  type LeadCfg = {
    id: string;
    productId: string;
    status: ReportSectionStatus;
    lightStatus: TrafficLightStatus;
    label: string;
  };
  const leads: LeadCfg[] = [
    {
      id: LEAD_1,
      productId: PROD_CRM,
      status: ReportSectionStatus.draft,
      lightStatus: TrafficLightStatus.red,
      label: "Василий И.",
    },
    {
      id: LEAD_MARIA,
      productId: PROD_MOBILE,
      status: ReportSectionStatus.submitted,
      lightStatus: TrafficLightStatus.yellow,
      label: "Мария К.",
    },
    {
      id: LEAD_IGOR,
      productId: PROD_CLOUD,
      status: ReportSectionStatus.draft,
      lightStatus: TrafficLightStatus.green,
      label: "Игорь В.",
    },
    {
      id: LEAD_DMITRY,
      productId: PROD_DEVOPS,
      status: ReportSectionStatus.submitted,
      lightStatus: TrafficLightStatus.green,
      label: "Дмитрий С.",
    },
    {
      id: LEAD_OLGA,
      productId: PROD_PAYMENTS,
      status: ReportSectionStatus.draft,
      lightStatus: TrafficLightStatus.yellow,
      label: "Ольга Н.",
    },
    {
      id: LEAD_SERGEY,
      productId: PROD_HR,
      status: ReportSectionStatus.draft,
      lightStatus: TrafficLightStatus.green,
      label: "Сергей Т.",
    },
  ];

  const ALL_PRODUCT_IDS: readonly string[] = [
    PROD_CRM,
    PROD_MOBILE,
    PROD_CLOUD,
    PROD_DEVOPS,
    PROD_PAYMENTS,
    PROD_HR,
  ];

  // RU content for each lead. Realistic weekly status updates.
  type LeadContent = {
    currentItems: {
      text: string;
      tag: string;
      status: ItemWorkflowStatus;
      carriedOver?: boolean;
      completed?: boolean;
    }[];
    nextItems: { text: string; tag: string }[];
    risk?: { risk: string; impact: string; mitigation: string };
    decisions: {
      text: string;
      owner: string;
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
          status: ItemWorkflowStatus.blocked,
        },
        {
          text: "Зафиксил 4 бага по интеграции SDK с CRM",
          tag: "bugfix",
          status: ItemWorkflowStatus.done,
          completed: true,
        },
        {
          text: "Перенёс A/B тесты на новую инфраструктуру",
          tag: "infra",
          status: ItemWorkflowStatus.in_progress,
          carriedOver: true,
        },
      ],
      nextItems: [
        { text: "Запланировал ревью архитектуры с платформенной командой", tag: "ops" },
        { text: "Подготовка демо для квартального ревью", tag: "feature" },
      ],
      risk: {
        risk: "Риск: внешний API контрагента нестабилен на пике трафика",
        impact: "Влияние: задержка релиза Q2 на одну неделю",
        mitigation:
          "Митигация: фолбэк через очередь повтора + эскалация партнёру",
      },
      decisions: [
        {
          text: "Решение: переезд на новый IdP до конца месяца",
          owner: "Василий И.",
          impact: "Закрывает риск устаревшего OAuth-провайдера",
        },
        {
          text: "Решение: согласовать наём двух middle-разработчиков на Q3",
          owner: "Антон К.",
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
          completed: true,
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
      },
      decisions: [
        {
          text: "Решение: завести E2E-сьют чекаута в обязательный ночной прогон",
          owner: "Мария К.",
          impact: "Снижает риск регрессий в проде на ~70%",
        },
        {
          text: "Решение: согласовать выделенный bug-bash день перед релизом",
          owner: "Антон К.",
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
          completed: true,
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
          completed: true,
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
          owner: "Антон К.",
          impact: "Закрывает tech-debt по пулу соединений",
          deadline: plusDaysUTC(ACTIVE_MONDAY, 5),
        },
        {
          text: "Решение: выделить бюджет на observability stack v2",
          owner: "Антон К.",
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
          completed: true,
        },
        {
          text: "Тюнинг WAF: ложных срабатываний минус 40%",
          tag: "ops",
          status: ItemWorkflowStatus.done,
          completed: true,
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
          owner: "Антон К.",
          impact: "Снижает риск инцидентов на проде, безопасный rollback",
        },
        {
          text: "Решение: выделить SDET-инженера на покрытие security-сценариев",
          owner: "Дмитрий С.",
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
          completed: true,
        },
        {
          text: "Починили двойное списание при timeout (idempotency-key через Redis)",
          tag: "bugfix",
          status: ItemWorkflowStatus.done,
          completed: true,
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
      },
      decisions: [
        {
          text: "Решение: раскатать 3DS v2 на 100% трафика после стабилизации",
          owner: "Ольга Н.",
          impact: "Закрывает требование PSD2 для платёжного шлюза",
          deadline: plusDaysUTC(ACTIVE_MONDAY, 14),
        },
        {
          text: "Решение: согласовать UX-сценарий восстановления при отмене 3DS",
          owner: "Антон К.",
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
          completed: true,
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
          completed: true,
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
          owner: "Антон К.",
          impact: "Снижает onboarding-трение для новых сотрудников",
        },
        {
          text: "Решение: согласовать архитектуру модуля 360-feedback",
          owner: "Сергей Т.",
          impact: "Закрывает roadmap-цель Q3 по HR-аналитике",
        },
      ],
      priorities: [
        "Демо HR-аналитики для совета директоров",
        "Интеграция с корпоративным SSO для HR-системы",
        "Архитектура модуля 360-feedback",
      ],
    },
  };

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i]!;
    const content = contentByLead[lead.id]!;
    const sectionId = `a0000000-0000-4000-8000-00000000040${i + 1}`;
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
    const SECONDARY = ALL_PRODUCT_IDS.filter((p) => p !== lead.productId).slice(
      0,
      2,
    );
    const STATUS_PRODUCTS: readonly string[] = [lead.productId, ...SECONDARY];
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

    // 35-04: pick a default stage to seed on every Item / Risk / Decision /
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
        completed: it.completed ?? false,
        stageName: stageFor(idx),
      })),
      ...content.nextItems.map((it, idx) => ({
        id: `a0000000-0000-4000-8000-00000005${i + 1}01${idx + 1}`,
        reportSectionId: sectionId,
        type: ItemType.next,
        projectId:
          idx === 0 ? lead.productId : SECONDARY[idx % SECONDARY.length]!,
        text: it.text,
        tag: it.tag,
        workflowStatus: ItemWorkflowStatus.in_progress,
        carriedOver: false,
        completed: false,
        stageName: stageFor(idx + 100),
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
          stageName: stageFor(0),
        },
      });
    }

    await prisma.decision.createMany({
      data: content.decisions.map((d, dIdx) => ({
        id:
          dIdx === 0
            ? `a0000000-0000-4000-8000-00000000070${i + 1}`
            : randomUUID(),
        reportSectionId: sectionId,
        text: d.text,
        owner: d.owner,
        impact: d.impact,
        deadline: d.deadline ?? null,
        stageName: stageFor(dIdx),
      })),
    });

    await prisma.priority.createMany({
      data: content.priorities.map((text, idx) => ({
        id:
          idx === 0
            ? `a0000000-0000-4000-8000-00000000080${i + 1}`
            : randomUUID(),
        reportSectionId: sectionId,
        text,
        rank: idx + 1,
        stageName: stageFor(idx),
      })),
    });
  }

  console.log(
    "[seed-simple] Creating version snapshots (primary lead section, 2 versions)...",
  );
  const lead1SectionId = `a0000000-0000-4000-8000-000000000401`;
  await prisma.versionSnapshot.createMany({
    data: [
      {
        id: randomUUID(),
        reportSectionId: lead1SectionId,
        version: 1,
        data: {
          note: "начальный черновик",
          items: [],
          risks: [],
          decisions: [],
          priorities: [],
        },
      },
      {
        id: randomUUID(),
        reportSectionId: lead1SectionId,
        version: 2,
        data: {
          note: "после первого сохранения",
          items: [],
          risks: [],
          decisions: [],
          priorities: [],
        },
      },
    ],
  });

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
        id: randomUUID(),
        reportSectionId: prevSectionId,
        projectId: lead.productId,
        status: TrafficLightStatus.green,
      },
    });

    await prisma.item.createMany({
      data: [
        {
          id: randomUUID(),
          reportSectionId: prevSectionId,
          type: ItemType.current,
          projectId: lead.productId,
          text: `Закрыли спринтовые цели команды ${lead.label} на прошлой неделе`,
          tag: "feature",
          workflowStatus: ItemWorkflowStatus.done,
          carriedOver: false,
          completed: true,
        },
        {
          id: randomUUID(),
          reportSectionId: prevSectionId,
          type: ItemType.next,
          projectId: lead.productId,
          text: `Перенос: продолжить рефакторинг авторизации`,
          tag: "feature",
          workflowStatus: ItemWorkflowStatus.in_progress,
          carriedOver: false,
        },
      ],
    });

    await prisma.priority.create({
      data: {
        id: randomUUID(),
        reportSectionId: prevSectionId,
        text: `Приоритет прошлой недели: ${lead.label}`,
        rank: 1,
      },
    });
  }

  console.log(
    "[seed-simple] Creating reminder rules (deadline + escalation)...",
  );
  await prisma.reminderRule.createMany({
    data: [
      {
        id: "a0000000-0000-4000-8000-000000000801",
        reportId: REPORT_ACTIVE,
        kind: ReminderRuleKind.deadline,
        fireAt: ACTIVE_REMINDER_DEADLINE_FIRE,
        timezone: "Europe/Moscow",
        status: ReminderRuleStatus.active,
        version: 1,
      },
      {
        id: "a0000000-0000-4000-8000-000000000802",
        reportId: REPORT_ACTIVE,
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
    reports: await prisma.report.count(),
    sections: await prisma.reportSection.count(),
    items: await prisma.item.count(),
    statuses: await prisma.projectStatus.count(),
    risks: await prisma.risk.count(),
    decisions: await prisma.decision.count(),
    priorities: await prisma.priority.count(),
    versionSnapshots: await prisma.versionSnapshot.count(),
    reminders: await prisma.reminderRule.count(),
  };
  console.log(`[seed-simple] Done: ${JSON.stringify(counts)}`);
  console.log(
    `[seed-simple] Active period: ${ACTIVE_MONDAY.toISOString().slice(0, 10)}..${ACTIVE_SUNDAY.toISOString().slice(0, 10)}`,
  );
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
