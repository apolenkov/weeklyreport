/**
 * SIMPLE seed — minimal demo data for live presentation.
 *
 * Clean slate with just enough rows to show every feature without overwhelming:
 *   - 1 head, 1 viewer, 1 admin, 3 leads
 *   - 3 products (one per lead)
 *   - 7 SDLC stages
 *   - 2 reports (Week 16 active, Week 15 published)
 *   - Per-lead: 1 ProjectStatus + 2 items + 1 risk + 1 priority on the active report
 *   - 2 reminder rules (deadline T-24h, escalation T+2h)
 *
 * Differs from seed.ts (advanced, 12 products / 6 leads / dozens of items)
 * which is the canonical fixture for tests. This simple seed is for
 * `pnpm db:seed:simple` only — the migrations.seed in prisma.config.ts
 * still points at seed.ts.
 *
 * Run:
 *   PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION='давай' pnpm db:seed:simple
 */

import 'dotenv/config';

import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
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
} from '@prisma/client';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const HEAD_ID = 'a0000000-0000-4000-8000-000000000099';
const VIEWER_ID = 'a0000000-0000-4000-8000-000000000098';
const ADMIN_ID = 'a0000000-0000-4000-8000-000000000097';
const LEAD_PLATANOV = 'a0000000-0000-4000-8000-000000000011';
const LEAD_MARIA = 'a0000000-0000-4000-8000-000000000012';
const LEAD_IGOR = 'a0000000-0000-4000-8000-000000000013';

const PROD_CRM = 'a0000000-0000-4000-8000-000000000201';
const PROD_MOBILE = 'a0000000-0000-4000-8000-000000000203';
const PROD_CLOUD = 'a0000000-0000-4000-8000-000000000205';

const STAGE_PLAN = 'a0000000-0000-4000-8000-000000000701';
const STAGE_DEV = 'a0000000-0000-4000-8000-000000000704';
const STAGE_TEST = 'a0000000-0000-4000-8000-000000000705';

const REPORT_ACTIVE = 'a0000000-0000-4000-8000-000000000001';
const REPORT_PUBLISHED = 'a0000000-0000-4000-8000-000000000002';

