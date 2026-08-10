// SMALL tier — Vasily (primary lead), owning Development on each of his three
// products (+ Planning on BI).

import {
  ItemType,
  ItemWorkflowStatus,
  ReportSectionStatus,
  TrafficLightStatus,
} from "@prisma/client";

import { LEAD_1_ID } from "../support/seed-constants.js";
import {
  PROD_BI,
  PROD_INTEGRATIONS,
  PROD_PORTAL,
  STAGE,
  TAG,
  VASILY_LABEL,
} from "./seed-demo.small-cast.js";
import type { DemoSection } from "./seed-demo.types.js";

// Portal carries the BLOCKED item so the derived "Needs Attention" escalation
// banner has content to demonstrate.
const PORTAL_SECTION: DemoSection = {
  leadId: LEAD_1_ID,
  leadLabel: VASILY_LABEL,
  productId: PROD_PORTAL,
  productLight: TrafficLightStatus.yellow,
  sectionStatus: ReportSectionStatus.draft,
  ownedStages: [STAGE.development],
  items: [
    {
      type: ItemType.current,
      text: "Рефакторинг модуля авторизации заблокирован: ждём доступ к внешнему IdP",
      tag: TAG.feature,
      status: ItemWorkflowStatus.in_progress,
      stages: [STAGE.development],
      priorityRank: 1,
    },
    {
      type: ItemType.next,
      text: "Подключить вход через корпоративный IdP после выдачи доступа",
      tag: TAG.feature,
      status: ItemWorkflowStatus.planned,
      stages: [STAGE.development],
    },
  ],
  risk: {
    risk: "Доступ к внешнему IdP не выдан вовремя",
    impact: "Сдвиг релиза авторизации на одну неделю",
    mitigation: "Эскалация владельцу IdP, временный фолбэк на локальный вход",
    severity: "blocked",
    stage: STAGE.development,
  },
  decision: {
    text: "Зафиксировать переезд на новый IdP до конца месяца",
    impact: "Закрывает риск устаревшего OAuth-провайдера",
    stage: STAGE.development,
  },
};

// Integrations is the YELLOW example — an at-risk stage (below), never blocked.
const INTEGRATIONS_SECTION: DemoSection = {
  leadId: LEAD_1_ID,
  leadLabel: VASILY_LABEL,
  productId: PROD_INTEGRATIONS,
  productLight: TrafficLightStatus.yellow,
  sectionStatus: ReportSectionStatus.draft,
  ownedStages: [STAGE.development],
  items: [
    {
      type: ItemType.current,
      text: "Реализовали REST-коннектор для платформы интеграций",
      tag: TAG.feature,
      // Done exemplar: the small demo must show every status treatment.
      status: ItemWorkflowStatus.done,
      stages: [STAGE.development],
      priorityRank: 2,
    },
    {
      type: ItemType.next,
      text: "Покрыть коннектор контрактными тестами перед интеграцией",
      tag: TAG.feature,
      status: ItemWorkflowStatus.planned,
      stages: [STAGE.development],
    },
  ],
  risk: {
    risk: "Партнёр задерживает финальную версию API коннектора",
    impact: "Возможна переделка коннектора перед боевой интеграцией",
    mitigation: "Зафиксировать текущую версию API, заложить буфер на доработку",
    severity: "at-risk",
    stage: STAGE.development,
  },
  decision: {
    text: "Зафиксировать версию API партнёра для интеграции",
    impact: "Снижает риск ломающих изменений на их стороне",
    stage: STAGE.development,
  },
};

// BI is the internal product and the GREEN showcase. Vasily still owns EXACTLY
// TWO stages (Planning, Development). The rest are broadly staffed by co-owners
// — Maria on Analysis/Design/Testing, Igor on DevOps (all on-track) — EXCEPT
// Support, deliberately left unowned to show a vacant SDLC role. No risk covers
// BI, so its health resolves green.
const BI_SECTION: DemoSection = {
  leadId: LEAD_1_ID,
  leadLabel: VASILY_LABEL,
  productId: PROD_BI,
  productLight: TrafficLightStatus.green,
  sectionStatus: ReportSectionStatus.draft,
  ownedStages: [STAGE.planning, STAGE.development],
  items: [
    // The one MULTI-STAGE item in the small tier (durable spec
    // demo-seed-datasets "Small tier is minimal and stage-realistic"):
    // Item.stageNames spans Development + Testing — development and acceptance
    // testing run in parallel on this dashboard work, so the item legitimately
    // touches both phases. Portal/Integrations items stay single-stage.
    {
      type: ItemType.current,
      text: "Новый дашборд BI: разработка и приёмочное тестирование идут параллельно",
      tag: TAG.feature,
      status: ItemWorkflowStatus.in_progress,
      stages: [STAGE.development, STAGE.testing],
      priorityRank: 3,
    },
    {
      type: ItemType.next,
      text: "Спланировать целевые показатели следующего спринта дашборда BI",
      tag: TAG.infra,
      status: ItemWorkflowStatus.planned,
      stages: [STAGE.planning],
    },
  ],
  decision: {
    text: "Утвердить целевые SLA по времени отклика дашборда BI",
    impact: "Даёт измеримый порог приёмки для разработки",
    stage: STAGE.development,
  },
};

export const VASILY_SECTIONS: DemoSection[] = [
  PORTAL_SECTION,
  INTEGRATIONS_SECTION,
  BI_SECTION,
];
