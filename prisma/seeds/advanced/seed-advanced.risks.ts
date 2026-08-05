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

const SEVERITY_AT_RISK = "at-risk";
const SEVERITY_BLOCKED = "blocked";

interface RiskRow {
  readonly id: string;
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
const RISK_ROWS: readonly RiskRow[] = [
  {
    id: riskId(RISK_SEQ.partnerRateLimit),
    reportSectionId: sectionId(ACTIVE_SUFFIX, LEAD_SLOT_PRIMARY),
    projectId: PRODUCT_MARKETING_PORTAL,
    risk: "Партнёрский OAuth2 API режет нас по rate-limit на пиковом трафике",
    impact: "Сдвигает milestone SSO на 1 неделю, блокирует смежную команду",
    mitigation:
      "Эскалирована заявка на расширение квоты, параллельно готовим batch-fallback",
    stageNames: [STAGE_NAME_DEVELOPMENT],
    severity: SEVERITY_AT_RISK,
  },
  {
    id: riskId(RISK_SEQ.etlMemoryLeak),
    reportSectionId: sectionId(ACTIVE_SUFFIX, LEAD_SLOT_PRIMARY),
    projectId: PRODUCT_ANALYTICS_HUB,
    risk: "Memory leak в ETL — OOM на больших экстрактах (>2M строк)",
    impact: "Блокирует релиз до получения патча от вендора",
    mitigation:
      "Патч ETA 8 мая, временно перешли на chunked extraction по 500K",
    stageNames: [STAGE_NAME_TESTING],
    severity: SEVERITY_AT_RISK,
  },
  {
    id: riskId(RISK_SEQ.pgBouncerDowntime),
    reportSectionId: sectionId(ACTIVE_SUFFIX, LEAD_SLOT_IGOR),
    projectId: PRODUCT_INTERNAL_BI,
    risk: "Миграция PgBouncer требует ~30 мин downtime в проде",
    impact: "Окно обслуживания затрагивает зависимые сервисы (auth, payments)",
    mitigation:
      "Окно запланировано в субботу 02:00 МСК, rollback-план провалидирован",
    stageNames: [STAGE_NAME_DEVOPS],
    severity: SEVERITY_AT_RISK,
  },
  {
    id: riskId(RISK_SEQ.wafFalsePositives),
    reportSectionId: sectionId(ACTIVE_SUFFIX, LEAD_SLOT_DMITRY),
    projectId: PRODUCT_SECURITY_GATEWAY,
    risk: "Тюнинг WAF может выдавать false positives на пиковой нагрузке",
    impact: "Часть клиентских запросов может блокироваться без причины",
    mitigation: "Раскатка через shadow-mode + кнопка мгновенного rollback",
    stageNames: [STAGE_NAME_SUPPORT],
    severity: SEVERITY_AT_RISK,
  },
  // Olga's Testing stage carries no explicit stageStatus, so
  // deriveEffectiveStageStatus shows its chip at-risk from this risk alone.
  {
    id: riskId(RISK_SEQ.testingEnvironment),
    reportSectionId: sectionId(ACTIVE_SUFFIX, LEAD_SLOT_OLGA),
    projectId: PRODUCT_PAYMENT_GATEWAY,
    risk: "Нестабильность Testing-окружения при нагрузочных прогонах",
    impact: "Задержка валидации релиза",
    mitigation:
      "Изолированный стенд для нагрузки запланирован на следующий спринт",
    stageNames: [STAGE_NAME_TESTING],
    severity: SEVERITY_AT_RISK,
  },
  // The covering blocker for Olga's DevOps item: that item is stored
  // `in_progress` and its blocked pill DERIVES from this risk.
  {
    id: riskId(RISK_SEQ.devOpsBlocked),
    reportSectionId: sectionId(ACTIVE_SUFFIX, LEAD_SLOT_OLGA),
    projectId: PRODUCT_PAYMENT_GATEWAY,
    risk: "Настройка DevOps-конвейера заблокирована ожиданием Dev-фикса",
    impact: "Блокирует выкатку Платёжного шлюза до устранения",
    mitigation:
      "Эскалировано команде Dev; ETA фикса — начало следующего спринта",
    stageNames: [STAGE_NAME_DEVOPS],
    severity: SEVERITY_BLOCKED,
  },
];

/** Seeds the active period's risks; returns the row count for the summary. */
export async function seedRisks(prisma: PrismaClient): Promise<number> {
  for (const { id, ...fields } of RISK_ROWS) {
    await prisma.risk.upsert({
      where: { id },
      update: fields,
      create: { id, ...fields },
    });
  }
  return RISK_ROWS.length;
}
