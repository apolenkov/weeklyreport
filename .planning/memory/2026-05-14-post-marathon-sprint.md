---
name: Post-marathon sprint 2026-05-14
description: Sprint recap: CI baseline, markdownlint, .planning/ consolidation, GSD alignment
type: project
date: 2026-05-14
---

# Post-marathon Sprint — 2026-05-14

After merge of PR #4 (night marathon), closed remaining HOT + CI + hygiene debt.

## Закрыто за спринт

**Wave 1 — CI baseline + HOT closure:**

- `.github/workflows/ci.yml` создан с 6 jobs: lint-md, quality, e2e, migrate-reset,
  visual-baseline, docker-build. Action versions актуальные для 2026-05-14
  (checkout@v6, setup-node@v6, pnpm/action-setup@v6, upload-artifact@v7).
- Playwright spec `e2e/regression-uat-v7.spec.ts` дополнен тестами D-0/H-1
  (wipe-manual-uat).
- Phase 16/17 product-ready gates закрыты в STATE.md.
- 260426-vxp resolved → `.planning/quick/260426-vxp-*/RESOLUTION.md`.

**Wave 2 — Research + Monitoring:**

- Grafana audit: :3003 (не :3000!), Prometheus healthy, API metrics down при
  изолированном запуске. Memo: `.planning/memory/2026-05-14-grafana-audit.md`.
- Turbopack: уже adopted в Phase 39 — decision documented, нет нужды повторять.
  Memo: `.planning/memory/2026-05-14-turbopack-decision.md`.
- Background research: скриншоты ключевых страниц 4 ролей, frozen-contract
  «никаких UI-правок без user sign-off». Memo:
  `.planning/memory/2026-05-14-background-research.md`.

**Wave 3 — Markdownlint + .planning/ consolidation + GSD alignment:**

- `markdownlint-cli2` ^0.22.1 установлен, `lint:md` / `lint:md:fix` скрипты.
  `.markdownlint.json` отключает pre-existing-violation правила.
  `pnpm lint:md` → 0 errors на 572 файлах.
- lint-md job добавлен в CI (Job 0).
- lint-staged: `*.md` → `markdownlint-cli2 --fix` после `prettier`.
- Root очищен: все .md (кроме README.md, CLAUDE.md, AGENTS.md) перенесены
  в `.planning/` или `.planning/local-archive/`.
  UAT-SCENARIO/ → `.planning/UAT-SCENARIO/`.
- `.planning/local-archive/INDEX.md` — 15 заархивированных файлов.
- `tools/handoff-sync.ts` обновлён: пути → `.planning/HANDOFF.md` +
  `.planning/CHECKLIST.md`. `pnpm gsd:checklist:sync` → exit 0.
- STATE.md `progress.percent: 100` исправлен на `88` (36/41).
- `.planning/phases/40-*/41-*/42-*/CONTEXT.md` созданы с GSD frontmatter.

## Осталось / Parked

- **Phase 40 B2B Rebrand** — parked до user sign-off по research memo.
- **Phase 41 AI Eval** — parked до боевого API-ключа.
- **Phase 42 iOS Safari** — parked до реального устройства.
- **PR #5** — нужно открыть и дождаться CI green.
- **Next milestone choice** — Phase 44 / 46 / 47 / 50 / 54.

## Why: что было ключевым

Главное в этом спринте — создать «инфраструктуру качества» для будущих фаз:
CI gate предотвращает прорыв без тестов; markdownlint держит .planning/ чистым;
`.planning/` консолидация убирает хаос из root. Без этого каждый следующий PR
мог проскочить как PR #4 — без CI, без документального порядка.

**How to apply:** В следующих сессиях: все PR merge-ятся через CI green;
все .md файлы живут в `.planning/`; `pnpm gsd:checklist:sync` запускать
перед wave closure.
