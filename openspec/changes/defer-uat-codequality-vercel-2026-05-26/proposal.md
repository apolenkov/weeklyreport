# Deferred: Live UAT + Code-Quality + Vercel

## Problem

Следующий шаг после инвентаризации — полный live-прогон приложения и
code-quality чистка. Это большая работа, которую откладываем до явного «вперёд».

## What's inside

**Wave 1 — Fresh dev server + UAT-свип 4 ролей:**

Запустить свежий dev-сервер (`pnpm dev:fresh`), войти под каждой ролью
через `/auth/dev-login?role=ROLE`, прокликать все экраны через Playwright MCP.
Записать все найденные баги в отдельные openspec changes.

**Wave 2 — Фиксы найденных багов:**

Каждый найденный баг — отдельный openspec change + исправление.

**Wave 3 — Code-quality агенты:**

- `code-simplifier` — убрать лишний код
- `code-modernization` — привести к актуальным паттернам
- `code review` — пройтись по затронутому коду
- ESLint/Prettier до текущих стандартов
- Подтянуть зависимости

Скиллы-эксперты Wave 3 (параллельный запуск):

- `/typescript-expert` — TypeScript строгость, типы, дженерики
- `/typescript-pro` — TypeScript advanced patterns
- `/nestjs-expert` — NestJS модули, DI, guards, interceptors
- `/react-best-practices` — React паттерны, хуки, производительность
- `/postgres-pro` — запросы, индексы, схема
- `/postgresql-optimization` — медленные запросы, планы выполнения
- `/observability-engineer` — логирование, метрики, трейсинг
- `/docker-expert` — Dockerfile, compose, слои образов

**Wave 4 — Vercel best-practices + UI/UX аудит:**

Запустить Vercel best-practice skill: производительность, Core Web Vitals,
Next.js 16 конвенции.

Скиллы-эксперты Wave 4 (параллельный запуск):

- `/ui-ux-pro-max` — UI/UX аудит, доступность, иерархия
- `/slides` — слайд-дека (StatusSlideDeck, SummarySlide, DecisionSlide)
- `/react-view-transitions` — анимации, View Transitions API
- `/frontend-design` — визуальный дизайн, токены, типографика

**Wave 5 — Финальные гейты + re-sweep:**

`pnpm typecheck && pnpm lint && pnpm test && pnpm lint:md` — все зелёные.
Повторный Playwright-свип: 0 console-ошибок по всем ролям.

## Wave 1 split

Wave 1-light выделена в отдельный change `uat-feedback-2026-05-26`
(feedback only, без фиксов, 2026-05-26). Wave 2–5 ждут следующей сессии.

## Start condition

Начать по явному «вперёд» от пользователя.

## Child changes (planned 2026-05-29)

Waves 3/5 + Biome + dep-upgrades разложены на отдельные openspec changes
(plan only, код не тронут; grill-with-docs + планирующий workflow):

- `migrate-to-biome` — Wave 3 фундамент (ESLint+Prettier → Biome, hybrid;
  markdownlint остаётся). Лендится первым на integration-ветке.
- `code-quality-modernization` — Wave 3 dead-code/simplify/структурные рефакторы
  (HOT ZONE report-period под characterization-тестами).
- `dependency-upgrades-minor` — Wave 3 батч minor/patch (21 пакет).
- `upgrade-*-major` (×9) — изолированные major-бампы: typescript, types-node,
  jsdom, lucide-react, types-cookie, react-email-components, bull-board-api,
  bull-board-express, vitejs-plugin-react.
- `final-gates-resweep` — Wave 5 финальный гейт (5 команд) + re-sweep 4 ролей.
- `ui-ux-vercel-audit-research` — Wave 4 RESEARCH-ONLY (аудит-мемо, без кода).

Wave 2 (фиксы UAT-багов) спекается после live-свипа — ещё не запущен.

## Grill findings — 2026-05-30

Adversarial review of the explorer's plan. English on purpose (planning doc;
the repo i18n rule is production-UI-only).

