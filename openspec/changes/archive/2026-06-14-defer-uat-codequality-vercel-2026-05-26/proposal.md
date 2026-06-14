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

## Decomposition + narrow — 2026-06-14

User decision was "decompose and narrow"; the advisor ratified an
artifacts-only pass (NO source edits — a code-quality run here would repeat the
known parallel-army-refactor revert-bait hazard). This section records the true
state of every wave verified against the live tree and the archive, so this
umbrella tracker stops carrying stale 0/5 bookkeeping.

This change stays **ACTIVE** as the umbrella tracker. It is NOT archived: it is
the durable record of how the deferred UAT/code-quality/Vercel track was split
and disposed.

### Waves 1–2 — COVERED by the AI-UI-driver runs

Wave 1 (fresh-dev UAT sweep of the 4 roles) and Wave 2 (fix the bugs that sweep
finds) are no longer open work. The 2026-06-11 / 2026-06-13 `ai-ui-driver` runs
drove lead / head / viewer through the live app, found the in-app flow/logic
bugs, and packaged them into `driver-findings-2026-06-11`, which is now
**implemented and archived** (`archive/2026-06-14-driver-findings-2026-06-11`).
The static catalog sweep half of Wave 1 also runs automatically via `pnpm
test:uat` (route-load + axe across roles; see `e2e/sweep/`), recorded by the
archived `final-gates-resweep` change.

### `migrate-to-biome` child — OBSOLETE (reversed direction)

The original plan made `migrate-to-biome` the Wave 3 foundation. That direction
was reversed: **Biome was removed**, and the repo standardized on the
mainstream **ESLint + Prettier + stylelint** trio (Phase 1 of
`migrate-lint-to-eslint-prettier`; see CLAUDE.md "Lint stack"). There is
`biome.json` no longer in the tree. The `migrate-to-biome` child is therefore
obsolete as a forward plan; it is already archived as done-in-reality
(`archive/2026-05-30-migrate-to-biome`, per commit `a17ddd4a`) and needs no
revival. There is no live `openspec/changes/migrate-to-biome` directory to
annotate. The companion Biome item `enable-biome-recommended-ruleset` is moot
for the same reason and is likewise archived.

### Waves 3–4 — ALREADY DONE (archived children), verified in the tree

The genuine code-quality / dependency / UI-audit remainder was NOT re-stubbed
as future work, because it is already complete and archived. Re-stubbing it
would manufacture false backlog and undo the deliberate cleanup in commit
`a17ddd4a`. Each item below was verified against the current source tree on
2026-06-14:

- `archive/2026-05-30-code-quality-modernization` — DONE. `admin.service.ts` is
  220 LOC (was 967), split into `period-admin` / `reminder-admin` /
  `project-admin` / `snapshot-admin` services; `packages/shared` `report.ts` is
  an 11-LOC barrel over `report.schema.ts` / `section.schema.ts` /
  `period.schema.ts` / `stage.schema.ts`; the `status-risk` hooks are
  consolidated into `use-status-risk.ts`; the lone `no-explicit-any` escape
  hatch in `action-log-tab.tsx` is gone.
- `archive/2026-05-30-dependency-upgrades-minor` + the `2026-05-30 upgrade-*`
  major cluster (typescript, types-node, types-cookie, lucide-react, jsdom,
  bull-board-api, react-email-components, vitejs-plugin-react;
  bull-board-express cancelled as a duplicate) — DONE. Spot-checked: TypeScript
  `^6`, lucide-react `^1`.
- `archive/2026-05-30-ui-ux-vercel-audit-research` — DONE (Wave 4,
  research-only). The audit memo landed as the durable spec
  `frontend-audit-memo`; no code was changed.

### Wave 5 — DONE (archived `final-gates-resweep`)

`archive/2026-06-08-final-gates-resweep` ran the final static gate chain
(typecheck / lint / test green) plus the automated `pnpm test:uat` catalog
sweep. Its own tasks note that Waves 2–4 landed in substance via the separate
archived changes above. The Wave-5 gate list in the body of this proposal still
cites `pnpm lint:md`, which no longer exists (markdownlint removed; Prettier
formats Markdown) — that line is historical, superseded by the resweep change's
gate definition.

### Net result

Every wave of this deferred track is either covered (1–2), obsolete (the Biome
framing of Wave 3), or already done-and-archived (Waves 3–5). No new
forward-looking child stubs are warranted. This tracker is kept active only as
the historical map; it can be archived once a maintainer agrees nothing here is
still actionable.
