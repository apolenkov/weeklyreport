// SMALL tier — Maria (co-owner), owning Testing on all three products plus
// Analysis/Design on BI. She is the ONE SUBMITTED lead so the head dashboard
// shows a Revoke affordance: all her contributions are `submitted`
// (seedActiveLeadSection submits the section only when EVERY contribution is).
// Submission is orthogonal to product health and to the Everyone-lens content,
// so it moves neither — she defines no worst status and cross-author content
// does not filter by section status. Vasily + Igor stay draft → the period
// stays `open` and a draft lead remains for the Remind demo.

import {
  ItemType,
  ItemWorkflowStatus,
  ReportSectionStatus,
  TrafficLightStatus,
} from "@prisma/client";

import { LEAD_MARIA_ID } from "../support/seed-constants.js";
import {
  MARIA_LABEL,
  PROD_BI,
  PROD_INTEGRATIONS,
  PROD_PORTAL,
  STAGE,
  TAG,
} from "./seed-demo.small-cast.js";
import type { DemoSection } from "./seed-demo.types.js";

const PORTAL_SECTION: DemoSection = {
  leadId: LEAD_MARIA_ID,
  leadLabel: MARIA_LABEL,
  productId: PROD_PORTAL,
  productLight: TrafficLightStatus.yellow,
  sectionStatus: ReportSectionStatus.submitted,
  ownedStages: [STAGE.testing],
  items: [
    {
      type: ItemType.current,
      text: "Прогон регрессии по сценариям входа портала, чиним флаки-тесты",
      tag: TAG.bugfix,
      status: ItemWorkflowStatus.in_progress,
      stages: [STAGE.testing],
    },
    {
      type: ItemType.next,
      text: "Автоматизировать регрессию входа портала в CI на следующей неделе",
      tag: TAG.bugfix,
      status: ItemWorkflowStatus.planned,
      stages: [STAGE.testing],
    },
  ],
  risk: {
    risk: "Нестабильные e2e-тесты входа маскируют реальные регрессии",
    impact: "Риск пропустить дефект авторизации в релиз",
    mitigation: "Карантин флаки-тестов и стабилизация окружения стенда",
    severity: "at-risk",
    stage: STAGE.testing,
  },
};

// Maria carries cross-author content on Integrations (an item + a decision) so
// the lead's "Everyone" visibility lens on Vasily's product shows co-owner
// records, not just own ones.
const INTEGRATIONS_SECTION: DemoSection = {
  leadId: LEAD_MARIA_ID,
  leadLabel: MARIA_LABEL,
  productId: PROD_INTEGRATIONS,
  productLight: TrafficLightStatus.green,
  sectionStatus: ReportSectionStatus.submitted,
  ownedStages: [STAGE.testing],
  items: [
    {
      type: ItemType.current,
      text: "Контрактные тесты REST-коннектора зелёные на стенде интеграций",
      tag: TAG.feature,
      status: ItemWorkflowStatus.in_progress,
      stages: [STAGE.testing],
    },
    {
      type: ItemType.next,
      text: "Подготовить нагрузочные тесты REST-коннектора к следующему спринту",
      tag: TAG.feature,
      status: ItemWorkflowStatus.planned,
      stages: [STAGE.testing],
    },
  ],
  decision: {
    text: "Принять контрактные тесты как gate перед боевой интеграцией",
    impact: "Ломающие изменения партнёрского API ловятся до релиза",
    stage: STAGE.testing,
  },
};

// Analysis/Design/Testing on BI is the broad staffing that makes BI read as a
// fully-owned green showcase (Support stays the one vacant role). All on-track;
// single-stage items keep the tier minimal.
const BI_SECTION: DemoSection = {
  leadId: LEAD_MARIA_ID,
  leadLabel: MARIA_LABEL,
  productId: PROD_BI,
  productLight: TrafficLightStatus.green,
  sectionStatus: ReportSectionStatus.submitted,
  ownedStages: [STAGE.analysis, STAGE.design, STAGE.testing],
  items: [
    {
      type: ItemType.current,
      text: "Согласовали аналитику и макеты экранов дашборда BI",
      tag: TAG.feature,
      // Done exemplar (second author) — green frame on the slide.
      status: ItemWorkflowStatus.done,
      stages: [STAGE.analysis],
    },
    {
      type: ItemType.next,
      text: "Прогнать приёмочные сценарии дашборда BI на следующей неделе",
      tag: TAG.bugfix,
      status: ItemWorkflowStatus.planned,
      stages: [STAGE.testing],
    },
  ],
};

export const MARIA_SECTIONS: DemoSection[] = [
  PORTAL_SECTION,
  INTEGRATIONS_SECTION,
  BI_SECTION,
];