### Corrected state

- **Biome HAS landed.** The explorer claimed "migrate-to-biome (active, not yet
  landed)" and "none have landed yet". False. `4d7ad5e7` (migrate to Biome,
  hybrid) and `b85cb0a1` (clear format/organizeImports debt) are in `main`;
  `biome.json` is live (v2.4.16, `recommended: false`); `package.json` `lint`
  already runs `biome check . && eslint .`. CLAUDE.md documents this as fact.
  → The `migrate-to-biome` child is **done-in-reality**; its `tasks.md` 0/21 is
  stale bookkeeping. Recommended action for that child: **archive**, not
  implement. This does not change the parent's fate.
- **Parent currentState: `partial`, not `not-started`.** Wave 1-light is
  archived (`uat-feedback-2026-05-26`) and the Wave-3 Biome foundation has
  landed. Trusting the parent's 0/5 checkboxes repeats the same error.

### The real diff-scale item the explorer missed

- The explorer justified "gates insufficient" with Wave 1 Playwright. The
  genuine gates-insufficient change is **`enable-biome-recommended-ruleset`**
  (explorer omitted it entirely from the change inventory). It flips
  `recommended: false → true` in one big-bang landing commit: ~535 findings,
  ≤429 safe-autofix via `biome check --write`, ~94 a11y fixes applied by hand.
  A green gate at the end does NOT prove that commit safe — it needs
  **diff-scale human review**. gatesSufficient stays **No**, for this reason.

### markdown-format-only (probed explicitly)

- It switches Markdown ownership markdownlint-cli2 → Prettier, removes the
  `lint:md`/`lint:md:fix` scripts and the `markdownlint-cli2` dep from
  `package.json`. **No logical dependsOn the Biome trio** — Markdown was never
  Biome-owned and Prettier already owns YAML. But it **collides on
  `package.json`** with every dep-upgrade and with the recommended flip:
  sharedFile contention, not a dependency edge.

### Shared-file / parallel-execution contention (confirmed)

- All 9 `upgrade-*-major` changes + `dependency-upgrades-minor` edit
  `package.json` + `pnpm-lock.yaml`. They **serialize on the lockfile** — cannot
  run as parallel git worktrees. `enable-biome-recommended-ruleset` and
  `code-quality-modernization` add `biome.json`/`eslint.config.ts` contention.
  `markdown-format-only` adds `package.json` contention.

### Scope note on filesTouched

- The explorer's `filesTouched`/`sharedFiles` is the **union of all child
  changes**, not files this parent edits. The parent itself touches only its own
  openspec artifacts (`proposal.md`, `tasks.md`, `specs/uat-quality-gates/`).

### Surviving recommendation

- **Parent = `defer`** (unchanged): start-condition is an explicit user
  go-ahead; Waves 2 and 5 depend on a live UAT sweep that has not run. Verdict
  **needs-revision** (tree is sound; the explorer's analysis was stale, not the
  plan).
- Child actions live as findings, not the parent's recommendation: archive
  `migrate-to-biome`; treat `enable-biome-recommended-ruleset` as the
  diff-scale-review gate item.

## Status note — 2026-06-10

Parent stays **deferred** (start condition unchanged: an explicit user
go-ahead for this change specifically). Two facts have drifted since the
2026-05-30 grill findings and need re-scoping before any wave executes:

- The lint stack reversed again: Biome was **removed** in Phase 1 of
  `migrate-lint-to-eslint-prettier` (mainstream ESLint + Prettier + stylelint;
  see CLAUDE.md "Commands"). Every Biome-referencing child item above
  (`migrate-to-biome`, `enable-biome-recommended-ruleset`, the Biome-based
  Wave 3 framing) is historical context now, not an executable plan.
- Wave 5's gate list cites `pnpm lint:md`, which no longer exists
  (markdownlint was removed; Prettier formats Markdown).

Recommended first action when picked up: re-scope Waves 3–5 against the
current toolchain.
