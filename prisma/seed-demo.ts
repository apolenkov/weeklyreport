/**
 * DEMO seed — tiered, presenter-controlled demo data.
 *
 * One shared writer, two plain-data tiers selected from the CLI:
 *   - small (default) — THREE leads co-owning Vasily's 3 products, role-shaped:
 *     Vasily owns Development everywhere (+ Planning on the internal BI product,
 *     exactly two owned stages there); Maria owns Testing; Igor owns DevOps.
 *     BI leaves Testing unowned ("tester not hired"). Maria and Igor each seed a
 *     foreign item + risk on a shared product, so the lead report's Mine/Everyone
 *     toggle has a visible effect and the SDLC pipeline shows real split
 *     ownership. One BLOCKED item so the derived "Needs Attention" banner has
 *     content to demonstrate.
 *   - huge — the dense many-product fixture for stress/scroll demos
 *     (all canonical leads + products, templated content).
 *
 * The `middle` tier is NOT defined here. `db:seed:middle` delegates to the
 * proven `prisma/seed-simple.ts` as-is, which is also the byte-stable fixture
 * the CI visual-regression job seeds and the baseline `prisma/reset-hard.ts`
 * re-seeds — folding it into a generic writer would risk both. See
 * `openspec/changes/demo-seed-datasets/design.md` ("Structure").
 *
 * `seed.ts` (the canonical test fixture) and `prisma.config.ts`'s
 * `migrations.seed` pointer are untouched.
 *
 * Determinism: identifiers and textual content are fixed constants (no run-time
 * randomness in IDs). Only period dates are week-relative (reused from
 * `seed-constants.ts`) so the active period always covers "today".
 *
 * Run:
 *   pnpm db:seed:small   # default demo
 *   pnpm db:seed:huge
 */

import "dotenv/config";

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
} from "@prisma/client";

import { assertNonProdDestructive } from "./_destructive-guard.js";
import {
  HEAD_USER_ID,
  VIEWER_USER_ID,
  ADMIN_USER_ID,
  ACTIVE_REPORT_ID,
  PUBLISHED_REPORT_ID,
  DEFAULT_REPORTING_GROUP_ID,
  LEAD_1_ID,
  LEAD_MARIA_ID,
  LEAD_IGOR_ID,
  SEED_STAGES,
  SEED_USERS,
  SEED_PRODUCTS,
  SEED_REPORTS,
} from "./seed-constants.js";

// ---------------------------------------------------------------------------
// Tier dataset shapes — plain data, consumed by one shared writer.
// ---------------------------------------------------------------------------

type StageName = (typeof SEED_STAGES)[number]["name"];
type Tier = "small" | "huge";

type DemoLead = {
  id: string;
  email: string;
  name: string;
  samlId: string;
};

type DemoProduct = {
  id: string;
  name: string;
  leadId: string;
};

type DemoItem = {
  type: ItemType;
  text: string;
  tag: string;
  status: ItemWorkflowStatus;
  stages: StageName[];
  priorityRank?: number;
  completed?: boolean;
};

type DemoRisk = {
  risk: string;
  impact: string;
  mitigation: string;
  severity: "blocked" | "at-risk";
  stage: StageName;
};

type DemoDecision = {
  text: string;
  impact: string;
  stage: StageName;
};

/** One owning lead's active-period section on one product. */
type DemoSection = {
  leadId: string;
  leadLabel: string;
  productId: string;
  productLight: TrafficLightStatus;
  sectionStatus: ReportSectionStatus;
  ownedStages: StageName[];
  items: DemoItem[];
  risk?: DemoRisk;
  decision?: DemoDecision;
};

type TierDataset = {
  leads: DemoLead[];
  products: DemoProduct[];
  sections: DemoSection[];
};

// ---------------------------------------------------------------------------
// Deterministic ID factory — fixed, run-stable IDs for new demo-only rows.
// Canonical IDs (head/leads/products/stages/reports/group) are reused from
// seed-constants; only sections/items/statuses/etc. get these.
// ---------------------------------------------------------------------------

function makeIdFactory() {
  let counter = 0;
  return (): string => {
    counter += 1;
    const tail = counter.toString(16).padStart(12, "0");
    return `d0000000-0000-4000-8000-${tail}`;
  };
}

