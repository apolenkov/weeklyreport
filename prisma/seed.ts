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
} from '@prisma/client';

import {
  SEED_USERS,
  SEED_PRODUCTS,
  SEED_STAGES,
  SEED_REPORTS,
  HEAD_USER_ID,
  LEAD_POLENKOV_ID,
  LEAD_MARIA_ID,
  LEAD_IGOR_ID,
  LEAD_DMITRY_ID,
  LEAD_OLGA_ID,
  LEAD_SERGEY_ID,
} from './seed-constants.js';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Map seed user role string to Prisma Role enum
function toRole(role: 'head' | 'viewer' | 'lead'): Role {
  return Role[role];
}

// Deterministic UUIDs for child rows so re-running stays idempotent.
// Last UUID segment is exactly 12 hex chars: 8-4-4-4-12 = 36 char UUID.
//
// Layout (12 chars total in last segment):
//   sectionId:         0000000040{r}{N}     -> 10 + 1 + 1 = 12
//   itemId:            000000005{r}{N}{S}   -> 9 + 1 + 1 + 1 = 12
//   projectStatusId:   000000006{r}{N}{P}   -> 9 + 1 + 1 + 1 = 12
//   priorityId:        000000008{r}{N}{R}   -> 9 + 1 + 1 + 1 = 12
//   stageAssignmentId: 00000000b0{P}{S}     -> 10 + 1 + 1 = 12 (P is hex 0..b)
//   riskId:            00000000090{NN}      -> 11 + 2-digit seq with padStart(2)
//   decisionId:        00000000000a{S}      -> 11 + 1 = 12
function sectionId(reportSuffix: '1' | '2', leadIndex: number): string {
  return `a0000000-0000-4000-8000-0000000040${reportSuffix}${leadIndex}`;
}

function itemId(reportSuffix: '1' | '2', leadIndex: number, itemSeq: number): string {
  return `a0000000-0000-4000-8000-000000005${reportSuffix}${leadIndex}${itemSeq}`;
}

function projectStatusId(reportSuffix: '1' | '2', leadIndex: number, prodSeq: number): string {
  return `a0000000-0000-4000-8000-000000006${reportSuffix}${leadIndex}${prodSeq}`;
}

function priorityId(reportSuffix: '1' | '2', leadIndex: number, rank: number): string {
  return `a0000000-0000-4000-8000-000000008${reportSuffix}${leadIndex}${rank}`;
}

function riskId(seq: number): string {
  // 0000000009 (10) + 2-digit seq = 12
  return `a0000000-0000-4000-8000-0000000009${seq.toString().padStart(2, '0')}`;
}

function decisionId(seq: number): string {
  // 00000000000a (12) + seq -> would overflow; use 00000000a (9) + 3-digit pad = 12
  return `a0000000-0000-4000-8000-00000000a${seq.toString().padStart(3, '0')}`;
}

function stageAssignmentId(prodSeq: number, stageSeq: number): string {
  return `a0000000-0000-4000-8000-00000000b0${prodSeq.toString(16)}${stageSeq}`;
}

