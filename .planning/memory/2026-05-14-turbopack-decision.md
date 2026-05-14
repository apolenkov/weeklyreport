---
name: Turbopack Decision 2026-05-14
description: Turbopack уже adopted в Phase 39 — next.config.ts подтверждён
type: project
---

# Turbopack Decision — 2026-05-14

**Why:** Sprint-план предусматривал измерение и принятие решения по Turbopack.
При аудите обнаружено, что решение уже принято в Phase 39 (Performance).

## Verdict: ADOPTED (Phase 39, до 2026-05-14)

```
apps/web/next.config.ts, строки 20-22:
  turbopack: {
    root: resolve(__dirname, "../.."),
  },
```

Turbopack включён в `next.config.ts` нативно (Next.js 16). Конфиг указывает
на корень монорепо, что корректно для Turborepo setup.

## Что не нужно делать

- ~~Измерять baseline Webpack vs Turbopack~~ — решение принято.
- ~~Создавать отдельный PR~~ — уже в основной ветке.
- ~~Писать «может ли сломать что-то»~~ — Phase 39 покрыл это.

## What to apply

- Turbopack активен в dev-режиме. `pnpm --filter @customreport/web dev` стартует с Turbopack.
- Если в будущих сессиях будут жалобы на hot-reload или несовместимость плагинов —
  можно временно отключить, убрав секцию `turbopack:` из next.config.ts.
- Текущие E2E и unit тесты работают не через Turbopack (они используют отдельную
  конфигурацию через `NEXT_DIST_DIR`).
