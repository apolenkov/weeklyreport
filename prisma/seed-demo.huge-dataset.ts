// HUGE tier — dense fixture for stress/scroll demos. Reuses all canonical
// leads + products from seed-constants; content is templated but fixed.

import {
  ItemType,
  ItemWorkflowStatus,
  ReportSectionStatus,
  TrafficLightStatus,
} from "@prisma/client";

import type { SeedProduct } from "./seed-constants.js";
import { SEED_PRODUCTS, SEED_USERS } from "./seed-constants.js";
import { MAX_RANKED_PRODUCTS } from "./seed-demo.constants.js";
import type {
  DemoItem,
  DemoLead,
  DemoProduct,
  DemoRisk,
  DemoSection,
  StageName,
  TierDataset,
} from "./seed-demo.types.js";

const HUGE_STAGE_ROTATION: StageName[] = [
  "Development",
  "Testing",
  "Design",
  "Analysis",
  "DevOps",
];

// Health cadence: every 5th product is blocked+red, every 3rd is at-risk+yellow,
// the rest green.
const BLOCKED_EVERY = 5;
const AT_RISK_EVERY = 3;
// Progress cadence: one product in every 7 pauses its current work (offset 1)
// and one postpones its next-week focus (offset 3), so the tier shows the full
// Progress vocabulary rather than in-progress/done/planned only.
const PROGRESS_CYCLE = 7;
const PAUSED_OFFSET = 1;
const POSTPONED_OFFSET = 3;

interface HugeHealth {
  blocked: boolean;
  atRisk: boolean;
  light: TrafficLightStatus;
}

function hugeHealth(idx: number): HugeHealth {
  const blocked = idx % BLOCKED_EVERY === 0;
  const atRisk = !blocked && idx % AT_RISK_EVERY === 0;
  const light = blocked
    ? TrafficLightStatus.red
    : atRisk
      ? TrafficLightStatus.yellow
      : TrafficLightStatus.green;
  return { blocked, atRisk, light };
}

function rotationStage(idx: number): StageName {
  const stage = HUGE_STAGE_ROTATION[idx % HUGE_STAGE_ROTATION.length];
  if (!stage) throw new Error("seed-demo: stage rotation is empty");
  return stage;
}

// Ranks are per-author: the lead's first three products get P1..P3 (in product
// order), the rest stay unranked — a slide never shows duplicate ranks or a
// wall of P1s.
function priorityRankOf(product: SeedProduct): number | null {
  const rankWithinLead = SEED_PRODUCTS.filter(
    (sp) => sp.leadId === product.leadId,
  ).findIndex((sp) => sp.id === product.id);
  return rankWithinLead < MAX_RANKED_PRODUCTS ? rankWithinLead + 1 : null;
}

function hugeItems(
  name: string,
  stage: StageName,
  idx: number,
  priorityRank: number | null,
): DemoItem[] {
  const paused = idx % PROGRESS_CYCLE === PAUSED_OFFSET;
  const postponed = idx % PROGRESS_CYCLE === POSTPONED_OFFSET;
  return [
    {
      type: ItemType.current,
      text: paused
        ? `Работы по продукту «${name}» на паузе: ждём внешнюю команду`
        : `Работы по продукту «${name}» на этапе ${stage}`,
      tag: "feature",
      status: paused
        ? ItemWorkflowStatus.paused
        : ItemWorkflowStatus.in_progress,
      stages: [stage],
      ...(priorityRank === null ? {} : { priorityRank }),
    },
    {
      type: ItemType.current,
      text: `Закрыли часть задач по продукту «${name}»`,
      tag: "bugfix",
      status: ItemWorkflowStatus.done,
      stages: [stage],
    },
    {
      type: ItemType.next,
      text: postponed
        ? `Следующий фокус по продукту «${name}» отложен на следующий цикл`
        : `Следующий фокус по продукту «${name}»`,
      tag: "ops",
      status: postponed
        ? ItemWorkflowStatus.postponed
        : ItemWorkflowStatus.planned,
      stages: [stage],
    },
  ];
}

// A red product's blocked signal IS its blocker risk (no stored blocked item
// status exists).
function hugeRisk(
  name: string,
  stage: StageName,
  health: HugeHealth,
): DemoRisk | undefined {
  if (health.blocked) {
    return {
      risk: `Блокер по продукту «${name}»: внешняя зависимость встала`,
      impact: "Работы на этапе остановлены до разблокировки",
      mitigation: "Эскалация владельцу зависимости",
      severity: "blocked",
      stage,
    };
  }
  if (health.atRisk) {
    return {
      risk: `Открытый риск по продукту «${name}»`,
      impact: "Возможен сдвиг сроков на этапе доставки",
      mitigation: "Еженедельный синк с командой и заказчиком",
      severity: "at-risk",
      stage,
    };
  }
  return undefined;
}

function buildHugeSection(
  product: SeedProduct,
  idx: number,
  labelById: ReadonlyMap<string, string>,
): DemoSection {
  const stage = rotationStage(idx);
  const health = hugeHealth(idx);
  const risk = hugeRisk(product.name, stage, health);
  return {
    leadId: product.leadId,
    leadLabel: labelById.get(product.leadId) ?? "Lead",
    productId: product.id,
    productLight: health.light,
    sectionStatus:
      idx % 2 === 0 ? ReportSectionStatus.draft : ReportSectionStatus.submitted,
    ownedStages: [stage],
    items: hugeItems(product.name, stage, idx, priorityRankOf(product)),
    ...(risk === undefined ? {} : { risk }),
    decision: {
      text: `Зафиксировать приоритеты по продукту «${product.name}»`,
      impact: "Снимает неопределённость по очереди задач",
      stage,
    },
  };
}

export function buildHugeDataset(): TierDataset {
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

  const sections: DemoSection[] = SEED_PRODUCTS.map((p, idx) =>
    buildHugeSection(p, idx, labelById),
  );

  return { leads, products, sections };
}