const STAGE_ID_BY_NAME: ReadonlyMap<string, string> = new Map(
  SEED_STAGES.map((s) => [s.name, s.id]),
);

function stageId(name: StageName): string {
  const id = STAGE_ID_BY_NAME.get(name);
  if (!id) throw new Error(`Unknown stage name: ${name}`);
  return id;
}

// ---------------------------------------------------------------------------
// SMALL tier — hand-authored, the demo opener.
// ---------------------------------------------------------------------------

const PROD_PORTAL = SEED_PRODUCTS[0]!.id; // Маркетинговый портал → Vasily
const PROD_INTEGRATIONS = SEED_PRODUCTS[2]!.id; // Платформа интеграций → Vasily
const PROD_BI = SEED_PRODUCTS[4]!.id; // Внутренний BI → Vasily

// SMALL tier cast — role-shaped co-ownership across Vasily's three products.
// Vasily owns Development everywhere (+ Planning on BI); Maria owns Testing;
// Igor owns DevOps. The same colleague owns the same stage on each product
// (consistent, not random). BI leaves Testing unowned to show a vacant role.
const VASILY_LABEL = "Василий И.";
const MARIA_LABEL = "Мария К.";
const IGOR_LABEL = "Игорь В.";

const SMALL_DATASET: TierDataset = {
  leads: [
    {
      id: LEAD_1_ID,
      email: "lead1@customreport.local",
      name: VASILY_LABEL,
      samlId: "lead-1",
    },
    {
      id: LEAD_MARIA_ID,
      email: "maria@customreport.local",
      name: MARIA_LABEL,
      samlId: "lead-maria",
    },
    {
      id: LEAD_IGOR_ID,
      email: "igor@customreport.local",
      name: IGOR_LABEL,
      samlId: "lead-igor",
    },
  ],
  products: [
    { id: PROD_PORTAL, name: "Маркетинговый портал", leadId: LEAD_1_ID },
    { id: PROD_INTEGRATIONS, name: "Платформа интеграций", leadId: LEAD_1_ID },
    { id: PROD_BI, name: "Внутренний BI", leadId: LEAD_1_ID },
  ],
  sections: [
    // --- Vasily (primary lead) — owns Development on each product ----------
    // Portal — carries the BLOCKED item so the derived "Needs Attention"
    // escalation banner has content to demonstrate.
    {
      leadId: LEAD_1_ID,
      leadLabel: VASILY_LABEL,
      productId: PROD_PORTAL,
      productLight: TrafficLightStatus.yellow,
      sectionStatus: ReportSectionStatus.draft,
      ownedStages: ["Development"],
      items: [
        {
          type: ItemType.current,
          text: "Рефакторинг модуля авторизации заблокирован: ждём доступ к внешнему IdP",
          tag: "feature",
          status: ItemWorkflowStatus.blocked,
          stages: ["Development"],
          priorityRank: 1,
        },
        {
          type: ItemType.next,
          text: "Подключить вход через корпоративный IdP после выдачи доступа",
          tag: "feature",
          status: ItemWorkflowStatus.in_progress,
          stages: ["Development"],
        },
      ],
      risk: {
        risk: "Доступ к внешнему IdP не выдан вовремя",
        impact: "Сдвиг релиза авторизации на одну неделю",
        mitigation:
          "Эскалация владельцу IdP, временный фолбэк на локальный вход",
        severity: "blocked",
        stage: "Development",
      },
      decision: {
        text: "Зафиксировать переезд на новый IdP до конца месяца",
        impact: "Закрывает риск устаревшего OAuth-провайдера",
        stage: "Development",
      },
    },
    // Integrations.
    {
      leadId: LEAD_1_ID,
      leadLabel: VASILY_LABEL,
      productId: PROD_INTEGRATIONS,
      productLight: TrafficLightStatus.green,
      sectionStatus: ReportSectionStatus.draft,
      ownedStages: ["Development"],
      items: [
        {
          type: ItemType.current,
          text: "Реализовали REST-коннектор для платформы интеграций",
          tag: "feature",
          status: ItemWorkflowStatus.in_progress,
          stages: ["Development"],
          priorityRank: 1,
        },
        {
          type: ItemType.next,
          text: "Покрыть коннектор контрактными тестами перед интеграцией",
          tag: "feature",
          status: ItemWorkflowStatus.in_progress,
          stages: ["Development"],
        },
      ],
      risk: {
        risk: "Внешний API партнёра нестабилен в sandbox-среде",
        impact: "Возможны повторные доработки коннектора",
        mitigation: "Завести моки и контрактные тесты до боевой интеграции",
        severity: "at-risk",
        stage: "Development",
      },
      decision: {
        text: "Зафиксировать версию API партнёра для интеграции",
        impact: "Снижает риск ломающих изменений на их стороне",
        stage: "Development",
      },
    },
    // BI — the internal product. Vasily owns EXACTLY TWO stages (Planning,
    // Development); Testing is left unowned (tester not hired). Igor co-owns
    // DevOps here (see his section below) and raises the blocker that lights
    // this product's health red in Vasily's view even though Vasily owns
    // neither the DevOps nor the Testing chip.
    {
      leadId: LEAD_1_ID,
      leadLabel: VASILY_LABEL,
      productId: PROD_BI,
      productLight: TrafficLightStatus.green,
      sectionStatus: ReportSectionStatus.draft,
      ownedStages: ["Planning", "Development"],
      items: [
        // The one MULTI-STAGE item in the small tier (durable spec
        // demo-seed-datasets "Small tier is minimal and stage-realistic"):
        // Item.stageNames spans Development + Testing. With Testing unowned on
        // BI (tester not hired), Vasily carries the acceptance work himself, so
        // the item legitimately touches both phases. Portal/Integrations items
        // stay single-stage.
        {
          type: ItemType.current,
          text: "Новый дашборд BI: разработка и приёмочное тестирование идут параллельно",
          tag: "feature",
          status: ItemWorkflowStatus.in_progress,
          stages: ["Development", "Testing"],
          priorityRank: 1,
        },
        {
          type: ItemType.next,
          text: "Спланировать целевые показатели следующего спринта дашборда BI",
          tag: "infra",
          status: ItemWorkflowStatus.in_progress,
          stages: ["Planning"],
        },
      ],
      decision: {
        text: "Утвердить целевые SLA по времени отклика дашборда BI",
        impact: "Даёт измеримый порог приёмки для разработки",
        stage: "Development",
      },
    },
    // --- Maria (co-owner) — owns Testing; foreign content on Portal --------
    {
      leadId: LEAD_MARIA_ID,
      leadLabel: MARIA_LABEL,
      productId: PROD_PORTAL,
      productLight: TrafficLightStatus.yellow,
      sectionStatus: ReportSectionStatus.draft,
      ownedStages: ["Testing"],
      items: [
        {
          type: ItemType.current,
          text: "Прогон регрессии по сценариям входа портала, чиним флаки-тесты",
          tag: "bugfix",
          status: ItemWorkflowStatus.in_progress,
          stages: ["Testing"],
        },
      ],
      risk: {
        risk: "Нестабильные e2e-тесты входа маскируют реальные регрессии",
        impact: "Риск пропустить дефект авторизации в релиз",
        mitigation: "Карантин флаки-тестов и стабилизация окружения стенда",
        severity: "at-risk",
        stage: "Testing",
      },
    },
    // Maria also owns Testing on Integrations (consistent role), no extra
    // content there.
    {
      leadId: LEAD_MARIA_ID,
      leadLabel: MARIA_LABEL,
      productId: PROD_INTEGRATIONS,
      productLight: TrafficLightStatus.green,
      sectionStatus: ReportSectionStatus.draft,
      ownedStages: ["Testing"],
      items: [],
    },
    // --- Igor (co-owner) — owns DevOps; foreign blocker on BI -------------
    {
      leadId: LEAD_IGOR_ID,
      leadLabel: IGOR_LABEL,
      productId: PROD_BI,
      productLight: TrafficLightStatus.red,
      sectionStatus: ReportSectionStatus.draft,
      ownedStages: ["DevOps"],
      items: [
        {
          type: ItemType.current,
          text: "Деплой дашборда BI заблокирован: не выделены ресурсы кластера",
          tag: "infra",
          status: ItemWorkflowStatus.blocked,
          stages: ["DevOps"],
        },
      ],
      risk: {
        risk: "Нет выделенных мощностей кластера под прод-стенд BI",
        impact: "Релиз дашборда BI сдвигается до выделения ресурсов",
        mitigation: "Заявка в инфраструктуру, временный деплой на общий стенд",
        severity: "blocked",
        stage: "DevOps",
      },
    },
    // Igor also owns DevOps on Portal and Integrations (consistent role).
    {
      leadId: LEAD_IGOR_ID,
      leadLabel: IGOR_LABEL,
      productId: PROD_PORTAL,
      productLight: TrafficLightStatus.green,
      sectionStatus: ReportSectionStatus.draft,
      ownedStages: ["DevOps"],
      items: [],
    },
    {
      leadId: LEAD_IGOR_ID,
      leadLabel: IGOR_LABEL,
      productId: PROD_INTEGRATIONS,
      productLight: TrafficLightStatus.green,
      sectionStatus: ReportSectionStatus.draft,
      ownedStages: ["DevOps"],
      items: [],
    },
  ],
};

