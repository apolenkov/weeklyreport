import { ItemWorkflowStatus } from "@prisma/client";

import { LEAD_OLGA, LEAD_SERGEY } from "./seed-simple.ids.js";
import type { LeadContent } from "./seed-simple.leads.js";
import { ACTIVE_MONDAY, plusDaysUTC } from "./seed-simple.period.js";

// Demo decision deadline, as a day offset from the active Monday.
const THREE_DS_ROLLOUT_DAYS = 14;

// Weekly narrative for the two leads in the Finance reporting group.
export const FINANCE_LEAD_CONTENT: Record<string, LeadContent> = {
  [LEAD_OLGA]: {
    currentItems: [
      {
        text: "Закрыли интеграцию 3DS v2 — пилот на 5% трафика",
        tag: "feature",
        status: ItemWorkflowStatus.in_progress,
      },
      {
        text: "Перевели аутентификацию на короткие сессии (refresh 24 ч)",
        tag: "feature",
        status: ItemWorkflowStatus.done,
      },
      {
        text: "Починили двойное списание при timeout (idempotency-key через Redis)",
        tag: "bugfix",
        status: ItemWorkflowStatus.done,
      },
    ],
    nextItems: [
      {
        text: "Подключить СБП-эквайринг (sandbox-ключи ожидаются 8 числа)",
        tag: "feature",
      },
      {
        text: "Biometric-вход — закрыть acceptance-критерии с UX",
        tag: "feature",
      },
    ],
    risk: {
      risk: "Риск: задержка ключей СБП-эквайринга от партнёра",
      impact: "Влияние: сдвиг релиза мобильного приложения на одну неделю",
      mitigation:
        "Митигация: ежедневный sync с менеджером партнёра, готов фолбэк-флоу",
      severity: "at-risk",
    },
    decisions: [
      {
        text: "Решение: раскатать 3DS v2 на 100% трафика после стабилизации",
        impact: "Закрывает требование PSD2 для платёжного шлюза",
        deadline: plusDaysUTC(ACTIVE_MONDAY, THREE_DS_ROLLOUT_DAYS),
      },
      {
        text: "Решение: согласовать UX-сценарий восстановления при отмене 3DS",
        impact: "Снижает abandonment-rate на чекауте",
      },
    ],
    priorities: [
      "Стабилизация 3DS v2 на проде (закрыть L2-инциденты)",
      "Раскатка СБП-эквайринга на 100% трафика после получения ключей",
      "Завести нагрузочный тест платёжного шлюза в CI",
    ],
  },
  [LEAD_SERGEY]: {
    currentItems: [
      {
        text: "Закатили обновлённую модель прав доступа в HR-системе",
        tag: "feature",
        status: ItemWorkflowStatus.done,
      },
      {
        text: "Перенесли отчёты по найму на новый BI-движок",
        tag: "feature",
        status: ItemWorkflowStatus.in_progress,
      },
      {
        text: "Починили баги по экспорту в Excel (3 тикета закрыты)",
        tag: "bugfix",
        status: ItemWorkflowStatus.done,
      },
    ],
    nextItems: [
      {
        text: "Подготовить демо HR-аналитики для совета директоров",
        tag: "feature",
      },
      {
        text: "Согласовать новый календарь периодов оценки сотрудников",
        tag: "ops",
      },
    ],
    decisions: [
      {
        text: "Решение: выделить slot на интеграцию с корпоративным SSO для HR",
        impact: "Снижает onboarding-трение для новых сотрудников",
      },
      {
        text: "Решение: согласовать архитектуру модуля 360-feedback",
        impact: "Закрывает roadmap-цель Q3 по HR-аналитике",
      },
    ],
    priorities: [
      "Демо HR-аналитики для совета директоров",
      "Интеграция с корпоративным SSO для HR-системы",
      "Архитектура модуля 360-feedback",
    ],
  },
};
