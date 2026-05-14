---
name: Grafana Observability Audit 2026-05-14
description: Результаты аудита Grafana/Prometheus стека после merge PR #4 (Phase 37)
type: project
---

# Grafana / Prometheus Audit — 2026-05-14

**Why:** Phase 37 (Observability) задеплоено в v8.0, но дашборды не проверялись с реальным трафиком.

## Состояние стека

```
┌─ Observability stack ─────────────────────┐
│ Prometheus   :9090  ✓ Healthy              │
│ Grafana      :3003  ✓ Healthy (v10.4.0)   │
│ postgres job        ✓ up=1                 │
│ redis job           ✓ up=1                 │
│ customreport-api    ✗ up=0  (API not up)   │
└───────────────────────────────────────────┘
```

**Примечание:** Grafana слушает на порту 3003 (переменная `GRAFANA_PORT`),
а не на стандартном 3000. Это важно — план и NEXT-ACTIONS ссылались на :3000.

## Дашборды (3 шт. — все загружены)

| Дашборд                                         | Папка        | Статус   |
| ----------------------------------------------- | ------------ | -------- |
| CustomReport — Operational Dashboard (skeleton) | CustomReport | загружен |
| CustomReport — tRPC Latency (DX-03)             | CustomReport | загружен |
| Product KPIs (product-telemetry-dashboard.json) | Product KPIs | загружен |

Provisioning работает: JSON-файлы из `deploy/grafana/*.json` монтируются
в Grafana через `deploy/grafana/provisioning/dashboards/`.

## Findings

### ✓ Работает

- Prometheus scraping postgres + redis — данные есть
- Grafana database=ok, dashboards provisioned через JSON
- OTel collector не проверялся (не в `docker ps` — возможно не настроен отдельно)

### ✗ Сломано / Нет данных

- **API не запущен** — `customreport-api up=0`. Все метрики HTTP/tRPC/BullMQ
  не поступают. Grafana показывает "No data" на большинстве панелей.
- **Порт в документации неверный** — план, NEXT-ACTIONS, README ссылаются
  на `:3000`, реальный порт `:3003`. Нужно синхронизировать.

### ⚠ Не проверено

- OTel collector (нет в `docker ps` — возможно встроен в api или disabled)
- Дашборды под трафиком (нужен запущенный API + seed + несколько login)
- Alert rules (не задавались в Phase 37 явно)

## TODO (для отдельной фазы — Phase 37-verify)

- [ ] Запустить API (`docker compose up api web`) и повторить проверку
- [ ] Обновить все ссылки `:3000` → `:3003` для Grafana в docs / RUNBOOK
- [ ] Проверить OTel collector — `deploy/otel-collector-config.yml` существует?
- [ ] Добавить тест что `/metrics` endpoint возвращает prometheus-формат

## How to apply

При работе с Grafana/observability — использовать порт `:3003`, не `:3000`.
Запуск: `docker compose -f docker-compose.observability.yml up -d`.
API должен быть запущен (`docker compose up api`) для реального трафика на дашбордах.