// ---------------------------------------------------------------------------
// HUGE tier — dense fixture for stress/scroll demos. Reuses all canonical
// leads + products from seed-constants; content is templated but fixed.
// ---------------------------------------------------------------------------

const HUGE_STAGE_ROTATION: StageName[] = [
  "Development",
  "Testing",
  "Design",
  "Analysis",
  "DevOps",
];

function buildHugeDataset(): TierDataset {
  const leadUsers = SEED_USERS.filter((u) => u.role === "lead");
  const leads: DemoLead[] = leadUsers.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    samlId: u.samlId,
  }));
  const labelById = new Map(leadUsers.map((u) => [u.id, u.name]));

  const products: DemoProduct[] = SEED_PRODUCTS.map((p) => ({
    id: p.id,
    name: p.name,
    leadId: p.leadId,
  }));

  const sections: DemoSection[] = SEED_PRODUCTS.map((p, idx) => {
    const stage = HUGE_STAGE_ROTATION[idx % HUGE_STAGE_ROTATION.length]!;
    // Every 5th product is blocked+red, every 3rd is at-risk+yellow, else green.
    const blocked = idx % 5 === 0;
    const atRisk = !blocked && idx % 3 === 0;
    const light = blocked
      ? TrafficLightStatus.red
      : atRisk
        ? TrafficLightStatus.yellow
        : TrafficLightStatus.green;
    const itemStatus = blocked
      ? ItemWorkflowStatus.blocked
      : ItemWorkflowStatus.in_progress;

    return {
      leadId: p.leadId,
      leadLabel: labelById.get(p.leadId) ?? "Lead",
      productId: p.id,
      productLight: light,
      sectionStatus:
        idx % 2 === 0
          ? ReportSectionStatus.draft
          : ReportSectionStatus.submitted,
      ownedStages: [stage],
      items: [
        {
          type: ItemType.current,
          text: `Работы по продукту «${p.name}» на этапе ${stage}`,
          tag: "feature",
          status: itemStatus,
          stages: [stage],
          priorityRank: 1,
        },
        {
          type: ItemType.current,
          text: `Закрыли часть задач по продукту «${p.name}»`,
          tag: "bugfix",
          status: ItemWorkflowStatus.done,
          stages: [stage],
          completed: true,
        },
        {
          type: ItemType.next,
          text: `Следующий фокус по продукту «${p.name}»`,
          tag: "ops",
          status: ItemWorkflowStatus.in_progress,
          stages: [stage],
        },
      ],
      risk: atRisk
        ? {
            risk: `Открытый риск по продукту «${p.name}»`,
            impact: "Возможен сдвиг сроков на этапе доставки",
            mitigation: "Еженедельный синк с командой и заказчиком",
            severity: "at-risk",
            stage,
          }
        : undefined,
      decision: {
        text: `Зафиксировать приоритеты по продукту «${p.name}»`,
        impact: "Снимает неопределённость по очереди задач",
        stage,
      },
    };
  });

  return { leads, products, sections };
}

