// SMALL tier — Igor (co-owner), owning DevOps on all three products. Order
// matters: BI first, then Portal, then Integrations (see SMALL_SECTIONS).

import {
  ItemType,
  ItemWorkflowStatus,
  ReportSectionStatus,
  TrafficLightStatus,
} from "@prisma/client";

import { LEAD_IGOR_ID } from "./seed-constants.js";
import {
  IGOR_LABEL,
  PROD_BI,
  PROD_INTEGRATIONS,
  PROD_PORTAL,
  STAGE,
  TAG,
} from "./seed-demo.small-cast.js";
import type { DemoSection } from "./seed-demo.types.js";

// BI is the green showcase — Igor's DevOps is on-track here (the cluster
// blocker lives on the Portal, below).
const BI_SECTION: DemoSection = {
  leadId: LEAD_IGOR_ID,
  leadLabel: IGOR_LABEL,
  productId: PROD_BI,
  productLight: TrafficLightStatus.green,
  sectionStatus: ReportSectionStatus.draft,
  ownedStages: [STAGE.devops],
  items: [
    {
      type: ItemType.current,
      text: "Прод-стенд дашборда BI развёрнут, мониторинг кластера настроен",
      tag: TAG.infra,
      status: ItemWorkflowStatus.in_progress,
      stages: [STAGE.devops],
    },
    {
      type: ItemType.next,
      text: "Автоматизировать выкладку дашборда BI через CI/CD пайплайн",
      tag: TAG.infra,
      status: ItemWorkflowStatus.planned,
      stages: [STAGE.devops],
    },
  ],
  // Cross-author decision on Vasily's BI product, surfaced in his "Everyone"
  // visibility lens.
  decision: {
    text: "Закрепить регламент мониторинга кластера дашборда BI",
    impact: "Фиксирует SLA эксплуатации после выхода в прод",
    stage: STAGE.devops,
  },
};

// The cluster blocker lives on the Portal — a FOREIGN-owned blocked stage, so
// Vasily sees his co-owned Portal go red on a stage he does not own (Product
// context demo), while BI stays green.
const PORTAL_SECTION: DemoSection = {
  leadId: LEAD_IGOR_ID,
  leadLabel: IGOR_LABEL,
  productId: PROD_PORTAL,
  productLight: TrafficLightStatus.red,
  sectionStatus: ReportSectionStatus.draft,
  ownedStages: [STAGE.devops],
  items: [
    {
      type: ItemType.current,
      text: "Деплой портала заблокирован: не выделены мощности кластера",
      tag: TAG.infra,
      status: ItemWorkflowStatus.in_progress,
      stages: [STAGE.devops],
    },
    {
      type: ItemType.next,
      text: "Настроить мониторинг кластера портала после выделения ресурсов",
      tag: TAG.infra,
      status: ItemWorkflowStatus.planned,
      stages: [STAGE.devops],
    },
  ],
  risk: {
    risk: "Нет выделенных мощностей кластера под прод-стенд портала",
    impact: "Релиз портала сдвигается до выделения ресурсов",
    mitigation: "Заявка в инфраструктуру, временный деплой на общий стенд",
    severity: "blocked",
    stage: STAGE.devops,
  },
};

const INTEGRATIONS_SECTION: DemoSection = {
  leadId: LEAD_IGOR_ID,
  leadLabel: IGOR_LABEL,
  productId: PROD_INTEGRATIONS,
  productLight: TrafficLightStatus.green,
  sectionStatus: ReportSectionStatus.draft,
  ownedStages: [STAGE.devops],
  items: [
    {
      // Status exemplar: PAUSED — the small tier must show every current-item
      // status treatment, including work paused mid-stream.
      type: ItemType.current,
      text: "Развёртывание стенда интеграций приостановлено: ждём окно на общем кластере",
      tag: TAG.infra,
      status: ItemWorkflowStatus.paused,
      stages: [STAGE.devops],
    },
    {
      // Status exemplar: POSTPONED — the small tier must show every next-item
      // status treatment, including planned work pushed out.
      type: ItemType.next,
      text: "Автоматизировать выкладку коннектора через CI/CD пайплайн",
      tag: TAG.infra,
      status: ItemWorkflowStatus.postponed,
      stages: [STAGE.devops],
    },
  ],
};

export const IGOR_SECTIONS: DemoSection[] = [
  BI_SECTION,
  PORTAL_SECTION,
  INTEGRATIONS_SECTION,
];