async function main() {
  // --- 1. Users (1 head, 1 viewer, 6 leads) ---
  for (const user of SEED_USERS) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        id: user.id,
        name: user.name,
        role: toRole(user.role),
        samlId: user.samlId,
      },
      create: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: toRole(user.role),
        samlId: user.samlId,
      },
    });
  }

  // --- 2. Products (12, 2 per lead) ---
  for (const product of SEED_PRODUCTS) {
    await prisma.project.upsert({
      where: { id: product.id },
      update: {
        name: product.name,
        leadId: product.leadId,
      },
      create: {
        id: product.id,
        name: product.name,
        leadId: product.leadId,
      },
    });
  }

  // --- 3. SDLC stages (7) ---
  for (const stage of SEED_STAGES) {
    await prisma.stage.upsert({
      where: { name: stage.name },
      update: { sortOrder: stage.sortOrder },
      create: {
        id: stage.id,
        name: stage.name,
        sortOrder: stage.sortOrder,
      },
    });
  }

  // --- 4. Stage assignments (each product's lead owns 2-3 stages on it) ---
  // Deterministic pattern: every product gets its lead assigned to 3
  // consecutive stages starting at index (productSeqWithinLead * 2 + leadIdx) % 7
  // This produces realistic, varied pipeline data without overlap.
  let stageAssignmentCount = 0;
  for (let pIdx = 0; pIdx < SEED_PRODUCTS.length; pIdx++) {
    const product = SEED_PRODUCTS[pIdx]!;
    const startStageIdx = pIdx % SEED_STAGES.length;
    // Assign 3 consecutive stages
    for (let offset = 0; offset < 3; offset++) {
      const stage = SEED_STAGES[(startStageIdx + offset) % SEED_STAGES.length]!;
      const recordId = stageAssignmentId(pIdx, offset);
      await prisma.stageAssignment.upsert({
        where: {
          userId_stageId_projectId: {
            userId: product.leadId,
            stageId: stage.id,
            projectId: product.id,
          },
        },
        update: {},
        create: {
          id: recordId,
          userId: product.leadId,
          stageId: stage.id,
          projectId: product.id,
        },
      });
      stageAssignmentCount++;
    }
  }

  // --- 5. Active report (Week 16) ---
  const activeReport = SEED_REPORTS.active;
  await prisma.report.upsert({
    where: { id: activeReport.id },
    update: {
      periodStart: new Date(activeReport.periodStart),
      periodEnd: new Date(activeReport.periodEnd),
      deadline: new Date(activeReport.deadline),
      status: ReportStatus[activeReport.status],
      periodStatus: PeriodStatus[activeReport.periodStatus],
      weekLabel: activeReport.weekLabel,
    },
    create: {
      id: activeReport.id,
      periodStart: new Date(activeReport.periodStart),
      periodEnd: new Date(activeReport.periodEnd),
      deadline: new Date(activeReport.deadline),
      status: ReportStatus[activeReport.status],
      periodStatus: PeriodStatus[activeReport.periodStatus],
      weekLabel: activeReport.weekLabel,
    },
  });

  // --- 6. Published report (Week 15) ---
  const publishedReport = SEED_REPORTS.published;
  await prisma.report.upsert({
    where: { id: publishedReport.id },
    update: {
      periodStart: new Date(publishedReport.periodStart),
      periodEnd: new Date(publishedReport.periodEnd),
      deadline: new Date(publishedReport.deadline),
      status: ReportStatus[publishedReport.status],
      periodStatus: PeriodStatus[publishedReport.periodStatus],
      weekLabel: publishedReport.weekLabel,
      publishedAt: new Date(publishedReport.publishedAt),
      publishedById: HEAD_USER_ID,
    },
    create: {
      id: publishedReport.id,
      periodStart: new Date(publishedReport.periodStart),
      periodEnd: new Date(publishedReport.periodEnd),
      deadline: new Date(publishedReport.deadline),
      status: ReportStatus[publishedReport.status],
      periodStatus: PeriodStatus[publishedReport.periodStatus],
      weekLabel: publishedReport.weekLabel,
      publishedAt: new Date(publishedReport.publishedAt),
      publishedById: HEAD_USER_ID,
    },
  });

  // ----- Active report (Week 16) sections -----
  // Section status plan (matches MOCK_KPI: submitted: 4, total: 6, pendingCount: 2):
  //   Polenkov A. -> submitted (Apr 14 10:00)
  //   Maria K.    -> submitted (Apr 14 14:00)
  //   Igor V.     -> submitted (Apr 15 09:30)
  //   Dmitry S.   -> submitted (Apr 16 11:15)
  //   Olga N.     -> draft     (real draft, has items)
  //   Sergey T.   -> draft     (no items -> shows as 'pending' in UI)
  type LeadConfig = {
    leadId: string;
    leadIndex: number; // 1..6 for ID generation
    name: string;
    status: ReportSectionStatus;
    submittedAt: Date | null;
    products: typeof SEED_PRODUCTS[number][]; // products this lead owns
  };

  const productsByLead = (id: string): typeof SEED_PRODUCTS[number][] =>
    SEED_PRODUCTS.filter((p) => p.leadId === id);

  const activeLeadConfigs: LeadConfig[] = [
    {
      leadId: LEAD_POLENKOV_ID,
      leadIndex: 1,
      name: 'Polenkov A.',
      status: ReportSectionStatus.submitted,
      submittedAt: new Date('2026-04-14T10:00:00.000Z'),
      products: productsByLead(LEAD_POLENKOV_ID),
    },
    {
      leadId: LEAD_MARIA_ID,
      leadIndex: 2,
      name: 'Maria K.',
      status: ReportSectionStatus.submitted,
      submittedAt: new Date('2026-04-14T14:00:00.000Z'),
      products: productsByLead(LEAD_MARIA_ID),
    },
    {
      leadId: LEAD_IGOR_ID,
      leadIndex: 3,
      name: 'Igor V.',
      status: ReportSectionStatus.submitted,
      submittedAt: new Date('2026-04-15T09:30:00.000Z'),
      products: productsByLead(LEAD_IGOR_ID),
    },
    {
      leadId: LEAD_DMITRY_ID,
      leadIndex: 4,
      name: 'Dmitry S.',
      status: ReportSectionStatus.submitted,
      submittedAt: new Date('2026-04-16T11:15:00.000Z'),
      products: productsByLead(LEAD_DMITRY_ID),
    },
    {
      leadId: LEAD_OLGA_ID,
      leadIndex: 5,
      name: 'Olga N.',
      status: ReportSectionStatus.draft,
      submittedAt: null,
      products: productsByLead(LEAD_OLGA_ID),
    },
    {
      leadId: LEAD_SERGEY_ID,
      leadIndex: 6,
      name: 'Sergey T.',
      status: ReportSectionStatus.draft,
      submittedAt: null,
      products: productsByLead(LEAD_SERGEY_ID),
    },
  ];

  // Traffic light cycle for varied data
  const trafficCycle: TrafficLightStatus[] = [
    TrafficLightStatus.green,
    TrafficLightStatus.yellow,
    TrafficLightStatus.red,
    TrafficLightStatus.green,
  ];

  // Pre-canned realistic items per lead/product. Sergey has none.
  const itemTextsByLead: Record<string, { current: string[]; next: string[] }> = {
    [LEAD_POLENKOV_ID]: {
      current: [
        'Implement user authentication module',
        'Add OAuth2 integration for partner API',
        'Optimize customer search query performance',
        'Webhook retry logic with exponential backoff',
      ],
      next: [
        'Partner portal SSO integration',
        'A/B testing framework rollout',
      ],
    },
    [LEAD_MARIA_ID]: {
      current: [
        'Mobile banking transaction flow QA',
        'Checkout regression suite for E-Commerce',
        'API contract tests for payment provider',
      ],
      next: [
        'Promo-code validation scenarios',
        'Cart persistence cross-device tests',
      ],
    },
    [LEAD_IGOR_ID]: {
      current: [
        'PgBouncer connection pool tuning',
        'GPU autoscaling for AI/ML pipeline',
        'Disaster recovery runbook update',
      ],
      next: [
        'Multi-region failover dry run',
      ],
    },
    [LEAD_DMITRY_ID]: {
      current: [
        'CI/CD pipeline migration to GitHub Actions',
        'Security scanner integration in pre-merge',
        'WAF rule tuning for Security Gateway',
        'Container vulnerability baseline scan',
      ],
      next: [
        'Secret rotation automation',
        'Build cache layer optimization',
      ],
    },
    [LEAD_OLGA_ID]: {
      current: [
        'Payment processing 3DS v2 integration',
        'Partner portal session management',
      ],
      next: [],
    },
    [LEAD_SERGEY_ID]: {
      current: [],
      next: [],
    },
  };

  // Workflow status cycle
  const workflowCycle: ItemWorkflowStatus[] = [
    ItemWorkflowStatus.in_progress,
    ItemWorkflowStatus.done,
    ItemWorkflowStatus.in_progress,
    ItemWorkflowStatus.blocked,
  ];
  const tagCycle = ['feature', 'bugfix', 'infra', 'ops'];

  let totalSections = 0;
  let totalItems = 0;
  let totalProjectStatuses = 0;
  let totalPriorities = 0;

  for (const cfg of activeLeadConfigs) {
    const secId = sectionId('1', cfg.leadIndex);
    await prisma.reportSection.upsert({
      where: {
        reportId_authorId: {
          reportId: activeReport.id,
          authorId: cfg.leadId,
        },
      },
      update: {
        id: secId,
        status: cfg.status,
        submittedAt: cfg.submittedAt,
      },
      create: {
        id: secId,
        reportId: activeReport.id,
        authorId: cfg.leadId,
        status: cfg.status,
        submittedAt: cfg.submittedAt,
      },
    });
    totalSections++;

    // ProjectStatus rows (traffic lights). Skip Sergey (no data yet).
    if (cfg.leadId !== LEAD_SERGEY_ID) {
      for (let pIdx = 0; pIdx < cfg.products.length; pIdx++) {
        const product = cfg.products[pIdx]!;
        const psId = projectStatusId('1', cfg.leadIndex, pIdx + 1);
        const lightIdx = (cfg.leadIndex + pIdx) % trafficCycle.length;
        await prisma.projectStatus.upsert({
          where: {
            reportSectionId_projectId: {
              reportSectionId: secId,
              projectId: product.id,
            },
          },
          update: {
            id: psId,
            status: trafficCycle[lightIdx]!,
          },
          create: {
            id: psId,
            reportSectionId: secId,
            projectId: product.id,
            status: trafficCycle[lightIdx]!,
          },
        });
        totalProjectStatuses++;
      }
    }

    // Items. Distribute across this lead's products.
    const texts = itemTextsByLead[cfg.leadId]!;
    const products = cfg.products;
    let itemSeq = 1;

    for (let i = 0; i < texts.current.length; i++) {
      const product = products[i % products.length]!;
      const id = itemId('1', cfg.leadIndex, itemSeq++);
      await prisma.item.upsert({
        where: { id },
        update: {
          reportSectionId: secId,
          projectId: product.id,
          type: ItemType.current,
          text: texts.current[i]!,
          tag: tagCycle[i % tagCycle.length]!,
          workflowStatus: workflowCycle[i % workflowCycle.length]!,
        },
        create: {
          id,
          reportSectionId: secId,
          projectId: product.id,
          type: ItemType.current,
          text: texts.current[i]!,
          tag: tagCycle[i % tagCycle.length]!,
          workflowStatus: workflowCycle[i % workflowCycle.length]!,
        },
      });
      totalItems++;
    }

    for (let i = 0; i < texts.next.length; i++) {
      const product = products[i % products.length]!;
      const id = itemId('1', cfg.leadIndex, itemSeq++);
      await prisma.item.upsert({
        where: { id },
        update: {
          reportSectionId: secId,
          projectId: product.id,
          type: ItemType.next,
          text: texts.next[i]!,
          tag: tagCycle[i % tagCycle.length]!,
          workflowStatus: ItemWorkflowStatus.in_progress,
        },
        create: {
          id,
          reportSectionId: secId,
          projectId: product.id,
          type: ItemType.next,
          text: texts.next[i]!,
          tag: tagCycle[i % tagCycle.length]!,
          workflowStatus: ItemWorkflowStatus.in_progress,
        },
      });
      totalItems++;
    }

    // Priorities (3 per submitted lead section; Olga gets 2; Sergey 0)
    const priorityTexts = (() => {
      if (cfg.leadId === LEAD_SERGEY_ID) return [];
      if (cfg.leadId === LEAD_OLGA_ID) {
        return [
          'Stabilize 3DS v2 payment flow',
          'Roll out partner portal session refresh',
        ];
      }
      if (cfg.leadId === LEAD_POLENKOV_ID) {
        return [
          'Complete OAuth2 integration for CRM Platform',
          'Prepare SSO flow for Partner Portal handoff',
          'Ship Data Analytics dashboard MVP',
        ];
      }
      if (cfg.leadId === LEAD_MARIA_ID) {
        return [
          'Sign off Mobile Banking regression suite',
          'Stabilize E-Commerce checkout flow',
          'Onboard payment provider contract tests',
        ];
      }
      if (cfg.leadId === LEAD_IGOR_ID) {
        return [
          'Land PgBouncer connection pool changes',
          'Validate AI/ML pipeline GPU autoscaling',
          'Publish updated DR runbook',
        ];
      }
      // Dmitry
      return [
        'Cut over CI/CD to GitHub Actions',
        'Roll out WAF tuning for Security Gateway',
        'Automate secret rotation across services',
      ];
    })();

    for (let r = 0; r < priorityTexts.length; r++) {
      const rank = r + 1;
      const id = priorityId('1', cfg.leadIndex, rank);
      await prisma.priority.upsert({
        where: {
          reportSectionId_rank: {
            reportSectionId: secId,
            rank,
          },
        },
        update: { id, text: priorityTexts[r]! },
        create: {
          id,
          reportSectionId: secId,
          rank,
          text: priorityTexts[r]!,
        },
      });
      totalPriorities++;
    }
  }

  // ----- Risks (3-4 across active sections) -----
  const polenkovSec = sectionId('1', 1);
  const mariaSec = sectionId('1', 2);
  const igorSec = sectionId('1', 3);
  const dmitrySec = sectionId('1', 4);

  const risks = [
    {
      id: riskId(1),
      reportSectionId: polenkovSec,
      projectId: 'a0000000-0000-4000-8000-000000000201', // CRM Platform
      risk: 'OAuth2 partner API rate limits delaying SSO portal handoff.',
      impact: 'SSO portal milestone may slip 1 week.',
      mitigation: 'Negotiating extended quota; preparing fallback batch flow.',
    },
    {
      id: riskId(2),
      reportSectionId: polenkovSec,
      projectId: 'a0000000-0000-4000-8000-000000000202', // Data Analytics Suite
      risk: 'ETL memory leak causes OOM on large extracts.',
      impact: 'Analytics release blocked until vendor patch lands.',
      mitigation: 'Vendor patch ETA Apr 25; chunked extraction interim mitigation.',
    },
    {
      id: riskId(3),
      reportSectionId: igorSec,
      projectId: 'a0000000-0000-4000-8000-000000000205', // Cloud Infrastructure
      risk: 'PgBouncer migration requires ~30 min downtime window.',
      impact: 'Coordinated maintenance impacts dependent services.',
      mitigation: 'Scheduling off-hours window; rollback plan validated.',
    },
    {
      id: riskId(4),
      reportSectionId: dmitrySec,
      projectId: 'a0000000-0000-4000-8000-000000000208', // Security Gateway
      risk: 'WAF tuning may produce false positives during peak load.',
      impact: 'Customer-facing requests could be blocked.',
      mitigation: 'Staged rollout with shadow mode and instant rollback toggle.',
    },
  ];

  for (const r of risks) {
    await prisma.risk.upsert({
      where: { id: r.id },
      update: {
        reportSectionId: r.reportSectionId,
        projectId: r.projectId,
        risk: r.risk,
        impact: r.impact,
        mitigation: r.mitigation,
      },
      create: r,
    });
  }

  // Quiet unused-warning for mariaSec (may not be used by risks above)
  void mariaSec;

  // ----- Decisions (2-3 across active sections) -----
  const decisions = [
    {
      id: decisionId(1),
      reportSectionId: polenkovSec,
      text: 'Approve extended OAuth2 quota request with partner.',
      owner: 'Department Head',
      deadline: new Date('2026-04-21T15:00:00.000Z'),
      impact: 'Unblocks SSO portal delivery.',
    },
    {
      id: decisionId(2),
      reportSectionId: igorSec,
      text: 'Approve maintenance window for PgBouncer migration.',
      owner: 'Department Head',
      deadline: new Date('2026-04-22T18:00:00.000Z'),
      impact: 'Required to clear connection pool tech debt.',
    },
    {
      id: decisionId(3),
      reportSectionId: dmitrySec,
      text: 'Greenlight phased WAF rollout in shadow mode.',
      owner: 'Department Head',
      deadline: new Date('2026-04-23T12:00:00.000Z'),
      impact: 'Reduces incident risk during launch.',
    },
  ];

  for (const d of decisions) {
    await prisma.decision.upsert({
      where: { id: d.id },
      update: {
        reportSectionId: d.reportSectionId,
        text: d.text,
        owner: d.owner,
        deadline: d.deadline,
        impact: d.impact,
      },
      create: d,
    });
  }

  // ----- Published report (Week 15): all sections submitted, minimal data -----
  for (let i = 0; i < activeLeadConfigs.length; i++) {
    const cfg = activeLeadConfigs[i]!;
    const secId = sectionId('2', cfg.leadIndex);
    const submitDate = new Date(`2026-04-1${i % 2 === 0 ? '0' : '0'}T${10 + i}:00:00.000Z`);

    await prisma.reportSection.upsert({
      where: {
        reportId_authorId: {
          reportId: publishedReport.id,
          authorId: cfg.leadId,
        },
      },
      update: {
        id: secId,
        status: ReportSectionStatus.submitted,
        submittedAt: submitDate,
      },
      create: {
        id: secId,
        reportId: publishedReport.id,
        authorId: cfg.leadId,
        status: ReportSectionStatus.submitted,
        submittedAt: submitDate,
      },
    });
    totalSections++;

    // One project status per product (all green for "history") and one current item
    for (let pIdx = 0; pIdx < cfg.products.length; pIdx++) {
      const product = cfg.products[pIdx]!;
      const psId = projectStatusId('2', cfg.leadIndex, pIdx + 1);
      await prisma.projectStatus.upsert({
        where: {
          reportSectionId_projectId: {
            reportSectionId: secId,
            projectId: product.id,
          },
        },
        update: { id: psId, status: TrafficLightStatus.green },
        create: {
          id: psId,
          reportSectionId: secId,
          projectId: product.id,
          status: TrafficLightStatus.green,
        },
      });
      totalProjectStatuses++;

      const id = itemId('2', cfg.leadIndex, pIdx + 1);
      await prisma.item.upsert({
        where: { id },
        update: {
          reportSectionId: secId,
          projectId: product.id,
          type: ItemType.current,
          text: `Closed week 15 work on ${product.name}`,
          tag: 'feature',
          workflowStatus: ItemWorkflowStatus.done,
        },
        create: {
          id,
          reportSectionId: secId,
          projectId: product.id,
          type: ItemType.current,
          text: `Closed week 15 work on ${product.name}`,
          tag: 'feature',
          workflowStatus: ItemWorkflowStatus.done,
        },
      });
      totalItems++;
    }

    // One priority per published section
    const id = priorityId('2', cfg.leadIndex, 1);
    await prisma.priority.upsert({
      where: {
        reportSectionId_rank: {
          reportSectionId: secId,
          rank: 1,
        },
      },
      update: { id, text: `Wrap up week 15 deliverables for ${cfg.name}` },
      create: {
        id,
        reportSectionId: secId,
        rank: 1,
        text: `Wrap up week 15 deliverables for ${cfg.name}`,
      },
    });
    totalPriorities++;
  }

  // --- 7. AppSettings singleton ---
  await prisma.appSettings.upsert({
    where: { id: 'singleton' },
    update: {
      departmentName: 'Core Development',
      autoCreatePeriods: false,
      defaultDeadlineDays: 5,
    },
    create: {
      id: 'singleton',
      departmentName: 'Core Development',
      autoCreatePeriods: false,
      defaultDeadlineDays: 5,
    },
  });

  console.log(
    `Seeded: ${SEED_USERS.length} users, ${SEED_PRODUCTS.length} products, ` +
      `${SEED_STAGES.length} stages, ${stageAssignmentCount} assignments, ` +
      `2 reports, ${totalSections} sections, ${totalItems} items, ` +
      `${totalProjectStatuses} project statuses, ${risks.length} risks, ` +
      `${decisions.length} decisions, ${totalPriorities} priorities`,
  );
}

void main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
