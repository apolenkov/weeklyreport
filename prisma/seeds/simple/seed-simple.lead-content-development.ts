import { ItemWorkflowStatus } from "@prisma/client";

import {
  LEAD_1,
  LEAD_DMITRY,
  LEAD_IGOR,
  LEAD_MARIA,
} from "./seed-simple.ids.js";
import type { LeadContent } from "./seed-simple.leads.js";
import { ACTIVE_MONDAY, plusDaysUTC } from "./seed-simple.period.js";

// Demo decision deadlines, as day offsets from the active Monday.
const HIRING_DECISION_DAYS = 14;
const BUG_BASH_DAYS = 10;
const MAINTENANCE_WINDOW_DAYS = 5;

// Weekly narrative for the four technical leads in the Software Development group.
export const DEVELOPMENT_LEAD_CONTENT: Record<string, LeadContent> = {
  [LEAD_1]: {
    currentItems: [
      {
        text: "Завершил рефакторинг модуля авторизации в Маркетинговом портале",
        tag: "feature",
        status: ItemWorkflowStatus.in_progress,
      },
      {
        text: "Зафиксил 4 бага по интеграции SDK с CRM",
        tag: "bugfix",
        status: ItemWorkflowStatus.done,
      },
      {
        text: "Перенёс A/B тесты на новую инфраструктуру",
        tag: "infra",
        status: ItemWorkflowStatus.in_progress,
        carriedOver: true,
      },
      // Paused exemplar — the middle tier must show every Progress state.
      {
        text: "Миграция шаблонов писем на паузе: ждём финальный брендбук",
        tag: "feature",
        status: ItemWorkflowStatus.paused,
      },
    ],
    nextItems: [
      { text: "Запланировал ревью архитектуры с платформенной командой", tag: "ops" },
      { text: "Подготовка демо для квартального ревью", tag: "feature" },
      // Postponed exemplar — consciously pushed beyond this period.
      {
        text: "Апгрейд SDK статистики отложили до стабилизации API партнёра",
        tag: "infra",
        status: ItemWorkflowStatus.postponed,
      },
    ],
    risk: {
      risk: "Риск: внешний API контрагента нестабилен на пике трафика",
      impact: "Влияние: задержка релиза Q2 на одну неделю",
      mitigation:
        "Митигация: фолбэк через очередь повтора + эскалация партнёру",
      // The demo's blocked pill derives from THIS risk (no stored blocked
      // item status exists) — keep the severity explicit.
      severity: "blocked",
    },
    decisions: [
      {
        text: "Решение: переезд на новый IdP до конца месяца",
        impact: "Закрывает риск устаревшего OAuth-провайдера",
      },
      {
        text: "Решение: согласовать наём двух middle-разработчиков на Q3",
        impact: "Разгружает критический путь по интеграциям",
        deadline: plusDaysUTC(ACTIVE_MONDAY, HIRING_DECISION_DAYS),
      },
    ],
    priorities: [
      "Стабилизация production-релиза Маркетингового портала",
      "Ревью архитектуры с платформенной командой до пятницы",
      "Найм middle-разработчика (собеседования на этой неделе)",
    ],
  },
  [LEAD_MARIA]: {
    currentItems: [
      {
        text: "Закрыли 12 из 15 регресс-кейсов чекаута",
        tag: "feature",
        status: ItemWorkflowStatus.in_progress,
      },
      {
        text: "Подключили contract-тесты с провайдером платежей",
        tag: "infra",
        status: ItemWorkflowStatus.done,
      },
      {
        text: "Подготовили smoke-тесты для прода",
        tag: "ops",
        status: ItemWorkflowStatus.in_progress,
      },
    ],
    nextItems: [
      {
        text: "Сценарии валидации промокодов (включая edge-cases)",
        tag: "feature",
      },
      {
        text: "Тесты сохранности корзины при смене устройства",
        tag: "feature",
      },
    ],
    risk: {
      risk: "Риск: провайдер платежей выкатывает breaking changes без анонса",
      impact: "Влияние: возможные простои чекаута на 1-2 часа",
      mitigation: "Митигация: контракт-тесты в CI + фича-флаг для отката",
      severity: "at-risk",
    },
    decisions: [
      {
        text: "Решение: завести обязательный ночной прогон чекаута",
        impact: "Снижает риск регрессий в проде на ~70%",
      },
      {
        text: "Решение: согласовать выделенный bug-bash день перед релизом",
        impact: "Закрывает остаточные P2-баги до raise-the-floor",
        deadline: plusDaysUTC(ACTIVE_MONDAY, BUG_BASH_DAYS),
      },
    ],
    priorities: [
      "Подписать регресс-сьют (15 из 15 кейсов зелёных)",
      "Стабилизировать чекаут (закрыть последние 3 P2-бага)",
      "Завести контракт-тесты с провайдером платежей в CI",
    ],
  },
  [LEAD_IGOR]: {
    currentItems: [
      {
        text: "Тюнинг pool_size в PgBouncer: p99 latency упало на 22%",
        tag: "infra",
        status: ItemWorkflowStatus.done,
      },
      {
        text: "Подключили GPU autoscaling по custom metrics",
        tag: "infra",
        status: ItemWorkflowStatus.in_progress,
      },
      {
        text: "Обновили DR-runbook (multi-region failover checklist)",
        tag: "ops",
        status: ItemWorkflowStatus.done,
      },
    ],
    nextItems: [
      {
        text: "Dry-run multi-region failover (запланирован на четверг)",
        tag: "ops",
      },
      {
        text: "Финализировать ADR по миграции на новый shard-балансировщик",
        tag: "infra",
      },
    ],
    decisions: [
      {
        text: "Решение: утвердить maintenance-window для миграции PgBouncer (Сб 02:00 МСК)",
        impact: "Закрывает tech-debt по пулу соединений",
        deadline: plusDaysUTC(ACTIVE_MONDAY, MAINTENANCE_WINDOW_DAYS),
      },
      {
        text: "Решение: выделить бюджет на observability stack v2",
        impact: "Снижает MTTR инцидентов в DevOps на 30%",
      },
    ],
    priorities: [
      "Закатить новый pool_size PgBouncer на прод после dry-run",
      "Подтвердить GPU autoscaling на нагрузочном тесте",
      "Опубликовать обновлённый DR-runbook для дежурных",
    ],
  },
  [LEAD_DMITRY]: {
    currentItems: [
      {
        text: "Миграция CI/CD на GitHub Actions: 8 из 12 пайплайнов перенесены",
        tag: "infra",
        status: ItemWorkflowStatus.in_progress,
      },
      {
        text: "Интеграция security scanner в pre-merge (блокирует Critical/High)",
        tag: "infra",
        status: ItemWorkflowStatus.done,
      },
      {
        text: "Тюнинг WAF: ложных срабатываний минус 40%",
        tag: "ops",
        status: ItemWorkflowStatus.done,
      },
    ],
    nextItems: [
      {
        text: "Автоматизация ротации секретов (Vault transit-engine)",
        tag: "infra",
      },
      { text: "Оптимизация build-cache в Docker BuildKit", tag: "infra" },
    ],
    decisions: [
      {
        text: "Решение: дать зелёный свет фазовой раскатке WAF в shadow-mode",
        impact: "Снижает риск инцидентов на проде, безопасный rollback",
      },
      {
        text: "Решение: выделить SDET-инженера на покрытие security-сценариев",
        impact: "Закрывает гэп по автотестам безопасности до релиза",
      },
    ],
    priorities: [
      "Финализировать миграцию CI/CD на GitHub Actions",
      "Раскатать тюнинг WAF после shadow-mode валидации",
      "Автоматизировать ротацию секретов через Vault transit",
    ],
  },
};
