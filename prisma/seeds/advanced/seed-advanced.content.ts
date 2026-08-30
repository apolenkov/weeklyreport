// Russian-language demo content for the active period: what each lead did, what
// they plan next, and what they want from the head. Product context comes from
// the row's projectId relation, so the texts never repeat the product name.

import {
  LEAD_1_ID,
  LEAD_DMITRY_ID,
  LEAD_IGOR_ID,
  LEAD_MARIA_ID,
  LEAD_OLGA_ID,
  LEAD_SERGEY_ID,
} from "../support/seed-constants.js";

export interface LeadContent {
  readonly current: readonly string[];
  readonly next: readonly string[];
  readonly priorities: readonly string[];
}

const CONTENT_BY_LEAD: Readonly<Record<string, LeadContent>> = {
  [LEAD_1_ID]: {
    current: [
      "Закрыли модуль авторизации — JWT + refresh-token",
      "Подключили OAuth2 партнёрского API, ждём подтверждения от партнёра",
      "Оптимизировали поиск клиентов: p99 query 850ms → 180ms",
      "Webhook retry с экспоненциальным backoff, dead-letter в Redis",
    ],
    next: [
      "Интеграция SSO с порталом клиента (на стороне Ольги)",
      "Раскатка A/B-тестинг фреймворка",
    ],
    priorities: [
      "Закрыть OAuth2 интеграцию (партнёр снял rate-limit)",
      "Передать SSO flow смежной команде к четвергу",
      "Выкатить MVP дашборда на staging",
    ],
  },
  [LEAD_MARIA_ID]: {
    current: [
      "QA транзакционного флоу — закрыли 12 из 15 кейсов",
      "Регресс-сьют чекаута, добавили smoke-тесты для прода",
      "Contract-тесты с провайдером платежей, нашли 2 расхождения по схеме",
    ],
    next: [
      "Сценарии валидации промокодов (включая edge-cases с истечением)",
      "Тесты сохранности корзины при смене устройства",
    ],
    priorities: [
      "Подписать регресс-сьют (15/15 кейсов зелёных)",
      "Стабилизировать чекаут — закрыть последние 3 P2-бага",
      "Завести контракт-тесты с провайдером платежей в CI",
    ],
  },
  [LEAD_IGOR_ID]: {
    current: [
      "Тюнинг pool_size в PgBouncer: 40 → 80, p99 latency упало на 22%",
      "GPU autoscaling на базе HPA + custom metrics",
      "Обновили DR-runbook: добавили checklist для multi-region failover",
    ],
    next: ["Dry-run multi-region failover (запланирован на четверг 15:00)"],
    priorities: [
      "Закатить новый pool_size PgBouncer на прод после dry-run",
      "Подтвердить GPU autoscaling на нагрузочном тесте",
      "Опубликовать обновлённый DR-runbook для дежурных",
    ],
  },
  [LEAD_DMITRY_ID]: {
    current: [
      "Миграция CI/CD на GitHub Actions: 8 из 12 пайплайнов уже там",
      "Интеграция security scanner в pre-merge — блокирует Critical/High",
      "Тюнинг WAF-правил, ложных срабатываний −40%",
      "Baseline-скан уязвимостей контейнеров, отчёт собран по 17 образам",
    ],
    next: [
      "Автоматизация ротации секретов (Vault transit-engine)",
      "Оптимизация build-cache в Docker BuildKit",
    ],
    priorities: [
      "Финализировать миграцию CI/CD на GitHub Actions (4 пайплайна осталось)",
      "Раскатать тюнинг WAF после shadow-mode валидации",
      "Автоматизировать ротацию секретов через Vault transit",
    ],
  },
  [LEAD_OLGA_ID]: {
    current: [
      "Закрыли интеграцию 3DS v2 — пилот на 5% трафика",
      "Перевели на короткие сессии (refresh-токен 24 ч)",
      "Починили двойное списание при timeout — добавили idempotency-key через Redis",
    ],
    next: [
      "Подключить СБП-эквайринг (sandbox-ключи ожидаются 8 мая)",
      "Biometric-вход — закрыть acceptance с UX",
    ],
    priorities: [
      "Стабилизация 3DS v2 на проде (закрыть L2-инциденты)",
      "Раскатка СБП-эквайринга на 100% трафика после получения ключей",
      "Согласовать финальный план PCI DSS аудита с безопасниками",
    ],
  },
  [LEAD_SERGEY_ID]: { current: [], next: [], priorities: [] },
};

/** Demo content for a seeded lead; unknown ids are a seed-authoring mistake. */
export function contentFor(leadId: string): LeadContent {
  const content = CONTENT_BY_LEAD[leadId];
  if (content === undefined) {
    throw new Error(`Product seed: no demo content for lead ${leadId}`);
  }
  return content;
}