// ---------------------------------------------------------------------------
// Shared writer.
// ---------------------------------------------------------------------------

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const HEAD_NAME =
  SEED_USERS.find((u) => u.id === HEAD_USER_ID)?.name ?? "Антон К.";

async function wipe(): Promise<void> {
  // FK-safe delete order mirrors prisma/seed-simple.ts.
  await prisma.reminderExecution.deleteMany({});
  await prisma.reminderRule.deleteMany({});
  await prisma.reminderPolicy.deleteMany({});
  await prisma.decision.deleteMany({});
  await prisma.risk.deleteMany({});
  await prisma.item.deleteMany({});
  await prisma.stageStatus.deleteMany({});
  await prisma.projectStatus.deleteMany({});
  await prisma.reopenRequest.deleteMany({});
  await prisma.reportSection.deleteMany({});
  await prisma.pdfExportJob.deleteMany({});
  await prisma.carryOverRecord.deleteMany({});
  await prisma.carryOverExecution.deleteMany({});
  await prisma.report.deleteMany({});
  await prisma.stageAssignment.deleteMany({});
  await prisma.viewerGroupAccess.deleteMany({});
  await prisma.groupProduct.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.stage.deleteMany({});
  await prisma.telegramBinding.deleteMany({});
  await prisma.userActionLog.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.reportingGroup.deleteMany({});
}

