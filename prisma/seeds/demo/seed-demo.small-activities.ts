// Small-tier Project Activities: the base demo must show the by-product slide
// with project subsections out of the box. Three activities on Vasily's
// products — two carrying a full record set, one status-only with a single
// item — so both render paths (records + bare header row) are visible without
// extra seeding.

import {
  ItemType,
  ItemWorkflowStatus,
  TrafficLightStatus,
} from "@prisma/client";

import { PROD_BI, PROD_PORTAL, TAG } from "./seed-demo.small-cast.js";

interface ActivityItem {
  type: ItemType;
  text: string;
  tag: string;
  status: ItemWorkflowStatus;
}

interface ActivityRisk {
  risk: string;
  impact: string;
  mitigation: string;
  severity: "blocked" | "at-risk";
}

interface ActivityDecision {
  text: string;
  impact: string;
}

export interface ActivityContent {
  items: ActivityItem[];
  risk?: ActivityRisk;
  decision?: ActivityDecision;
}

interface DemoActivity {
  name: string;
  productId: string;
  status: TrafficLightStatus;
  note?: string;
  content: ActivityContent;
}

export const SMALL_ACTIVITIES: readonly DemoActivity[] = [
  {
    name: "Исследование новых интеграций",
    productId: PROD_PORTAL,
    status: TrafficLightStatus.yellow,
    note: "Партнёр задерживает доступ к API",
    // A full set (current + next item, risk, decision) so the slide shows a
    // fully-populated activity row.
    content: {
      items: [
        {
          type: ItemType.current,
          text: "Составили шорт-лист интеграций для пилота",
          tag: TAG.research,
          status: ItemWorkflowStatus.in_progress,
        },
        {
          type: ItemType.next,
          text: "Согласовать пилотных партнёров для новых интеграций",
          tag: TAG.research,
          status: ItemWorkflowStatus.planned,
        },
      ],
      risk: {
        risk: "Партнёр задерживает доступ к API для пилотной интеграции",
        impact: "Сдвиг сроков пилота новых интеграций",
        mitigation: "Эскалация владельцу API, поиск альтернативного партнёра",
        severity: "at-risk",
      },
      decision: {
        text: "Зафиксировать шорт-лист партнёров для пилота интеграций",
        impact: "Даёт чёткий периметр для оценки следующего этапа",
      },
    },
  },
  {
    name: "Поддержка и сопровождение",
    productId: PROD_PORTAL,
    status: TrafficLightStatus.green,
    // Status-only header row with a single live record — no next item, risk or
    // decision.
    content: {
      items: [
        {
          type: ItemType.current,
          text: "Обработали текущие обращения пользователей портала",
          tag: TAG.ops,
          status: ItemWorkflowStatus.in_progress,
        },
      ],
    },
  },
  {
    name: "Технический долг и рефакторинг",
    productId: PROD_BI,
    status: TrafficLightStatus.yellow,
    content: {
      items: [
        {
          type: ItemType.current,
          text: "Выделили модуль форматирования отчётов BI в общую библиотеку",
          tag: TAG.techDebt,
          status: ItemWorkflowStatus.in_progress,
        },
        {
          type: ItemType.next,
          text: "Спланировать рефакторинг слоя доступа к данным BI",
          tag: TAG.techDebt,
          status: ItemWorkflowStatus.planned,
        },
      ],
      risk: {
        risk: "Накопленный технический долг замедляет доработки дашборда BI",
        impact: "Растущее время на каждую следующую фичу BI",
        mitigation: "Выделить фиксированную долю спринта под рефакторинг",
        severity: "at-risk",
      },
      decision: {
        text: "Выделять 20% спринта под технический долг BI до конца квартала",
        impact: "Останавливает рост технического долга дашборда BI",
      },
    },
  },
];
