import type { PrismaClient } from "@prisma/client";

import {
  LEAD_SLOT_DMITRY,
  LEAD_SLOT_IGOR,
  LEAD_SLOT_OLGA,
  LEAD_SLOT_PRIMARY,
  PRODUCT_ANALYTICS_HUB,
  PRODUCT_INTERNAL_BI,
  PRODUCT_MARKETING_PORTAL,
  PRODUCT_PAYMENT_GATEWAY,
  PRODUCT_SECURITY_GATEWAY,
  STAGE_NAME_DEVELOPMENT,
  STAGE_NAME_DEVOPS,
  STAGE_NAME_SUPPORT,
  STAGE_NAME_TESTING,
} from "./seed-advanced.anchors.js";
import { ACTIVE_SUFFIX, riskId, sectionId } from "./seed-advanced.ids.js";
import { leadIdForSlot } from "./seed-advanced.leads.js";
import type { StageOwnership } from "./seed-advanced.stage-names.js";
import { ownedStageName } from "./seed-advanced.stage-names.js";

const SEVERITY_AT_RISK = "at-risk";
const SEVERITY_BLOCKED = "blocked";

// Risk rows must carry a stage their author owns on the row's product, so the
// hand-written phase below is a preference the resolver can move.
const PRIMARY_LEAD = leadIdForSlot(LEAD_SLOT_PRIMARY);
const IGOR_LEAD = leadIdForSlot(LEAD_SLOT_IGOR);
const DMITRY_LEAD = leadIdForSlot(LEAD_SLOT_DMITRY);
const OLGA_LEAD = leadIdForSlot(LEAD_SLOT_OLGA);

interface RiskRow {
  readonly id: string;
  readonly stableId: string;
  readonly reportSectionId: string;
  readonly projectId: string;
  readonly risk: string;
  readonly impact: string;
  readonly mitigation: string;
  readonly stageNames: string[];
  readonly severity: string;
}

const RISK_SEQ = {
  partnerRateLimit: 1,
  etlMemoryLeak: 2,
  pgBouncerDowntime: 3,
  wafFalsePositives: 4,
  testingEnvironment: 5,
  devOpsBlocked: 6,
} as const;