async function seedScaffold(dataset: TierDataset): Promise<void> {
  // headUserId is set AFTER users exist (FK headUserId → User).
  await prisma.reportingGroup.create({
    data: {
      id: DEFAULT_REPORTING_GROUP_ID,
      name: "Core Development",
      description: "Default reporting group for CustomReport demo users",
    },
  });

  await prisma.organization.upsert({
    where: { id: "singleton" },
    update: { shortName: "PEO", fullName: "Product Engineering & Operations" },
    create: {
      id: "singleton",
      shortName: "PEO",
      fullName: "Product Engineering & Operations",
    },
  });
  await prisma.appSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });

  await prisma.user.createMany({
    data: [
      {
        id: HEAD_USER_ID,
        email: "head@customreport.local",
        name: HEAD_NAME,
        role: Role.head,
        samlId: "head-1",
        reportingGroupId: DEFAULT_REPORTING_GROUP_ID,
      },
      {
        id: VIEWER_USER_ID,
        email: "viewer@customreport.local",
        name: "Дарья В.",
        role: Role.viewer,
        samlId: "viewer-1",
        reportingGroupId: null,
      },
      {
        id: ADMIN_USER_ID,
        email: "admin@customreport.local",
        name: "Михаил Б.",
        role: Role.admin,
        samlId: "admin-1",
        reportingGroupId: DEFAULT_REPORTING_GROUP_ID,
      },
      ...dataset.leads.map((lead) => ({
        id: lead.id,
        email: lead.email,
        name: lead.name,
        role: Role.lead,
        samlId: lead.samlId,
        reportingGroupId: DEFAULT_REPORTING_GROUP_ID,
      })),
    ],
  });

  // Now that users exist, backfill the group leader + grant viewer access.
  await prisma.reportingGroup.update({
    where: { id: DEFAULT_REPORTING_GROUP_ID },
    data: { headUserId: HEAD_USER_ID },
  });
  await prisma.viewerGroupAccess.create({
    data: {
      id: makeViewerAccessId(),
      viewerUserId: VIEWER_USER_ID,
      groupId: DEFAULT_REPORTING_GROUP_ID,
    },
  });

  await prisma.stage.createMany({
    data: SEED_STAGES.map((s) => ({
      id: s.id,
      name: s.name,
      sortOrder: s.sortOrder,
    })),
  });

  await prisma.project.createMany({
    data: dataset.products.map((p) => ({
      id: p.id,
      name: p.name,
      leadId: p.leadId,
      archived: false,
    })),
  });
  await prisma.groupProduct.createMany({
    // Explicit deterministic id (not the schema's @default(uuid())) so the
    // header's "fixed constants, no run-time randomness in IDs" holds for this
    // table too.
    data: dataset.products.map((p) => ({
      id: makeGroupProductId(),
      groupId: DEFAULT_REPORTING_GROUP_ID,
      productId: p.id,
    })),
    skipDuplicates: true,
  });
}