async function main() {
  console.log('[seed-simple] Wiping existing data...');
  // Delete in FK-safe order
  await prisma.reminderExecution.deleteMany({});
  await prisma.reminderRule.deleteMany({});
  await prisma.aiInsight.deleteMany({});
  await prisma.priority.deleteMany({});
  await prisma.decision.deleteMany({});
  await prisma.risk.deleteMany({});
  await prisma.item.deleteMany({});
  await prisma.projectStatus.deleteMany({});
  await prisma.versionSnapshot.deleteMany({});
  await prisma.reportSection.deleteMany({});
  await prisma.pdfExportJob.deleteMany({});
  await prisma.report.deleteMany({});
  await prisma.stageAssignment.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.stage.deleteMany({});
  await prisma.user.deleteMany({});

  console.log('[seed-simple] Creating users...');
  await prisma.user.createMany({
    data: [
      { id: HEAD_ID, email: 'head@customreport.local', name: 'Department Head', role: Role.head, samlId: 'head-1' },
      { id: VIEWER_ID, email: 'viewer@customreport.local', name: 'Report Viewer', role: Role.viewer, samlId: 'viewer-1' },
      { id: ADMIN_ID, email: 'admin@customreport.local', name: 'Administrator', role: Role.admin, samlId: 'admin-1' },
      { id: LEAD_PLATANOV, email: 'platanov@customreport.local', name: 'Platanov A.', role: Role.lead, samlId: 'lead-platanov' },
      { id: LEAD_MARIA, email: 'maria@customreport.local', name: 'Maria K.', role: Role.lead, samlId: 'lead-maria' },
      { id: LEAD_IGOR, email: 'igor@customreport.local', name: 'Igor V.', role: Role.lead, samlId: 'lead-igor' },
    ],
  });

  console.log('[seed-simple] Creating products...');
  await prisma.project.createMany({
    data: [
      { id: PROD_CRM, name: 'CRM Platform', leadId: LEAD_PLATANOV, archived: false },
      { id: PROD_MOBILE, name: 'Mobile Banking App', leadId: LEAD_MARIA, archived: false },
      { id: PROD_CLOUD, name: 'Cloud Infrastructure', leadId: LEAD_IGOR, archived: false },
    ],
  });

  console.log('[seed-simple] Creating stages...');
  await prisma.stage.createMany({
    data: [
      { id: STAGE_PLAN, name: 'Planning', sortOrder: 0 },
      { id: 'a0000000-0000-4000-8000-000000000702', name: 'Analysis', sortOrder: 1 },
      { id: 'a0000000-0000-4000-8000-000000000703', name: 'Design', sortOrder: 2 },
      { id: STAGE_DEV, name: 'Development', sortOrder: 3 },
      { id: STAGE_TEST, name: 'Testing', sortOrder: 4 },
      { id: 'a0000000-0000-4000-8000-000000000706', name: 'DevOps', sortOrder: 5 },
      { id: 'a0000000-0000-4000-8000-000000000707', name: 'Support', sortOrder: 6 },
    ],
  });

  console.log('[seed-simple] Creating stage assignments (each lead owns "Development" of their product)...');
  await prisma.stageAssignment.createMany({
    data: [
      { id: 'b0000000-0000-4000-8000-000000000001', projectId: PROD_CRM, stageId: STAGE_DEV, userId: LEAD_PLATANOV },
      { id: 'b0000000-0000-4000-8000-000000000002', projectId: PROD_MOBILE, stageId: STAGE_DEV, userId: LEAD_MARIA },
      { id: 'b0000000-0000-4000-8000-000000000003', projectId: PROD_CLOUD, stageId: STAGE_DEV, userId: LEAD_IGOR },
    ],
  });

  console.log('[seed-simple] Creating reports...');
  await prisma.report.createMany({
    data: [
      {
        id: REPORT_ACTIVE,
        periodStart: new Date('2026-04-13T00:00:00Z'),
        periodEnd: new Date('2026-04-19T23:59:59Z'),
        deadline: new Date('2026-04-17T15:00:00Z'),
        weekLabel: 'Week 16',
        periodStatus: PeriodStatus.open,
        status: ReportStatus.draft,
      },
      {
        id: REPORT_PUBLISHED,
        periodStart: new Date('2026-04-06T00:00:00Z'),
        periodEnd: new Date('2026-04-12T23:59:59Z'),
        deadline: new Date('2026-04-10T15:00:00Z'),
        weekLabel: 'Week 15',
        periodStatus: PeriodStatus.published,
        status: ReportStatus.published,
        publishedAt: new Date('2026-04-12T16:00:00Z'),
        publishedById: HEAD_ID,
      },
    ],
  });

  console.log('[seed-simple] Creating sections + items + risks + priorities...');
  // Active report — 3 sections, one per lead. Platanov in draft (showing alert), Maria submitted, Igor draft.
  const leads = [
    { id: LEAD_PLATANOV, productId: PROD_CRM, status: ReportSectionStatus.draft, lightStatus: TrafficLightStatus.red, label: 'Platanov' },
    { id: LEAD_MARIA, productId: PROD_MOBILE, status: ReportSectionStatus.submitted, lightStatus: TrafficLightStatus.yellow, label: 'Maria' },
    { id: LEAD_IGOR, productId: PROD_CLOUD, status: ReportSectionStatus.draft, lightStatus: TrafficLightStatus.green, label: 'Igor' },
  ];

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i]!;
    const sectionId = `a0000000-0000-4000-8000-00000000040${i + 1}`;
    await prisma.reportSection.create({
      data: {
        id: sectionId,
        reportId: REPORT_ACTIVE,
        authorId: lead.id,
        status: lead.status,
        submittedAt: lead.status === ReportSectionStatus.submitted ? new Date('2026-04-17T10:00:00Z') : null,
      },
    });

    await prisma.projectStatus.create({
      data: {
        id: `a0000000-0000-4000-8000-00000000060${i + 1}`,
        reportSectionId: sectionId,
        projectId: lead.productId,
        status: lead.lightStatus,
      },
    });

    await prisma.item.createMany({
      data: [
        {
          id: `a0000000-0000-4000-8000-00000000050${i + 1}a`,
          reportSectionId: sectionId,
          type: ItemType.current,
          projectId: lead.productId,
          text: `Demo current-week item for ${lead.label}`,
          tag: 'feature',
          workflowStatus: ItemWorkflowStatus.in_progress,
          carriedOver: false,
        },
        {
          id: `a0000000-0000-4000-8000-00000000050${i + 1}b`,
          reportSectionId: sectionId,
          type: ItemType.next,
          projectId: lead.productId,
          text: `Demo next-week item for ${lead.label}`,
          tag: 'feature',
          workflowStatus: ItemWorkflowStatus.in_progress,
          carriedOver: false,
        },
      ],
    });

    if (lead.lightStatus !== TrafficLightStatus.green) {
      await prisma.risk.create({
        data: {
          id: `a0000000-0000-4000-8000-00000000090${i + 1}`,
          reportSectionId: sectionId,
          projectId: lead.productId,
          risk: `Demo risk for ${lead.label}`,
          impact: 'Mitigation in progress',
          mitigation: 'Pairing with team',
        },
      });
    }

    await prisma.priority.create({
      data: {
        id: `a0000000-0000-4000-8000-00000000080${i + 1}`,
        reportSectionId: sectionId,
        text: `Top priority for ${lead.label} this week`,
        rank: 1,
      },
    });
  }

  console.log('[seed-simple] Creating reminder rules (deadline + escalation)...');
  await prisma.reminderRule.createMany({
    data: [
      {
        id: 'a0000000-0000-4000-8000-000000000801',
        reportId: REPORT_ACTIVE,
        kind: ReminderRuleKind.deadline,
        fireAt: new Date('2026-04-16T15:00:00Z'),
        timezone: 'Europe/Moscow',
        status: ReminderRuleStatus.active,
        version: 1,
      },
      {
        id: 'a0000000-0000-4000-8000-000000000802',
        reportId: REPORT_ACTIVE,
        kind: ReminderRuleKind.escalation,
        fireAt: new Date('2026-04-17T17:00:00Z'),
        timezone: 'Europe/Moscow',
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
    priorities: await prisma.priority.count(),
    reminders: await prisma.reminderRule.count(),
  };
  console.log(`[seed-simple] Done: ${JSON.stringify(counts)}`);
}

main()
  .catch((err) => {
    console.error('[seed-simple] Failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
