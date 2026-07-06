/**
 * DEMO seed — tiered, presenter-controlled demo data.
 *
 * One shared writer, two plain-data tiers selected from the CLI:
 *   - small (default) — THREE leads co-owning Vasily's 3 products, role-shaped,
 *     showing all three health colours at once (BI green, Integrations yellow,
 *     Portal red): Vasily owns Development everywhere (+ Planning on BI, two
 *     owned stages there); Maria owns Testing (+ Analysis/Design on BI); Igor
 *     owns DevOps. BI is broadly staffed and green, leaving only Support unowned
 *     (a vacant SDLC role). Maria and Igor each seed foreign content on a shared
 *     product, so the lead report's Mine/Everyone toggle has a visible effect and
 *     the SDLC pipeline shows real split ownership. A BLOCKED item on the Portal
 *     gives the derived "Needs Attention" banner content to demonstrate.
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
  ReminderAudience,
  ReminderRuleKind,
  ReminderRuleStatus,
} from "@prisma/client";

import { assertNonProdDestructive } from "./_destructive-guard.js";
import { assertSeedCoverage } from "./seed-coverage-check.js";
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
  SEED_HISTORY_REPORTS,
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
// (consistent, not random). BI leaves only Support unowned to show a vacant role.
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
          status: ItemWorkflowStatus.in_progress,
          stages: ["Development"],
          priorityRank: 1,
        },
        {
          type: ItemType.next,
          text: "Подключить вход через корпоративный IdP после выдачи доступа",
          tag: "feature",
          status: ItemWorkflowStatus.planned,
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
      // small-seed-three-colors: Integrations is the YELLOW example — an at-risk
      // stage (below), never blocked.
      productLight: TrafficLightStatus.yellow,
      sectionStatus: ReportSectionStatus.draft,
      ownedStages: ["Development"],
      items: [
        {
          type: ItemType.current,
          text: "Реализовали REST-коннектор для платформы интеграций",
          tag: "feature",
          // Done exemplar: the small demo must show every status treatment.
          status: ItemWorkflowStatus.done,
          stages: ["Development"],
          priorityRank: 2,
        },
        {
          type: ItemType.next,
          text: "Покрыть коннектор контрактными тестами перед интеграцией",
          tag: "feature",
          status: ItemWorkflowStatus.planned,
          stages: ["Development"],
        },
      ],
      risk: {
        risk: "Партнёр задерживает финальную версию API коннектора",
        impact: "Возможна переделка коннектора перед боевой интеграцией",
        mitigation:
          "Зафиксировать текущую версию API, заложить буфер на доработку",
        severity: "at-risk",
        stage: "Development",
      },
      decision: {
        text: "Зафиксировать версию API партнёра для интеграции",
        impact: "Снижает риск ломающих изменений на их стороне",
        stage: "Development",
      },
    },
    // BI — the internal product, the GREEN showcase (small-seed-three-colors).
    // Vasily still owns EXACTLY TWO stages (Planning, Development). The rest are
    // broadly staffed by co-owners — Maria on Analysis/Design/Testing, Igor on
    // DevOps (all on-track, see their sections) — EXCEPT Support, deliberately
    // left unowned to show a vacant SDLC role. No risk covers BI, so its health
    // resolves green.
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
        // Item.stageNames spans Development + Testing — development and
        // acceptance testing run in parallel on this dashboard work, so the item
        // legitimately touches both phases. Portal/Integrations items stay
        // single-stage.
        {
          type: ItemType.current,
          text: "Новый дашборд BI: разработка и приёмочное тестирование идут параллельно",
          tag: "feature",
          status: ItemWorkflowStatus.in_progress,
          stages: ["Development", "Testing"],
          priorityRank: 3,
        },
        {
          type: ItemType.next,
          text: "Спланировать целевые показатели следующего спринта дашборда BI",
          tag: "infra",
          status: ItemWorkflowStatus.planned,
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
    // D5 (head-dashboard-declutter): Maria is the ONE SUBMITTED lead so the head
    // dashboard shows a Revoke affordance. All her contributions are flipped to
    // `submitted` (seedActiveLeadSection submits the section only when EVERY
    // contribution is submitted). Submission is orthogonal to product health and
    // to the Everyone-lens content, so it moves neither: she defines no worst
    // status (Portal red = Igor, Integrations yellow = Vasily) and crossAuthorContent
    // does not filter by section status. Vasily + Igor stay draft → period stays
    // `open` and a draft lead remains for the Remind demo.
    {
      leadId: LEAD_MARIA_ID,
      leadLabel: MARIA_LABEL,
      productId: PROD_PORTAL,
      productLight: TrafficLightStatus.yellow,
      sectionStatus: ReportSectionStatus.submitted,
      ownedStages: ["Testing"],
      items: [
        {
          type: ItemType.current,
          text: "Прогон регрессии по сценариям входа портала, чиним флаки-тесты",
          tag: "bugfix",
          status: ItemWorkflowStatus.in_progress,
          stages: ["Testing"],
        },
        {
          type: ItemType.next,
          text: "Автоматизировать регрессию входа портала в CI на следующей неделе",
          tag: "bugfix",
          status: ItemWorkflowStatus.planned,
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
    // Maria also owns Testing on Integrations. She carries cross-author content
    // here (an item + a decision) so the lead's "Everyone" visibility lens on
    // Vasily's Integrations product shows co-owner records, not just own ones.
    {
      leadId: LEAD_MARIA_ID,
      leadLabel: MARIA_LABEL,
      productId: PROD_INTEGRATIONS,
      productLight: TrafficLightStatus.green,
      sectionStatus: ReportSectionStatus.submitted, // D5: Maria submitted (see above)
      ownedStages: ["Testing"],
      items: [
        {
          type: ItemType.current,
          text: "Контрактные тесты REST-коннектора зелёные на стенде интеграций",
          tag: "feature",
          status: ItemWorkflowStatus.in_progress,
          stages: ["Testing"],
        },
        {
          type: ItemType.next,
          text: "Подготовить нагрузочные тесты REST-коннектора к следующему спринту",
          tag: "feature",
          status: ItemWorkflowStatus.planned,
          stages: ["Testing"],
        },
      ],
      decision: {
        text: "Принять контрактные тесты как gate перед боевой интеграцией",
        impact: "Ломающие изменения партнёрского API ловятся до релиза",
        stage: "Testing",
      },
    },
    // Maria also owns Analysis/Design/Testing on BI — the broad staffing that
    // makes BI read as a fully-owned green showcase (Support stays the one
    // vacant role). All on-track; single-stage items keep the tier minimal.
    {
      leadId: LEAD_MARIA_ID,
      leadLabel: MARIA_LABEL,
      productId: PROD_BI,
      productLight: TrafficLightStatus.green,
      sectionStatus: ReportSectionStatus.submitted, // D5: Maria submitted (see above)
      ownedStages: ["Analysis", "Design", "Testing"],
      items: [
        {
          type: ItemType.current,
          text: "Согласовали аналитику и макеты экранов дашборда BI",
          tag: "feature",
          // Done exemplar (second author) — green frame on the slide.
          status: ItemWorkflowStatus.done,
          stages: ["Analysis"],
        },
        {
          type: ItemType.next,
          text: "Прогнать приёмочные сценарии дашборда BI на следующей неделе",
          tag: "bugfix",
          status: ItemWorkflowStatus.planned,
          stages: ["Testing"],
        },
      ],
    },
    // --- Igor (co-owner) — owns DevOps; on-track on BI (green showcase) -----
    {
      leadId: LEAD_IGOR_ID,
      leadLabel: IGOR_LABEL,
      productId: PROD_BI,
      // small-seed-three-colors: BI is the green showcase — Igor's DevOps is
      // on-track here (the cluster blocker moved to the Portal, see below).
      productLight: TrafficLightStatus.green,
      sectionStatus: ReportSectionStatus.draft,
      ownedStages: ["DevOps"],
      items: [
        {
          type: ItemType.current,
          text: "Прод-стенд дашборда BI развёрнут, мониторинг кластера настроен",
          tag: "infra",
          status: ItemWorkflowStatus.in_progress,
          stages: ["DevOps"],
        },
        {
          type: ItemType.next,
          text: "Автоматизировать выкладку дашборда BI через CI/CD пайплайн",
          tag: "infra",
          status: ItemWorkflowStatus.planned,
          stages: ["DevOps"],
        },
      ],
      // Cross-author decision on Vasily's BI product, surfaced in his
      // "Everyone" visibility lens.
      decision: {
        text: "Закрепить регламент мониторинга кластера дашборда BI",
        impact: "Фиксирует SLA эксплуатации после выхода в прод",
        stage: "DevOps",
      },
    },
    // Igor also owns DevOps on Portal and Integrations (consistent role).
    // small-seed-three-colors: the cluster blocker lives on the Portal now — a
    // FOREIGN-owned blocked stage, so Vasily sees his co-owned Portal go red on
    // a stage he does not own (Product context demo), while BI stays green.
    {
      leadId: LEAD_IGOR_ID,
      leadLabel: IGOR_LABEL,
      productId: PROD_PORTAL,
      productLight: TrafficLightStatus.red,
      sectionStatus: ReportSectionStatus.draft,
      ownedStages: ["DevOps"],
      items: [
        {
          type: ItemType.current,
          text: "Деплой портала заблокирован: не выделены мощности кластера",
          tag: "infra",
          status: ItemWorkflowStatus.in_progress,
          stages: ["DevOps"],
        },
        {
          type: ItemType.next,
          text: "Настроить мониторинг кластера портала после выделения ресурсов",
          tag: "infra",
          status: ItemWorkflowStatus.planned,
          stages: ["DevOps"],
        },
      ],
      risk: {
        risk: "Нет выделенных мощностей кластера под прод-стенд портала",
        impact: "Релиз портала сдвигается до выделения ресурсов",
        mitigation: "Заявка в инфраструктуру, временный деплой на общий стенд",
        severity: "blocked",
        stage: "DevOps",
      },
    },
    {
      leadId: LEAD_IGOR_ID,
      leadLabel: IGOR_LABEL,
      productId: PROD_INTEGRATIONS,
      productLight: TrafficLightStatus.green,
      sectionStatus: ReportSectionStatus.draft,
      ownedStages: ["DevOps"],
      items: [
        {
          // Status exemplar: PAUSED — the small tier must show every current-item
          // status treatment, including work paused mid-stream.
          type: ItemType.current,
          text: "Развёртывание стенда интеграций приостановлено: ждём окно на общем кластере",
          tag: "infra",
          status: ItemWorkflowStatus.paused,
          stages: ["DevOps"],
        },
        {
          // Status exemplar: POSTPONED — the small tier must show every next-item
          // status treatment, including planned work pushed out.
          type: ItemType.next,
          text: "Автоматизировать выкладку коннектора через CI/CD пайплайн",
          tag: "infra",
          status: ItemWorkflowStatus.postponed,
          stages: ["DevOps"],
        },
      ],
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
    // Ranks are per-author: the lead's first three products get P1..P3 (in
    // product order), the rest stay unranked — a slide never shows duplicate
    // ranks or a wall of P1s.
    const rankWithinLead = SEED_PRODUCTS.filter(
      (sp) => sp.leadId === p.leadId,
    ).findIndex((sp) => sp.id === p.id);
    const priorityRank = rankWithinLead < 3 ? rankWithinLead + 1 : null;
    // Every 5th product is blocked+red, every 3rd is at-risk+yellow, else green.
    const blocked = idx % 5 === 0;
    const atRisk = !blocked && idx % 3 === 0;
    const light = blocked
      ? TrafficLightStatus.red
      : atRisk
        ? TrafficLightStatus.yellow
        : TrafficLightStatus.green;

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
          // Every 7th product pauses its lead work so the huge tier shows the
          // full Progress vocabulary, not just in-progress/done/planned.
          text:
            idx % 7 === 1
              ? `Работы по продукту «${p.name}» на паузе: ждём внешнюю команду`
              : `Работы по продукту «${p.name}» на этапе ${stage}`,
          tag: "feature",
          status:
            idx % 7 === 1
              ? ItemWorkflowStatus.paused
              : ItemWorkflowStatus.in_progress,
          stages: [stage],
          ...(priorityRank === null ? {} : { priorityRank }),
        },
        {
          type: ItemType.current,
          text: `Закрыли часть задач по продукту «${p.name}»`,
          tag: "bugfix",
          status: ItemWorkflowStatus.done,
          stages: [stage],
        },
        {
          type: ItemType.next,
          // Every 7th product (offset 3) postpones its next-week focus.
          text:
            idx % 7 === 3
              ? `Следующий фокус по продукту «${p.name}» отложен на следующий цикл`
              : `Следующий фокус по продукту «${p.name}»`,
          tag: "ops",
          status:
            idx % 7 === 3
              ? ItemWorkflowStatus.postponed
              : ItemWorkflowStatus.planned,
          stages: [stage],
        },
      ],
      // A red product's blocked signal IS its blocker risk (no stored blocked
      // item status exists) — every 5th product gets one, every 3rd an at-risk.
      risk: blocked
        ? {
            risk: `Блокер по продукту «${p.name}»: внешняя зависимость встала`,
            impact: "Работы на этапе остановлены до разблокировки",
            mitigation: "Эскалация владельцу зависимости",
            severity: "blocked",
            stage,
          }
        : atRisk
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
  // Activity statuses drop before their activities (RESTRICT), activities
  // before ReportingGroup/User/Project.
  await prisma.activityStatus.deleteMany({});
  await prisma.reminderExecution.deleteMany({});
  await prisma.reminderRule.deleteMany({});
  await prisma.reminderPolicy.deleteMany({});
  await prisma.decision.deleteMany({});
  await prisma.risk.deleteMany({});
  await prisma.item.deleteMany({});
  // Activities go only after their referencing records (items/risks/decisions
  // carry activityId) — the reverse order trips the FK on a populated DB.
  await prisma.projectActivityLead.deleteMany({});
  await prisma.projectActivityProduct.deleteMany({});
  await prisma.projectActivity.deleteMany({});
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
      ...dataset.leads.map((lead) => {
        const seedUser = SEED_USERS.find((u) => u.email === lead.email);
        return {
          id: lead.id,
          email: lead.email,
          name: seedUser?.name ?? lead.name,
          lastName:
            seedUser?.lastName ?? lead.name.split(/\s+/)[0] ?? lead.name,
          firstName: seedUser?.firstName ?? lead.name.split(/\s+/)[1] ?? "Lead",
          middleName: seedUser?.middleName ?? null,
          position: seedUser?.position ?? null,
          role: Role.lead,
          samlId: lead.samlId,
          reportingGroupId: DEFAULT_REPORTING_GROUP_ID,
        };
      }),
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
      // History periods (N-2 .. N-4). N-3 and N-4 are archived so the lead
      // report toolbar surfaces the show-archived filter (it renders only when
      // the lead has at least one archived period). All are published.
      ...SEED_HISTORY_REPORTS.map((h) => ({
        id: h.id,
        periodStart: new Date(h.periodStart),
        periodEnd: new Date(h.periodEnd),
        deadline: new Date(h.deadline),
        weekLabel: h.weekLabel,
        periodStatus: PeriodStatus.published,
        status: ReportStatus.published,
        periodState: h.archived ? PeriodState.archived : PeriodState.published,
        archived: h.archived,
        publishedAt: new Date(h.periodEnd),
        publishedById: HEAD_USER_ID,
      })),
    ],
  });
}

// D6 (head-dashboard-declutter): one active reminder policy + rule for the
// active period so the head's per-lead Remind action both renders (the
// `hasActiveReminderRule` gate counts active ReminderPolicies whose validity
// window covers `Report.deadline`) and actually dispatches (`reminders.
// dispatchPending` looks up an active ReminderRule scoped to the active report).
// Mirrors the proven `seed-simple.ts` deadline policy+rule shape. Fixed UUIDs
// (`d…9000…`, distinct from the `d…8000…` counter ids) keep reseed deterministic.
const REMINDER_POLICY_DEADLINE_ID = "d0000000-0000-4000-9000-000000000001";
const REMINDER_RULE_DEADLINE_ID = "d0000000-0000-4000-9000-000000000002";
const REMINDER_OFFSET_MINUTES = -1440; // fire 24h before deadline (seed-simple parity)
const REMINDER_TIMEZONE = "Europe/Moscow";

async function seedReminders(): Promise<void> {
  const activeDeadline = new Date(SEED_REPORTS.active.deadline);
  // Deterministic fireAt derived from the active deadline — no wall-clock.
  const fireAt = new Date(
    activeDeadline.getTime() + REMINDER_OFFSET_MINUTES * 60_000,
  );
  await prisma.reminderPolicy.create({
    data: {
      id: REMINDER_POLICY_DEADLINE_ID,
      kind: ReminderRuleKind.deadline,
      offsetMinutes: REMINDER_OFFSET_MINUTES,
      timezone: REMINDER_TIMEZONE,
      audience: ReminderAudience.LEAD_WITH_DRAFT,
      active: true,
      // validFrom ≤ active deadline, no validUntil → covers the active period.
      validFrom: new Date(SEED_REPORTS.active.periodStart),
    },
  });
  await prisma.reminderRule.create({
    data: {
      id: REMINDER_RULE_DEADLINE_ID,
      reportId: ACTIVE_REPORT_ID,
      policyId: REMINDER_POLICY_DEADLINE_ID,
      kind: ReminderRuleKind.deadline,
      fireAt,
      timezone: REMINDER_TIMEZONE,
      status: ReminderRuleStatus.active,
      version: 1,
    },
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

async function seedPriorLeadSection(
  reportId: string,
  submittedAt: Date,
  leadId: string,
  contributions: readonly DemoSection[],
  productNames: ReadonlyMap<string, string>,
): Promise<void> {
  // One submitted prior-period section per lead so the published head view,
  // archived history, and period switching have non-empty content (one done
  // item per product).
  const sectionId = makeSectionId();
  await prisma.reportSection.create({
    data: {
      id: sectionId,
      reportId,
      authorId: leadId,
      status: ReportSectionStatus.submitted,
      submittedAt,
    },
  });
  for (const [index, c] of contributions.entries()) {
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
        stageNames: [c.ownedStages[0] ?? "Development"],
        // Ranks are per-author — the prior period keeps the same P1..P3
        // spread as the active one instead of stamping P1 on every product.
        priorityRank: index < 3 ? index + 1 : null,
      },
    });
  }
}

// Small-tier Project Activities: the base demo must show the by-product slide
// with project subsections out of the box. Three activities on Vasily's
// portal — one carrying a real record, two status-only — so both render paths
// (records + bare header row) are visible without extra seeding.
async function seedSmallActivities(): Promise<void> {
  const vasilySection = await prisma.reportSection.findFirst({
    where: { reportId: ACTIVE_REPORT_ID, authorId: LEAD_1_ID },
    select: { id: true },
  });
  if (!vasilySection) throw new Error("small tier: Vasily section missing");

  // Two activities on the portal, one on BI (owner-requested demo layout).
  const activities = [
    {
      name: "Исследование новых интеграций",
      productId: PROD_PORTAL,
      status: TrafficLightStatus.yellow,
      note: "Партнёр задерживает доступ к API",
    },
    {
      name: "Поддержка и сопровождение",
      productId: PROD_PORTAL,
      status: TrafficLightStatus.green,
    },
    {
      name: "Технический долг и рефакторинг",
      productId: PROD_BI,
      status: TrafficLightStatus.yellow,
    },
  ] as const;

  const created = await Promise.all(
    activities.map(async (activity) => {
      const activityId = makeRowId();
      await prisma.projectActivity.create({
        data: {
          id: activityId,
          name: activity.name,
          groupId: DEFAULT_REPORTING_GROUP_ID,
        },
      });
      await prisma.projectActivityProduct.create({
        data: {
          id: makeRowId(),
          activityId,
          productId: activity.productId,
        },
      });
      await prisma.projectActivityLead.create({
        data: { id: makeRowId(), activityId, leadId: LEAD_1_ID },
      });
      await prisma.activityStatus.create({
        data: {
          id: makeRowId(),
          reportSectionId: vasilySection.id,
          activityId,
          status: activity.status,
          note: "note" in activity ? activity.note : null,
        },
      });
      return activityId;
    }),
  );

  // «Исследование новых интеграций» carries a full set (current + next item,
  // risk, decision) so the slide shows a fully-populated activity row.
  await prisma.item.createMany({
    data: [
      {
        id: makeRowId(),
        reportSectionId: vasilySection.id,
        type: ItemType.current,
        activityId: created[0],
        text: "Составили шорт-лист интеграций для пилота",
        tag: "research",
        workflowStatus: ItemWorkflowStatus.in_progress,
        carriedOver: false,
        stageNames: [],
      },
      {
        id: makeRowId(),
        reportSectionId: vasilySection.id,
        type: ItemType.next,
        activityId: created[0],
        text: "Согласовать пилотных партнёров для новых интеграций",
        tag: "research",
        workflowStatus: ItemWorkflowStatus.planned,
        carriedOver: false,
        stageNames: [],
      },
    ],
  });
  await prisma.risk.create({
    data: {
      id: makeRowId(),
      reportSectionId: vasilySection.id,
      activityId: created[0],
      risk: "Партнёр задерживает доступ к API для пилотной интеграции",
      impact: "Сдвиг сроков пилота новых интеграций",
      mitigation: "Эскалация владельцу API, поиск альтернативного партнёра",
      severity: "at-risk",
      stageNames: [],
    },
  });
  await prisma.decision.create({
    data: {
      id: makeRowId(),
      reportSectionId: vasilySection.id,
      activityId: created[0],
      text: "Зафиксировать шорт-лист партнёров для пилота интеграций",
      owner: VASILY_LABEL,
      impact: "Даёт чёткий периметр для оценки следующего этапа",
      stageNames: [],
    },
  });

  // «Поддержка и сопровождение» carries one current item — a status-only
  // header row with a single live record, no next item/risk/decision.
  await prisma.item.create({
    data: {
      id: makeRowId(),
      reportSectionId: vasilySection.id,
      type: ItemType.current,
      activityId: created[1],
      text: "Обработали текущие обращения пользователей портала",
      tag: "ops",
      workflowStatus: ItemWorkflowStatus.in_progress,
      carriedOver: false,
      stageNames: [],
    },
  });

  // «Технический долг и рефакторинг» (BI) carries a full set too.
  await prisma.item.createMany({
    data: [
      {
        id: makeRowId(),
        reportSectionId: vasilySection.id,
        type: ItemType.current,
        activityId: created[2],
        text: "Выделили модуль форматирования отчётов BI в общую библиотеку",
        tag: "tech-debt",
        workflowStatus: ItemWorkflowStatus.in_progress,
        carriedOver: false,
        stageNames: [],
      },
      {
        id: makeRowId(),
        reportSectionId: vasilySection.id,
        type: ItemType.next,
        activityId: created[2],
        text: "Спланировать рефакторинг слоя доступа к данным BI",
        tag: "tech-debt",
        workflowStatus: ItemWorkflowStatus.planned,
        carriedOver: false,
        stageNames: [],
      },
    ],
  });
  await prisma.risk.create({
    data: {
      id: makeRowId(),
      reportSectionId: vasilySection.id,
      activityId: created[2],
      risk: "Накопленный технический долг замедляет доработки дашборда BI",
      impact: "Растущее время на каждую следующую фичу BI",
      mitigation: "Выделить фиксированную долю спринта под рефакторинг",
      severity: "at-risk",
      stageNames: [],
    },
  });
  await prisma.decision.create({
    data: {
      id: makeRowId(),
      reportSectionId: vasilySection.id,
      activityId: created[2],
      text: "Выделять 20% спринта под технический долг BI до конца квартала",
      owner: VASILY_LABEL,
      impact: "Останавливает рост технического долга дашборда BI",
      stageNames: [],
    },
  });
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

  // D6: small tier seeds an active reminder policy+rule so the dashboard's
  // per-lead Remind action renders and dispatches for real (the huge tier is a
  // scroll/stress fixture and does not exercise the Remind affordance).
  if (tier === "small") {
    console.log(`[seed-demo:${tier}] Seeding active reminder policy + rule...`);
    await seedReminders();
  }

  console.log(`[seed-demo:${tier}] Seeding active + published sections...`);
  const byLead = groupByLead(dataset.sections);
  const productNames = new Map(dataset.products.map((p) => [p.id, p.name]));
  for (const [leadId, contributions] of byLead) {
    await seedActiveLeadSection(leadId, contributions);
  }
  if (tier === "small") {
    console.log(`[seed-demo:${tier}] Seeding project activities...`);
    await seedSmallActivities();
  }
  for (const [leadId, contributions] of byLead) {
    await seedPriorLeadSection(
      PUBLISHED_REPORT_ID,
      new Date(SEED_REPORTS.published.publishedAt),
      leadId,
      contributions,
      productNames,
    );
  }
  // History periods give the lead archived periods to surface the
  // show-archived toggle, and keep the head/period-switch views non-empty.
  for (const h of SEED_HISTORY_REPORTS) {
    for (const [leadId, contributions] of byLead) {
      await seedPriorLeadSection(
        h.id,
        new Date(h.periodEnd),
        leadId,
        contributions,
        productNames,
      );
    }
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
  await assertSeedCoverage(prisma, `seed-demo:${tier}`);
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