const makeGroupProductId = makeIdFactory();
const makeViewerAccessId = makeIdFactory();
const makeStageAssignmentId = makeIdFactory();
const makeSectionId = makeIdFactory();
const makeRowId = makeIdFactory();

async function seedReports(): Promise<void> {
  const active = SEED_REPORTS.active;
  const published = SEED_REPORTS.published;
  await prisma.report.createMany({
    data: [
      {
        id: active.id,
        periodStart: new Date(active.periodStart),
        periodEnd: new Date(active.periodEnd),
        deadline: new Date(active.deadline),
        weekLabel: active.weekLabel,
        periodStatus: PeriodStatus.open,
        status: ReportStatus.draft,
        periodState: PeriodState.open,
      },
      {
        id: published.id,
        periodStart: new Date(published.periodStart),
        periodEnd: new Date(published.periodEnd),
        deadline: new Date(published.deadline),
        weekLabel: published.weekLabel,
        periodStatus: PeriodStatus.published,
        status: ReportStatus.published,
        periodState: PeriodState.published,
        publishedAt: new Date(published.publishedAt),
        publishedById: HEAD_USER_ID,
        publishedSnapshot: {
          reportId: published.id,
          periodStart: published.periodStart,
          periodEnd: published.periodEnd,
          deadline: published.deadline,
          status: ReportStatus.published,
          publishedAt: published.publishedAt,
          publishedById: HEAD_USER_ID,
          publishedByName: HEAD_NAME,
          portfolioOverview: {
            status: TrafficLightStatus.green,
            totals: { green: 1, yellow: 0, red: 0 },
          },
          sections: [],
        },
      },
    ],
  });
}

async function seedStageAssignments(dataset: TierDataset): Promise<void> {
  // Ownership: each section's lead owns its declared stages on its product.
  // @@unique([stageId, projectId]) — one owner per (stage, product).
  const seen = new Set<string>();
  const rows = dataset.sections.flatMap((section) =>
    section.ownedStages
      .map((stage) => ({
        stage,
        key: `${stageId(stage)}:${section.productId}`,
      }))
      .filter(({ key }) => !seen.has(key) && seen.add(key))
      .map(({ stage }) => ({
        id: makeStageAssignmentId(),
        projectId: section.productId,
        stageId: stageId(stage),
        userId: section.leadId,
      })),
  );
  await prisma.stageAssignment.createMany({ data: rows });
}

/**
 * Group per-product contributions by their owning lead. ReportSection is
 * `@@unique([reportId, authorId])`, so a lead authors exactly ONE section per
 * report — that section spans all of the lead's products.
 */
function groupByLead(
  sections: readonly DemoSection[],
): Map<string, DemoSection[]> {
  const byLead = new Map<string, DemoSection[]>();
  for (const section of sections) {
    const list = byLead.get(section.leadId) ?? [];
    list.push(section);
    byLead.set(section.leadId, list);
  }
  return byLead;
}

async function seedActiveLeadSection(
  leadId: string,
  contributions: readonly DemoSection[],
): Promise<void> {
  const sectionId = makeSectionId();
  const allSubmitted = contributions.every(
    (c) => c.sectionStatus === ReportSectionStatus.submitted,
  );
  await prisma.reportSection.create({
    data: {
      id: sectionId,
      reportId: ACTIVE_REPORT_ID,
      authorId: leadId,
      status: allSubmitted
        ? ReportSectionStatus.submitted
        : ReportSectionStatus.draft,
      submittedAt: allSubmitted
        ? new Date(SEED_REPORTS.active.periodStart)
        : null,
    },
  });

  for (const c of contributions) {
    await prisma.projectStatus.create({
      data: {
        id: makeRowId(),
        reportSectionId: sectionId,
        projectId: c.productId,
        status: c.productLight,
      },
    });
    await prisma.stageStatus.createMany({
      data: c.ownedStages.map((stage, idx) => ({
        id: makeRowId(),
        reportSectionId: sectionId,
        projectId: c.productId,
        stageId: stageId(stage),
        status: idx === 0 ? c.productLight : TrafficLightStatus.green,
      })),
    });
    await prisma.item.createMany({
      data: c.items.map((item) => ({
        id: makeRowId(),
        reportSectionId: sectionId,
        type: item.type,
        projectId: c.productId,
        text: item.text,
        tag: item.tag,
        workflowStatus: item.status,
        carriedOver: false,
        completed: item.completed ?? false,
        stageNames: item.stages,
        priorityRank: item.priorityRank ?? null,
      })),
    });
    if (c.risk) {
      await prisma.risk.create({
        data: {
          id: makeRowId(),
          reportSectionId: sectionId,
          projectId: c.productId,
          risk: c.risk.risk,
          impact: c.risk.impact,
          mitigation: c.risk.mitigation,
          severity: c.risk.severity,
          stageNames: [c.risk.stage],
        },
      });
    }
    if (c.decision) {
      await prisma.decision.create({
        data: {
          id: makeRowId(),
          reportSectionId: sectionId,
          productId: c.productId,
          text: c.decision.text,
          owner: c.leadLabel,
          impact: c.decision.impact,
          stageNames: [c.decision.stage],
        },
      });
    }
  }
}