// Russian-language risks mirroring the seeded items. Each risk ties to a
// specific project so the form's per-product chip + risk-card pair stays
// coherent (no orphan risks for products the lead does not own).
const riskRows = (ownership: StageOwnership): readonly RiskRow[] => [
  {
    id: riskId(RISK_SEQ.partnerRateLimit),
    stableId: riskId(RISK_SEQ.partnerRateLimit),
    reportSectionId: sectionId(ACTIVE_SUFFIX, LEAD_SLOT_PRIMARY),
    projectId: PRODUCT_MARKETING_PORTAL,
    risk: "Партнёрский OAuth2 API режет нас по rate-limit на пиковом трафике",
    impact: "Сдвигает milestone SSO на 1 неделю, блокирует смежную команду",
    mitigation:
      "Эскалирована заявка на расширение квоты, параллельно готовим batch-fallback",
    stageNames: [
      ownedStageName(
        PRIMARY_LEAD,
        PRODUCT_MARKETING_PORTAL,
        STAGE_NAME_DEVELOPMENT,
        ownership,
      ),
    ],
    severity: SEVERITY_AT_RISK,
  },
  {
    id: riskId(RISK_SEQ.etlMemoryLeak),
    stableId: riskId(RISK_SEQ.etlMemoryLeak),
    reportSectionId: sectionId(ACTIVE_SUFFIX, LEAD_SLOT_PRIMARY),
    projectId: PRODUCT_ANALYTICS_HUB,
    risk: "Memory leak в ETL — OOM на больших экстрактах (>2M строк)",
    impact: "Блокирует релиз до получения патча от вендора",
    mitigation:
      "Патч ETA 8 мая, временно перешли на chunked extraction по 500K",
    stageNames: [
      ownedStageName(
        PRIMARY_LEAD,
        PRODUCT_ANALYTICS_HUB,
        STAGE_NAME_TESTING,
        ownership,
      ),
    ],
    severity: SEVERITY_AT_RISK,
  },
  {
    id: riskId(RISK_SEQ.pgBouncerDowntime),
    stableId: riskId(RISK_SEQ.pgBouncerDowntime),
    reportSectionId: sectionId(ACTIVE_SUFFIX, LEAD_SLOT_IGOR),
    projectId: PRODUCT_INTERNAL_BI,
    risk: "Миграция PgBouncer требует ~30 мин downtime в проде",
    impact: "Окно обслуживания затрагивает зависимые сервисы (auth, payments)",
    mitigation:
      "Окно запланировано в субботу 02:00 МСК, rollback-план провалидирован",
    stageNames: [
      ownedStageName(
        IGOR_LEAD,
        PRODUCT_INTERNAL_BI,
        STAGE_NAME_DEVOPS,
        ownership,
      ),
    ],
    severity: SEVERITY_AT_RISK,
  },
  {
    id: riskId(RISK_SEQ.wafFalsePositives),
    stableId: riskId(RISK_SEQ.wafFalsePositives),
    reportSectionId: sectionId(ACTIVE_SUFFIX, LEAD_SLOT_DMITRY),
    projectId: PRODUCT_SECURITY_GATEWAY,
    risk: "Тюнинг WAF может выдавать false positives на пиковой нагрузке",
    impact: "Часть клиентских запросов может блокироваться без причины",
    mitigation: "Раскатка через shadow-mode + кнопка мгновенного rollback",
    stageNames: [
      ownedStageName(
        DMITRY_LEAD,
        PRODUCT_SECURITY_GATEWAY,
        STAGE_NAME_SUPPORT,
        ownership,
      ),
    ],
    severity: SEVERITY_AT_RISK,
  },
  // Olga's Testing stage carries no explicit stageStatus, so
  // deriveEffectiveStageStatus shows its chip at-risk from this risk alone.
  {
    id: riskId(RISK_SEQ.testingEnvironment),
    stableId: riskId(RISK_SEQ.testingEnvironment),
    reportSectionId: sectionId(ACTIVE_SUFFIX, LEAD_SLOT_OLGA),
    projectId: PRODUCT_PAYMENT_GATEWAY,
    risk: "Нестабильность Testing-окружения при нагрузочных прогонах",
    impact: "Задержка валидации релиза",
    mitigation:
      "Изолированный стенд для нагрузки запланирован на следующий спринт",
    stageNames: [
      ownedStageName(
        OLGA_LEAD,
        PRODUCT_PAYMENT_GATEWAY,
        STAGE_NAME_TESTING,
        ownership,
      ),
    ],
    severity: SEVERITY_AT_RISK,
  },
  // The covering blocker for Olga's DevOps item: that item is stored
  // `in_progress` and its blocked pill DERIVES from this risk.
  {
    id: riskId(RISK_SEQ.devOpsBlocked),
    stableId: riskId(RISK_SEQ.devOpsBlocked),
    reportSectionId: sectionId(ACTIVE_SUFFIX, LEAD_SLOT_OLGA),
    projectId: PRODUCT_PAYMENT_GATEWAY,
    risk: "Настройка DevOps-конвейера заблокирована ожиданием Dev-фикса",
    impact: "Блокирует выкатку Платёжного шлюза до устранения",
    mitigation:
      "Эскалировано команде Dev; ETA фикса — начало следующего спринта",
    stageNames: [
      ownedStageName(
        OLGA_LEAD,
        PRODUCT_PAYMENT_GATEWAY,
        STAGE_NAME_DEVOPS,
        ownership,
      ),
    ],
    severity: SEVERITY_BLOCKED,
  },
];

/** Seeds the active period's risks; returns the row count for the summary. */
export async function seedRisks(
  prisma: PrismaClient,
  ownership: StageOwnership,
): Promise<number> {
  const rows = riskRows(ownership);
  for (const { id, ...fields } of rows) {
    await prisma.risk.upsert({
      where: { id },
      update: fields,
      create: { id, ...fields },
    });
  }
  return rows.length;
}
