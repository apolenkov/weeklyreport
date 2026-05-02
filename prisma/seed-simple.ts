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

import { randomUUID } from 'node:crypto';

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
const LEAD_ALEX = 'a0000000-0000-4000-8000-000000000011';
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
      { id: LEAD_ALEX, email: 'polenkov@customreport.local', name: 'Aleksandr P.', role: Role.lead, samlId: 'lead-polenkov' },
      { id: LEAD_MARIA, email: 'maria@customreport.local', name: 'Maria K.', role: Role.lead, samlId: 'lead-maria' },
      { id: LEAD_IGOR, email: 'igor@customreport.local', name: 'Igor V.', role: Role.lead, samlId: 'lead-igor' },
    ],
  });

  console.log('[seed-simple] Creating products...');
  await prisma.project.createMany({
    data: [
      { id: PROD_CRM, name: 'CRM Platform', leadId: LEAD_ALEX, archived: false },
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
      { id: 'b0000000-0000-4000-8000-000000000001', projectId: PROD_CRM, stageId: STAGE_DEV, userId: LEAD_ALEX },
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
  // Active report — 3 sections, one per lead. Aleksandr P. in draft (showing alert), Maria K. submitted, Igor V. draft.
  // `label` mirrors the user's `name` (e.g. "Aleksandr P."), so seeded
  // decision-owner strings stay equal to `data.currentUser.name` once the
  // form loads — the Owner-mine/owner-other comparison hinges on this.
  const leads = [
    { id: LEAD_ALEX, productId: PROD_CRM, status: ReportSectionStatus.draft, lightStatus: TrafficLightStatus.red, label: 'Aleksandr P.' },
    { id: LEAD_MARIA, productId: PROD_MOBILE, status: ReportSectionStatus.submitted, lightStatus: TrafficLightStatus.yellow, label: 'Maria K.' },
    { id: LEAD_IGOR, productId: PROD_CLOUD, status: ReportSectionStatus.draft, lightStatus: TrafficLightStatus.green, label: 'Igor V.' },
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

    // Each lead's section gets 3 ProjectStatus rows — their primary product
    // plus the other two — so the SDLC pipeline always shows multiple
    // products and the modal "select product" picker has real choices to
    // test. Other-team products land at green status by default.
    const ALL_PRODUCT_IDS: readonly string[] = [PROD_CRM, PROD_MOBILE, PROD_CLOUD];
    for (let pIdx = 0; pIdx < ALL_PRODUCT_IDS.length; pIdx++) {
      const pid = ALL_PRODUCT_IDS[pIdx]!;
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

    // Secondary product ids for this lead — every product except the one
    // they primarily own. Items are sprinkled across primary + secondaries
    // so that Current Week / Next Week always render >1 product column,
    // which is what real cross-team work looks like.
    const SECONDARY = ALL_PRODUCT_IDS.filter((p) => p !== lead.productId);

    // 3 current-week items per lead — mix of workflow states so traffic-light
    // sync, blocker badges, and "completed" toggles are all demoable.
    await prisma.item.createMany({
      data: [
        {
          id: `a0000000-0000-4000-8000-00000005${i + 1}001`,
          reportSectionId: sectionId,
          type: ItemType.current,
          // Primary product: this is the "main" stream the lead is on the
          // hook for. Status mirrors the section's traffic light so the
          // SDLC pipeline + Kanban story line up.
          projectId: lead.productId,
          text: `Refactored auth flow for ${lead.label}'s product`,
          tag: 'feature',
          workflowStatus: lead.lightStatus === TrafficLightStatus.red
            ? ItemWorkflowStatus.blocked
            : ItemWorkflowStatus.in_progress,
          carriedOver: false,
        },
        {
          id: `a0000000-0000-4000-8000-00000005${i + 1}002`,
          reportSectionId: sectionId,
          type: ItemType.current,
          // Cross-team work on the second product so the Current Week
          // grouping shows >1 column.
          projectId: SECONDARY[0]!,
          text: `Shipped cross-team metrics dashboard work`,
          tag: 'feature',
          workflowStatus: ItemWorkflowStatus.done,
          carriedOver: false,
          completed: true,
        },
        {
          id: `a0000000-0000-4000-8000-00000005${i + 1}003`,
          reportSectionId: sectionId,
          type: ItemType.current,
          // Third product so the empty-state path is exercised when the
          // user deletes one of the other groups.
          projectId: SECONDARY[1]!,
          text: `Bug-fix sprint on adjacent product: 4 tickets resolved`,
          tag: 'bugfix',
          workflowStatus: ItemWorkflowStatus.in_progress,
          carriedOver: true,
        },
        // 2 next-week items per lead — one on primary, one cross-team.
        {
          id: `a0000000-0000-4000-8000-00000005${i + 1}004`,
          reportSectionId: sectionId,
          type: ItemType.next,
          projectId: lead.productId,
          text: `Plan: integration tests + E2E coverage for new auth flow`,
          tag: 'infra',
          workflowStatus: ItemWorkflowStatus.in_progress,
          carriedOver: false,
        },
        {
          id: `a0000000-0000-4000-8000-00000005${i + 1}005`,
          reportSectionId: sectionId,
          type: ItemType.next,
          projectId: SECONDARY[0]!,
          text: `Plan: cross-team roadmap review with stakeholders`,
          tag: 'ops',
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
          risk: lead.lightStatus === TrafficLightStatus.red
            ? `Critical: external API regression blocking ${lead.label}'s integration`
            : `Capacity risk: 1 engineer out sick this week`,
          // Impact is a narrative — what specifically gets affected if the
          // risk materialises. Earlier the seed wrote "high"/"medium" which
          // overlapped with the severity enum and made the two fields look
          // redundant.
          impact: lead.lightStatus === TrafficLightStatus.red
            ? 'Delays Q3 launch by 2 weeks; 4 downstream teams idle'
            : 'Sprint velocity drops ~20% — at-risk stories slip a week',
          mitigation: lead.lightStatus === TrafficLightStatus.red
            ? 'Vendor escalation in progress; ETA 48h'
            : 'Workload reshuffled across remaining team',
        },
      });
    }

    // 2 decisions per lead — needed for deadline / owner / impact CRUD demo.
    await prisma.decision.createMany({
      data: [
        {
          id: `a0000000-0000-4000-8000-00000000070${i + 1}`,
          reportSectionId: sectionId,
          text: `Approve hiring of 2 SDETs for ${lead.label}'s team in Q3`,
          owner: lead.label,
          // Impact = narrative consequence of the decision (not severity).
          impact: 'Unblocks regression coverage; cuts release-prep cycle by ~3 days',
        },
        {
          id: randomUUID(),
          reportSectionId: sectionId,
          text: `Decision: switch monitoring stack to Grafana + Loki`,
          owner: 'Head',
          impact: 'Replaces aging legacy monitor; enables alert-as-code workflow',
          deadline: new Date('2026-05-15T00:00:00Z'),
        },
      ],
    });

    // 3 priorities per lead — fills all 3 fixed slots in the new UI.
    await prisma.priority.createMany({
      data: [
        {
          id: `a0000000-0000-4000-8000-00000000080${i + 1}`,
          reportSectionId: sectionId,
          text: `Unblock ${lead.label}'s critical-path delivery`,
          rank: 1,
        },
        {
          id: randomUUID(),
          reportSectionId: sectionId,
          text: `Hire SDET (interview pipeline ready)`,
          rank: 2,
        },
        {
          id: randomUUID(),
          reportSectionId: sectionId,
          text: `Reduce on-call paging volume by 30%`,
          rank: 3,
        },
      ],
    });
  }

  console.log('[seed-simple] Creating version snapshots (Aleksandr P. section, 2 versions)...');
  // VersionSnapshot rows feed the "previous version" picker — at least 2
  // versions needed so the chevrons activate and Restore is testable.
  const alexSectionId = `a0000000-0000-4000-8000-000000000401`;
  await prisma.versionSnapshot.createMany({
    data: [
      {
        id: randomUUID(),
        reportSectionId: alexSectionId,
        version: 1,
        data: { note: 'initial draft', items: [], risks: [], decisions: [], priorities: [] },
      },
      {
        id: randomUUID(),
        reportSectionId: alexSectionId,
        version: 2,
        data: { note: 'after first save', items: [], risks: [], decisions: [], priorities: [] },
      },
    ],
  });

  console.log('[seed-simple] Creating published Week 15 sections (for Fill-from-Previous)...');
  // Each lead's previous-week submission, status=submitted, with one item
  // per type and one priority — enough to populate the "Fill from Previous"
  // copy flow.
  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i]!;
    const prevSectionId = `a0000000-0000-4000-8000-00000000041${i + 1}`;
    await prisma.reportSection.create({
      data: {
        id: prevSectionId,
        reportId: REPORT_PUBLISHED,
        authorId: lead.id,
        status: ReportSectionStatus.submitted,
        submittedAt: new Date('2026-04-10T14:00:00Z'),
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
          text: `Last week: closed sprint goals for ${lead.label}'s team`,
          tag: 'feature',
          workflowStatus: ItemWorkflowStatus.done,
          carriedOver: false,
          completed: true,
        },
        {
          id: randomUUID(),
          reportSectionId: prevSectionId,
          type: ItemType.next,
          projectId: lead.productId,
          text: `Carry over: continue auth-flow refactor`,
          tag: 'feature',
          workflowStatus: ItemWorkflowStatus.in_progress,
          carriedOver: false,
        },
      ],
    });

    await prisma.priority.create({
      data: {
        id: randomUUID(),
        reportSectionId: prevSectionId,
        text: `Week 15 priority for ${lead.label}`,
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
    decisions: await prisma.decision.count(),
    priorities: await prisma.priority.count(),
    versionSnapshots: await prisma.versionSnapshot.count(),
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