async function seedPublishedLeadSection(
  leadId: string,
  contributions: readonly DemoSection[],
  productNames: ReadonlyMap<string, string>,
): Promise<void> {
  // One submitted prior-period section per lead so the published head view and
  // period switching have non-empty content (one done item per product).
  const sectionId = makeSectionId();
  await prisma.reportSection.create({
    data: {
      id: sectionId,
      reportId: PUBLISHED_REPORT_ID,
      authorId: leadId,
      status: ReportSectionStatus.submitted,
      submittedAt: new Date(SEED_REPORTS.published.publishedAt),
    },
  });
  for (const c of contributions) {
    await prisma.projectStatus.create({
      data: {
        id: makeRowId(),
        reportSectionId: sectionId,
        projectId: c.productId,
        status: TrafficLightStatus.green,
      },
    });
    await prisma.item.create({
      data: {
        id: makeRowId(),
        reportSectionId: sectionId,
        type: ItemType.current,
        projectId: c.productId,
        text: `Закрыли цели прошлой недели по продукту «${productNames.get(c.productId) ?? c.productId}»`,
        tag: "feature",
        workflowStatus: ItemWorkflowStatus.done,
        carriedOver: false,
        completed: true,
        stageNames: [c.ownedStages[0] ?? "Development"],
        priorityRank: 1,
      },
    });
  }
}

async function seedDemo(tier: Tier): Promise<void> {
  assertNonProdDestructive(`seed-demo:${tier}`);
  const dataset = tier === "small" ? SMALL_DATASET : buildHugeDataset();

  console.log(`[seed-demo:${tier}] Wiping existing data...`);
  await wipe();

  console.log(
    `[seed-demo:${tier}] Seeding scaffold (group/org/users/stages/products)...`,
  );
  await seedScaffold(dataset);

  console.log(`[seed-demo:${tier}] Seeding reports (active + published)...`);
  await seedReports();
  await seedStageAssignments(dataset);

  console.log(`[seed-demo:${tier}] Seeding active + published sections...`);
  const byLead = groupByLead(dataset.sections);
  const productNames = new Map(dataset.products.map((p) => [p.id, p.name]));
  for (const [leadId, contributions] of byLead) {
    await seedActiveLeadSection(leadId, contributions);
  }
  for (const [leadId, contributions] of byLead) {
    await seedPublishedLeadSection(leadId, contributions, productNames);
  }

  const counts = {
    users: await prisma.user.count(),
    products: await prisma.project.count({ where: { archived: false } }),
    stages: await prisma.stage.count(),
    reports: await prisma.report.count(),
    sections: await prisma.reportSection.count(),
    items: await prisma.item.count(),
    risks: await prisma.risk.count(),
    decisions: await prisma.decision.count(),
  };
  console.log(`[seed-demo:${tier}] Done: ${JSON.stringify(counts)}`);
}

function parseTier(): Tier {
  const arg = process.argv[2];
  if (arg === "small" || arg === "huge") return arg;
  if (arg === undefined) return "small";
  throw new Error(
    `Unknown demo tier "${arg}". Use "small" or "huge" (middle → seed-simple.ts).`,
  );
}

seedDemo(parseTier())
  .catch((err) => {
    console.error("[seed-demo] Failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
