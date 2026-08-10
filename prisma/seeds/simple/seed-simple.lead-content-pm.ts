import { ItemWorkflowStatus } from "@prisma/client";

import {
  LEAD_CLOUD_PM,
  LEAD_DEVOPS_PM,
  LEAD_MOBILE_PM,
} from "./seed-simple.ids.js";
import type { LeadContent } from "./seed-simple.leads.js";
import { ACTIVE_MONDAY, plusDaysUTC } from "./seed-simple.period.js";

// Demo decision deadlines, as day offsets from the active Monday.
const AB_TEST_LAUNCH_DAYS = 10;
const BI_PILOT_LAUNCH_DAYS = 21;

// Weekly narrative for the three non-technical PM leads — Plan/Analysis focus,
// deliberately non-engineering vocabulary.
export const PM_LEAD_CONTENT: Record<string, LeadContent> = {
  [LEAD_MOBILE_PM]: {
    currentItems: [
      {
        text: "Разработала концепт нового onboarding-флоу для мобильного приложения",
        tag: "analysis",
        status: ItemWorkflowStatus.in_progress,
      },
      {
        text: "Провела интервью с 8 пользователями по болям чекаута",
        tag: "analysis",
        status: ItemWorkflowStatus.done,
      },
      {
        text: "Подготовила спецификацию для push-уведомлений",
        tag: "feature",
        status: ItemWorkflowStatus.done,
      },
    ],
    nextItems: [
      { text: "Прототип онбординга на Figma для A/B теста", tag: "analysis" },
      {
        text: "Составить acceptance-критерии для push-уведомлений",
        tag: "ops",
      },
    ],
    decisions: [
      {
        text: "Решение: запустить A/B тест нового онбординга на 10% аудитории",
        impact: "Данные для решения о полном переходе через 4 недели",
        deadline: plusDaysUTC(ACTIVE_MONDAY, AB_TEST_LAUNCH_DAYS),
      },
    ],
    priorities: [
      "Финализировать концепт онбординга и передать дизайнеру",
      "Согласовать acceptance-критерии push-уведомлений с командой",
      "Запуск A/B теста онбординга в течение двух недель",
    ],
  },
  [LEAD_CLOUD_PM]: {
    currentItems: [
      {
        text: "Документировала архитектуру data governance для внутреннего BI",
        tag: "analysis",
        status: ItemWorkflowStatus.in_progress,
      },
      {
        text: "Согласовала требования к дашборду с 3 аналитическими командами",
        tag: "analysis",
        status: ItemWorkflowStatus.done,
      },
      {
        text: "Подготовила roadmap перехода на self-service BI",
        tag: "ops",
        status: ItemWorkflowStatus.done,
      },
    ],
    nextItems: [
      {
        text: "Валидация data model с командой Data Engineering",
        tag: "analysis",
      },
      {
        text: "Прототип нового дашборда для пилота с аналитиками",
        tag: "analysis",
      },
    ],
    decisions: [
      {
        text: "Решение: запустить пилот self-service BI с аналитической командой маркетинга",
        impact: "Снижает нагрузку на DE-команду на 30%",
        deadline: plusDaysUTC(ACTIVE_MONDAY, BI_PILOT_LAUNCH_DAYS),
      },
    ],
    priorities: [
      "Финализировать data governance документацию",
      "Запустить пилот self-service BI с маркетинговой командой",
      "Валидация data model готова до начала разработки",
    ],
  },
  [LEAD_DEVOPS_PM]: {
    currentItems: [
      {
        text: "Согласовала стандарты документирования infrastructure-as-code",
        tag: "ops",
        status: ItemWorkflowStatus.done,
      },
      {
        text: "Провела анализ инцидентов Q2 и подготовила action plan",
        tag: "analysis",
        status: ItemWorkflowStatus.in_progress,
      },
      {
        text: "Актуализировала SLA-соглашения со смежными командами",
        tag: "ops",
        status: ItemWorkflowStatus.done,
      },
    ],
    nextItems: [
      {
        text: "Presentation action plan по инцидентам Q2 для CTO",
        tag: "ops",
      },
      {
        text: "Составить план обучения по IaC-практикам для команды",
        tag: "ops",
      },
    ],
    decisions: [
      {
        text: "Решение: внедрить runbook-driven incident response для all P1/P2",
        impact: "Снижает MTTR на 40% за счёт стандартизации response",
      },
    ],
    priorities: [
      "Завершить action plan по инцидентам Q2",
      "Внедрить runbook-driven incident response",
      "Обучение команды по IaC-стандартам",
    ],
  },
};
