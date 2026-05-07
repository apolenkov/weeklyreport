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

import {
  SEED_USERS,
  SEED_PRODUCTS,
  SEED_STAGES,
  SEED_REPORTS,
  HEAD_USER_ID,
  LEAD_1_ID,
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

// Anchor for date-relative sample timestamps. Active period start (Monday of
// current ISO week) computed once in seed-constants; we mirror that derivation
// here so submittedAt / decision.deadline / risk.openedAt land inside the
// active period the user actually sees in the form.
const ACTIVE_PERIOD_START = new Date(SEED_REPORTS.active.periodStart);
function activeOffset(days: number, hours = 10, minutes = 0): Date {
  const d = new Date(ACTIVE_PERIOD_START);
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hours, minutes, 0, 0);
  return d;
}
const PUBLISHED_PERIOD_START = new Date(SEED_REPORTS.published.periodStart);
function publishedOffset(days: number, hours = 10, minutes = 0): Date {
  const d = new Date(PUBLISHED_PERIOD_START);
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hours, minutes, 0, 0);
  return d;
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
  //   Тимлид 1 -> submitted (Apr 14 10:00)
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
      leadId: LEAD_1_ID,
      leadIndex: 1,
      name: 'Тимлид 1',
      status: ReportSectionStatus.submitted,
      submittedAt: activeOffset(1, 10),
      products: productsByLead(LEAD_1_ID),
    },
    {
      leadId: LEAD_MARIA_ID,
      leadIndex: 2,
      name: 'Мария К.',
      status: ReportSectionStatus.submitted,
      submittedAt: activeOffset(1, 14),
      products: productsByLead(LEAD_MARIA_ID),
    },
    {
      leadId: LEAD_IGOR_ID,
      leadIndex: 3,
      name: 'Игорь В.',
      status: ReportSectionStatus.submitted,
      submittedAt: activeOffset(2, 9, 30),
      products: productsByLead(LEAD_IGOR_ID),
    },
    {
      leadId: LEAD_DMITRY_ID,
      leadIndex: 4,
      name: 'Дмитрий С.',
      status: ReportSectionStatus.submitted,
      submittedAt: activeOffset(3, 11, 15),
      products: productsByLead(LEAD_DMITRY_ID),
    },
    {
      leadId: LEAD_OLGA_ID,
      leadIndex: 5,
      name: 'Ольга Н.',
      status: ReportSectionStatus.draft,
      submittedAt: null,
      products: productsByLead(LEAD_OLGA_ID),
    },
    {
      leadId: LEAD_SERGEY_ID,
      leadIndex: 6,
      name: 'Сергей Т.',
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

  // Russian-language demo content for the active period. Each lead gets
  // realistic items that read like a working tech-team's weekly status. Sergey
  // is intentionally empty so the dashboard's "pending" KPI has a non-zero
  // bucket (Sergey's section shows 'pending' instead of 'draft').
  // Item texts in Russian. Product context comes from the item's projectId
  // relation — we don't repeat the product name in the text itself (UI shows
  // it in the section header).
  const itemTextsByLead: Record<string, { current: string[]; next: string[] }> = {
    [LEAD_1_ID]: {
      current: [
        'Закрыли модуль авторизации — JWT + refresh-token',
        'Подключили OAuth2 партнёрского API, ждём подтверждения от партнёра',
        'Оптимизировали поиск клиентов: p99 query 850ms → 180ms',
        'Webhook retry с экспоненциальным backoff, dead-letter в Redis',
      ],
      next: [
        'Интеграция SSO с порталом клиента (на стороне Ольги)',
        'Раскатка A/B-тестинг фреймворка',
      ],
    },
    [LEAD_MARIA_ID]: {
      current: [
        'QA транзакционного флоу — закрыли 12 из 15 кейсов',
        'Регресс-сьют чекаута, добавили smoke-тесты для прода',
        'Contract-тесты с провайдером платежей, нашли 2 расхождения по схеме',
      ],
      next: [
        'Сценарии валидации промокодов (включая edge-cases с истечением)',
        'Тесты сохранности корзины при смене устройства',
      ],
    },
    [LEAD_IGOR_ID]: {
      current: [
        'Тюнинг pool_size в PgBouncer: 40 → 80, p99 latency упало на 22%',
        'GPU autoscaling на базе HPA + custom metrics',
        'Обновили DR-runbook: добавили checklist для multi-region failover',
      ],
      next: [
        'Dry-run multi-region failover (запланирован на четверг 15:00)',
      ],
    },
    [LEAD_DMITRY_ID]: {
      current: [
        'Миграция CI/CD на GitHub Actions: 8 из 12 пайплайнов уже там',
        'Интеграция security scanner в pre-merge — блокирует Critical/High',
        'Тюнинг WAF-правил, ложных срабатываний −40%',
        'Baseline-скан уязвимостей контейнеров, отчёт собран по 17 образам',
      ],
      next: [
        'Автоматизация ротации секретов (Vault transit-engine)',
        'Оптимизация build-cache в Docker BuildKit',
      ],
    },
    [LEAD_OLGA_ID]: {
      current: [
        'Закрыли интеграцию 3DS v2 — пилот на 5% трафика',
        'Перевели на короткие сессии (refresh-токен 24 ч)',
        'Починили двойное списание при timeout — добавили idempotency-key через Redis',
      ],
      next: [
        'Подключить СБП-эквайринг (sandbox-ключи ожидаются 8 мая)',
        'Biometric-вход — закрыть acceptance с UX',
      ],
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

    // Priorities (3 per submitted lead section; Olga gets 2; Sergey 0).
    // Russian content matching the items above so the demo report reads as a
    // single coherent week, not unrelated bullet lists.
    // Priorities — what the lead wants from the head this week. Product
    // context implicit (head sees the lead's section as a whole).
    const priorityTexts = (() => {
      if (cfg.leadId === LEAD_SERGEY_ID) return [];
      if (cfg.leadId === LEAD_OLGA_ID) {
        return [
          'Стабилизация 3DS v2 на проде (закрыть L2-инциденты)',
          'Раскатка СБП-эквайринга на 100% трафика после получения ключей',
          'Согласовать финальный план PCI DSS аудита с безопасниками',
        ];
      }
      if (cfg.leadId === LEAD_1_ID) {
        return [
          'Закрыть OAuth2 интеграцию (партнёр снял rate-limit)',
          'Передать SSO flow смежной команде к четвергу',
          'Выкатить MVP дашборда на staging',
        ];
      }
      if (cfg.leadId === LEAD_MARIA_ID) {
        return [
          'Подписать регресс-сьют (15/15 кейсов зелёных)',
          'Стабилизировать чекаут — закрыть последние 3 P2-бага',
          'Завести контракт-тесты с провайдером платежей в CI',
        ];
      }
      if (cfg.leadId === LEAD_IGOR_ID) {
        return [
          'Закатить новый pool_size PgBouncer на прод после dry-run',
          'Подтвердить GPU autoscaling на нагрузочном тесте',
          'Опубликовать обновлённый DR-runbook для дежурных',
        ];
      }
      // Dmitry
      return [
        'Финализировать миграцию CI/CD на GitHub Actions (4 пайплайна осталось)',
        'Раскатать тюнинг WAF после shadow-mode валидации',
        'Автоматизировать ротацию секретов через Vault transit',
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
  const primaryLeadSec = sectionId('1', 1);
  const mariaSec = sectionId('1', 2);
  const igorSec = sectionId('1', 3);
  const dmitrySec = sectionId('1', 4);

  // Russian-language risks mirroring the items above. Each risk ties to a
  // specific project so the form's per-product chip + risk-card pair stays
  // coherent (no orphan risks for products the lead doesn't own).
  const risks = [
    {
      id: riskId(1),
      reportSectionId: primaryLeadSec,
      projectId: 'a0000000-0000-4000-8000-000000000201', // CRM Platform
      risk: 'Партнёрский OAuth2 API режет нас по rate-limit на пиковом трафике',
      impact: 'Сдвигает milestone SSO на 1 неделю, блокирует смежную команду',
      mitigation: 'Эскалирована заявка на расширение квоты, параллельно готовим batch-fallback',
    },
    {
      id: riskId(2),
      reportSectionId: primaryLeadSec,
      projectId: 'a0000000-0000-4000-8000-000000000202', // Data Analytics Suite
      risk: 'Memory leak в ETL — OOM на больших экстрактах (>2M строк)',
      impact: 'Блокирует релиз до получения патча от вендора',
      mitigation: 'Патч ETA 8 мая, временно перешли на chunked extraction по 500K',
    },
    {
      id: riskId(3),
      reportSectionId: igorSec,
      projectId: 'a0000000-0000-4000-8000-000000000205', // Cloud Infrastructure
      risk: 'Миграция PgBouncer требует ~30 мин downtime в проде',
      impact: 'Окно обслуживания затрагивает зависимые сервисы (auth, payments)',
      mitigation: 'Окно запланировано в субботу 02:00 МСК, rollback-план провалидирован',
    },
    {
      id: riskId(4),
      reportSectionId: dmitrySec,
      projectId: 'a0000000-0000-4000-8000-000000000208', // Security Gateway
      risk: 'Тюнинг WAF может выдавать false positives на пиковой нагрузке',
      impact: 'Часть клиентских запросов может блокироваться без причины',
      mitigation: 'Раскатка через shadow-mode + кнопка мгновенного rollback',
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
  // Russian-language decisions for the head to action.
  const decisions = [
    {
      id: decisionId(1),
      reportSectionId: primaryLeadSec,
      text: 'Согласовать расширение OAuth2 квоты у партнёра (нужен sign-off head)',
      owner: 'Глава департамента',
      deadline: activeOffset(8, 15),
      impact: 'Разблокирует выкатку SSO portal на 100% трафика',
    },
    {
      id: decisionId(2),
      reportSectionId: igorSec,
      text: 'Утвердить maintenance-window для миграции PgBouncer (Сб 02:00 МСК)',
      owner: 'Глава департамента',
      deadline: activeOffset(9, 18),
      impact: 'Закрывает tech-debt по пулу соединений, разгружает p99',
    },
    {
      id: decisionId(3),
      reportSectionId: dmitrySec,
      text: 'Дать зелёный свет фазовой раскатке WAF в shadow-mode',
      owner: 'Глава департамента',
      deadline: activeOffset(10, 12),
      impact: 'Снижает риск инцидентов на проде, безопасный rollback',
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
    // Submitted between Mon-Fri of the published period; deterministic per
    // lead so reseeding stays idempotent.
    const submitDate = publishedOffset(i % 5, 10 + i);

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
      const prevWeekText = `Закрыли недельные цели по продукту «${product.name}»`;
      await prisma.item.upsert({
        where: { id },
        update: {
          reportSectionId: secId,
          projectId: product.id,
          type: ItemType.current,
          text: prevWeekText,
          tag: 'feature',
          workflowStatus: ItemWorkflowStatus.done,
        },
        create: {
          id,
          reportSectionId: secId,
          projectId: product.id,
          type: ItemType.current,
          text: prevWeekText,
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
      update: { id, text: `Закрыть остаточные задачи прошлой недели — ${cfg.name}` },
      create: {
        id,
        reportSectionId: secId,
        rank: 1,
        text: `Закрыть остаточные задачи прошлой недели — ${cfg.name}`,
      },
    });
    totalPriorities++;
  }

  // --- 7. Reminder rules for the active report ---
  const deadlineReminderAt = new Date(activeReport.deadline);
  deadlineReminderAt.setUTCHours(deadlineReminderAt.getUTCHours() - 24);
  const escalationReminderAt = new Date(activeReport.deadline);
  escalationReminderAt.setUTCHours(escalationReminderAt.getUTCHours() + 2);
  const reminderRules = [
    {
      id: 'a0000000-0000-4000-8000-00000000c001',
      kind: ReminderRuleKind.deadline,
      fireAt: deadlineReminderAt,
      timezone: 'Europe/Moscow',
      status: ReminderRuleStatus.active,
      version: 1,
      reportId: activeReport.id,
    },
    {
      id: 'a0000000-0000-4000-8000-00000000c002',
      kind: ReminderRuleKind.escalation,
      fireAt: escalationReminderAt,
      timezone: 'Europe/Moscow',
      status: ReminderRuleStatus.active,
      version: 1,
      reportId: activeReport.id,
    },
  ];

  for (const rule of reminderRules) {
    await prisma.reminderRule.upsert({
      where: { id: rule.id },
      update: {
        kind: rule.kind,
        fireAt: rule.fireAt,
        timezone: rule.timezone,
        status: rule.status,
        version: rule.version,
        reportId: rule.reportId,
      },
      create: rule,
    });
  }

  // --- 8. AppSettings singleton ---
  await prisma.appSettings.upsert({
    where: { id: 'singleton' },
    update: {
      departmentName: 'Software Development',
      autoCreatePeriods: false,
      defaultDeadlineDays: 5,
    },
    create: {
      id: 'singleton',
      departmentName: 'Software Development',
      autoCreatePeriods: false,
      defaultDeadlineDays: 5,
    },
  });

  console.log(
    `Seeded: ${SEED_USERS.length} users, ${SEED_PRODUCTS.length} products, ` +
      `${SEED_STAGES.length} stages, ${stageAssignmentCount} assignments, ` +
      `2 reports, ${totalSections} sections, ${totalItems} items, ` +
      `${totalProjectStatuses} project statuses, ${risks.length} risks, ` +
      `${decisions.length} decisions, ${totalPriorities} priorities, ` +
      `${reminderRules.length} reminder rules`,
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
