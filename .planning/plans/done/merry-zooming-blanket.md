# v8.1 Sprint Plan — после ночного марафона (revised 2026-05-14)

> Заменяет план ночного марафона (выполнен, PR #4 в main, commit bb98aca0).
> Версия 3: исправлен scope бэкграунда — это не реализация ребренда / тёмной
> темы / gradient-копипаста, а **визуальное исследование на основе скриншотов**
> от прохода Playwright. Решения о реализации принимаются ПОСЛЕ исследования.

## Текущее состояние (2026-05-14, после Wave 1-4 closure)

Все 4 волны спринта закрыты, 8 коммитов на ветке `fix/PRJ-2/uat-v7-2026-05-12`,
рабочее дерево чистое. Осталось только операционное закрытие: push → PR → CI.

**Выбранный путь — A (закрыть текущий спринт):**

```text
[push origin]  →  [gh pr create]  →  [CI green 6 jobs]  →  [merge main]
   ↑ AGENT          ↑ AGENT             ↑ wait                ↑ HUMAN merge
```

**Следующие шаги (AGENT executes):**

1. `git push origin fix/PRJ-2/uat-v7-2026-05-12`
2. `gh pr create --title "feat(sprint): Wave 1-4 post-marathon — CI baseline + markdownlint + .planning/ consolidation"`
   с body, описывающим каждую волну и ссылающимся на
   `.planning/memory/2026-05-14-post-marathon-sprint.md`
3. `gh pr checks` / `gh run watch` до зелёного CI (6 jobs: lint-md, quality,
   e2e, migrate-reset, visual-baseline, docker-build)
4. Отчитаться пользователю о состоянии PR + CI

**HUMAN потом (после merge, отдельная сессия):**

- Выбрать следующий milestone (Phase 44 / 46 / 47 / 50 / 54)
- Решение по Phase 40 (ребренд) после чтения
  `.planning/memory/2026-05-14-background-research.md`

## Context

После merge PR #4 в main (ночной марафон) и сверки с `v8.1-ROADMAP.md`
картина такая:

**Что реально хочет пользователь сейчас (по feedback от 2026-05-14):**

1. **Заменить ручной клик на Playwright** — то, что в плане ночи было помечено
   как `D-0` (DevRoleSwitcher wipe-manual-uat) и осталось «требует ручного
   клика», должно стать обычным regression spec в `regression-uat-v7.spec.ts`.
   Это правильный best practice — не plan для human-in-the-loop когда
   автоматизация дешёвая.
2. **Мониторинг — да, через локальный Grafana** — Phase 37 (observability) уже
   shipped в v8.0, контейнеризация локально поднимается, можем проверить
   metrics + dashboards без полноценного Phase 41 AI Eval.
3. **Turbopack эксперимент** — хочется измерить и решить.
4. **AI Eval (Phase 41)** — отложить «в закладки» (прямая цитата пользователя
   2026-05-14: «AI пока будешь в закладках»). Активируем когда появится боевой
   API-ключ; до тех пор seed-режим с TODO-маркерами достаточно.
5. **Визуальное исследование бэкграундов (research, не реализация).**
   Дословно от пользователя 2026-05-14: «бэкграунд помо подумать, как можно
   бэкграунд изображения сделать более не просто фоном, а какими-то, не
   знаю, линиями, ну, что-нибудь поинтереснее сделать… при проходе Playrit,
   который по идее должен пройти всё, делать скриншоты одновременно, да, и
   посмотреть, что можно улучшить. Это просто исследовательское. Вообще вот
   этот весь ребрендинг, тёмная тема — это просто исследование пока. Да,
   которые будет основываться на скриншотах. Максимум всё. Не надо больше
   ничего делать, потому что на основе исследования будем уже принимать
   решение». Перевод в задачу:
   - Playwright spec по ходу регрессии **снимает скриншоты** ключевых
     страниц всех 4 ролей (lead/head/admin/viewer).
   - Артефакт: каталог скриншотов + research-memo с идеями (линии,
     паттерны, asymmetric tints, иллюстративные accent-зоны и т. п.) +
     список «вот это можно улучшить».
   - **Никакого кода UI в этом спринте.** Никаких новых gradient-классов,
     никаких new design tokens, никакого dark theme toggle.
   - На основе memo + скриншотов пользователь позже решит — делать
     ребренд/тёмную тему или нет.
6. **Wave closure** — нужен.

**Откуда брался «Phase 40 B2B Rebrand» в обсуждении — пояснение.**
Этот ярлык существует только в `.planning/milestones/v8.1-ROADMAP.md` как
заголовок roadmap-фазы (5 планов 40-01..40-05: PRD, design tokens, theme
toggle, component audit, screenshots). Пользователь его НЕ запрашивал.
Когда пользователь говорил «подумать над бэкграундом», он имел в виду
**визуальное исследование**: посмотреть на скриншоты Playwright и набросать
идеи, как сделать бэкграунд интереснее (линии, паттерны), а не реализовать
Phase 40. Решение «делать ли ребренд / тёмную тему вообще» откладывается
до прочтения research-memo.

**Что НЕ берём в этот спринт (parked, явно):**

- Phase 40 целиком (BRAND-01..05) — roadmap-фаза, продуктовое решение по
  ней принимается ПОСЛЕ research-memo W2-C.
- Любая UI-реализация бэкграунда (gradient-классы, design tokens, theme
  toggle) — только после того, как пользователь прочитает memo и скажет
  «делаем вот это».
- Phase 41 AI Eval — отложить пока AI features не активированы боевым ключом.
- Phase 43/44/46/47 — backlog v8.1, не для этого спринта.

**Закрытые долги от ночного марафона, которые остаются:**

- `HOT-A`: H-1 wipe-manual-uat — ручной клик не сделан → заменим Playwright.
- `HOT-B`: product-ready closure phase 16/17 + 260426-vxp — повисло с 2026-05-08.
- `CI-gap`: PR #4 merged без CI gate (нет `.github/workflows/ci.yml`).

---

## TLDR

### Было / Стало

```text
┌─ БЫЛО (после merge PR #4, 2026-05-14 утро) ────────┐
│ • H-1 wipe — не проверено в браузере               │
│ • Phase 16/17 product-ready — повисло              │
│ • 260426-vxp — open                                │
│ • CI workflow — отсутствует                        │
│ • Grafana/Prometheus — задеплоено, не проверено    │
│ • Turbopack — не измерено                          │
│ • Бэкграунды: subtle gradient только на /lead/report│
│   (D-11). Как сделать «не просто фон» — не изучено │
└────────────────────────────────────────────────────┘

┌─ СТАЛО (цель через 1-2 сессии, ~4-6 часов работы) ─┐
│ ✓ Playwright spec D-0/H-1 wipe — green             │
│ ✓ Phase 16/17 classified, 260426-vxp resolved      │
│ ✓ CI green on main (lint+typecheck+test+e2e)       │
│ ✓ Grafana audit: dashboards loaded, metrics flow   │
│ ✓ Turbopack decision документировано               │
│ ✓ Каталог скриншотов всех ключевых страниц 4 ролей │
│ ✓ Background research-memo с идеями (линии,        │
│   паттерны, accents) + список «что улучшить»       │
│ ✗ НЕТ реализации UI бэкграунда — только research,  │
│   ЗАФИКСИРОВАНО в 3 местах (CLAUDE.md + MEMORY.md  │
│   + research memo с frozen-contract callout)       │
│ ✓ Markdownlint + .planning/ консолидация:          │
│   • .markdownlint.json + lint:md скрипт            │
│   • husky pre-commit hook для *.md                 │
│   • архивные audit'ы → .planning/local-archive/    │
│   • STATE/ROADMAP/PHASE format → GSD canonical     │
│ ✓ STATE.md: phase 16/17 closed + frontmatter clean │
│ ✓ Memory + retro 2026-05-1X-sprint.md              │
└────────────────────────────────────────────────────┘
```

### Поток исполнения

```text
[Wave 1: HOT + CI] ─────── parallel, ~1 час
   │
   ▼
[Wave 2: Monitoring audit + Turbopack + Screenshot research] ── parallel, ~2-3 часа
   │
   ▼
[Wave 3: Planning hygiene + GSD alignment + markdownlint] ── ~1-1.5 часа
   │
   ▼
[Wave 4: closure + retro] ─── ~30 мин
```

«От человека»: ничего активного по ходу спринта (Playwright заменяет ручной
клик). В конце — выбрать следующий milestone из backlog.

---

## Architecture context

Что меняем по слоям:

```text
[Playwright e2e layer]
   apps/web/e2e/regression-uat-v7.spec.ts
       └── ДОПИСАТЬ test для D-0/H-1
           заменяет manual click "Wipe & manual-UAT seed"

[CI layer]
   .github/workflows/ci.yml (NEW)
       ├── lint job (pnpm prettier --check + eslint)
       ├── typecheck job (web + api)
       ├── unit job (vitest @ web)
       └── e2e job (Playwright regression-uat-v7.spec.ts)

[Observability layer — уже задеплоено в v8.0 Phase 37]
   docker-compose.observability.yml
       ├── Prometheus (scraping :3002/metrics)
       ├── Grafana (deploy/grafana-dashboard-*.json)
       └── OTel collector
   audit: docker compose up, hit /metrics, открыть Grafana 3000,
   проверить что dashboards рендерятся с реальными данными

[Next.js build layer]
   apps/web/next.config.ts
       └── ВКЛЮЧИТЬ turbopack experiment, измерить:
           cold start, hot reload, bundle size

[Screenshot research layer — read-only, NO UI code changes]
   apps/web/e2e/screenshots.spec.ts (NEW)
       └── проходит ключевые страницы 4 ролей, сохраняет
           PNG в apps/web/playwright-report/screenshots/.
           Памятник research, не изменяет код страниц.
   .planning/memory/2026-05-1X-background-research.md (NEW)
       └── идеи (линии / паттерны / accents) + список
           «что улучшить» со ссылками на скриншоты.
```

---

## Best practices, применяемые в спринте

> Это явный раздел чтобы не было «по best practice» в воздухе —
> вот конкретные правила, которым следуем.

### Тестирование

1. **Playwright over manual UAT** — если сценарий воспроизводим в headless
   браузере, он становится spec'ом. Ручной UAT остаётся только для:
   реального iOS/Android устройства, копирования в буфер обмена системы,
   PDF-печати с физического принтера. Wipe-flow не из этих категорий →
   автоматизируется.
2. **TDD-first для bug fix** — fix landing с failing spec, который перед
   fix красный, после fix зелёный. Не «спека после фикса по памяти».
3. **regression-uat-v7.spec.ts grows, не fragments** — все D-_/ H-_
   проверки в один файл, чтобы grep по `D-XX` находил владельца за 1 шаг.
4. **storageState reuse** — auth.setup.ts уже выпускает 4 роли (lead/head/
   admin/viewer). Новые specs используют существующие, не пере-логинятся.

### CI

1. **GitHub Actions matrix-free для старта** — отдельные jobs (lint,
   typecheck, test, e2e), но без matrix node-version пока. Сначала
   простой baseline, потом расширение.
2. **pnpm cache + Turborepo cache** — `actions/cache` на `~/.pnpm-store`
   и `node_modules/.cache/turbo`. Без этого первый прогон ~5 мин,
   с кешем ~1 мин.
3. **Playwright browsers cache** — `actions/cache` на `~/.cache/ms-playwright`,
   иначе 200MB chromium качается каждый раз.
4. **fail-fast: false на test/e2e jobs** — чтобы один flaky spec не
   маскировал реальные баги в других jobs.
5. **No --no-verify, no force push** — это в `~/.claude/rules/behavior.md`
   и `bash-defaults.md`. Pre-commit hooks обязаны быть green.

### Observability

1. **Docker compose split** — `docker-compose.yml` для app stack,
   `docker-compose.observability.yml` для metrics stack. Уже есть в репо.
   Не мерджить — иначе local dev не запустится без Prometheus.
2. **Dashboard JSON в `deploy/grafana-dashboard-*.json`** — версионируется
   в git, не «настроил руками и забыл». Изменения через JSON diff.
3. **Audit > add** — Phase 37 уже задеплоен. Сначала audit что работает
   и что нет. Только потом — fixes. Не «давай добавим ещё панель».

### Performance

1. **Turbopack как опыт, не commitment** — включить, замерить, написать
   memo с цифрами, принять решение. Если adopt → отдельный PR.
   Если reject → memo остаётся как «мы это проверяли, вот причина».
2. **Measure before optimize** — cold start, hot reload, bundle size —
   через CLI таймеры, не «кажется быстрее».

### Документация

1. **TODO discipline (CLAUDE.md convention 2026-05-11)** — каждое
   deferred-решение в коде сопровождается `TODO(<ref>)` + заглушка +
   метрика. Никаких silent stubs.
2. **UI strings English (CLAUDE.md 2026-05-11)** — все новые UI-литералы
   в коде на английском. Русские строки только если data из БД.
3. **memory + retro** — каждый закрытый wave пишется в
   `.planning/memory/2026-05-1X-<name>.md`. STATE.md обновляется после
   каждой волны, не в конце.

---

## Стратегия выполнения

### Wave 1 — HOT closure + Playwright wipe + CI (~1 час, parallel где независимо)

Три задачи без общих файлов, выполнение параллельно:

#### W1-A: Playwright spec для D-0/H-1 wipe-manual-uat (~20 мин)

**Файл:** `apps/web/e2e/regression-uat-v7.spec.ts` (дописать в существующий
файл, не плодить новый)

**Что добавить:**

```typescript
// ---------------------------------------------------------------------------
// D-0 / H-1 — DevRoleSwitcher wipe-manual-uat works without guard refusal
// (заменяет ручной клик из ночного марафона)
// ---------------------------------------------------------------------------

test.describe("D-0/H-1 — DevRoleSwitcher wipe-manual-uat", () => {
  test("wipe button triggers reseed without guard error", async ({
    browser,
  }) => {
    const ctx = await browser.newContext(withRole("admin"));
    const page = await ctx.newPage();

    await page.goto("/dev/role-switcher");
    await waitReady(page);

    // Find wipe button by data-testid (или по тексту fallback)
    const wipeBtn = page
      .getByTestId("dev-role-switcher-wipe-manual-uat")
      .or(page.getByRole("button", { name: /wipe.*manual.*uat/i }))
      .first();
    await expect(wipeBtn).toBeVisible({ timeout: 5_000 });

    await wipeBtn.click();

    // Toast appears (success or error)
    const toast = page.locator('[data-sonner-toast], [role="status"]');
    await expect(toast.first()).toBeVisible({ timeout: 60_000 });

    const text = ((await toast.first().textContent()) ?? "").toLowerCase();
    // Must NOT be guard refusal (H-1 logic)
    expect(text).not.toMatch(/refus|guard.*forbid|prod.*destructive/i);
    // Must be success-like
    expect(text).toMatch(/success|seed|complete|done/i);

    await ctx.close();
  });
});
```

**Pre-conditions:**

- `docker compose up -d postgres redis api web` — стек поднят
- POSTGRES_DB = `customreport_uat` (H-1 guard passes)
- `data-testid="dev-role-switcher-wipe-manual-uat"` существует на button —
  если нет, добавить в `apps/web/src/components/dev/role-switcher.tsx`

**Acceptance:** spec зелёный в локальном прогоне + в CI workflow Wave-1-C.

#### W1-B: product-ready closure phase 16/17 + 260426-vxp (~20 мин)

**Шаги:**

1. `peo-session-scan` на phase 16 + 17 → `.planning/phases/16-INTAKE-2026-05-14.md`
   и `17-INTAKE-2026-05-14.md`.
2. Прочитать `.planning/regression/GSD-CLOSURE-PATH-2026-05-08.md` — он
   уже трекает closure status.
3. Для каждого item: filed / unfiled / drop. UAT 10/0 уже PASS (см. STATE.md)
   → закрыть. PDF/theme blocker phase 16 → перевести в backlog как явный
   ADR.
4. 260426-vxp: прочитать `.planning/quick/260426-vxp-*` → resolution memo.
5. STATE.md update: phase 16/17 → «product-ready closed» в Active Blockers.

**Acceptance:** `Active Blockers` секция STATE.md теряет первые два bullet'а
(product-ready gate + phase 16 human gate). 260426-vxp получает явный
RESOLUTION.md.

#### W1-C: CI workflow .github/workflows/ci.yml (~20 мин)

**Файл:** `.github/workflows/ci.yml` (NEW)

**Структура:**

```yaml
name: CI
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm prettier --check .
      - run: pnpm lint

  typecheck:
    runs-on: ubuntu-latest
    steps: [... pnpm install ...]
      - run: pnpm --filter @customreport/web exec tsc --noEmit
      - run: pnpm --filter @customreport/api exec tsc --noEmit

  unit:
    runs-on: ubuntu-latest
    steps: [... pnpm install ...]
      - run: pnpm --filter @customreport/web test --run

  e2e:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15-alpine
        env: { POSTGRES_DB: customreport_uat, POSTGRES_USER: customreport, ... }
        ports: [5432:5432]
      redis:
        image: redis:7-alpine
        ports: [6379:6379]
    steps:
      - ... pnpm install ...
      - uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: playwright-${{ hashFiles('pnpm-lock.yaml') }}
      - run: pnpm --filter @customreport/web exec playwright install --with-deps chromium
      - run: pnpm prisma migrate deploy
      - run: pnpm prisma db seed
      - run: pnpm --filter @customreport/web exec playwright test e2e/regression-uat-v7.spec.ts
      - uses: actions/upload-artifact@v4
        if: failure()
        with: { name: playwright-report, path: apps/web/playwright-report/ }
```

**Тест перед merge:**

1. Создать feature branch `chore/ci-baseline`
2. Push, открыть PR
3. Дождаться 4 зелёных jobs
4. Merge через `gh pr merge --merge`

**Acceptance:** `gh run list --limit 5 --branch main` показывает все
4 jobs green, future PRs не могут влиться без прохождения CI.

---

### Wave 2 — Monitoring audit + Turbopack + Screenshot research (~2-3 часа, parallel)

#### W2-A: Grafana/Prometheus audit (~45 мин)

**Шаги:**

1. `docker compose -f docker-compose.observability.yml up -d`
2. `curl -sf http://localhost:9090/-/healthy` (Prometheus)
3. `curl -sf http://localhost:3000/api/health` (Grafana)
4. Открыть Grafana UI (admin/admin) — проверить:
   - `deploy/grafana-dashboard-*.json` загружены?
   - Datasource Prometheus подключён?
   - Метрики api живые (`up{job="customreport-api"} == 1`)?
5. Hit endpoints чтобы сгенерить трафик:
   - `curl localhost:3001/health/live`
   - login → /head/dashboard в браузере
6. Проверить в Grafana — графики реагируют?

**Что может быть сломано (типовые места):**

- Dashboard JSON ссылается на старые метрики (`http_requests_total` vs
  `cr_http_requests_total`)
- Prometheus scrape target указывает на `localhost:3001` вместо `api:3001`
  в docker-compose сетке
- OTel collector не настроен на отправку в Prometheus

**Output:** `.planning/memory/2026-05-1X-grafana-audit.md` —
{работает / частично / сломано} + список findings + список TODO для отдельной
фазы (если что-то крупное).

#### W2-B: Turbopack эксперимент (~45 мин)

**Шаги:**

1. Прочитать `.planning/phases/39-performance/` — Turbopack уже был в Phase 39
   как plan, посмотреть что осталось.
2. Включить в `apps/web/next.config.ts`:

   ```ts
   const nextConfig = {
     // ... existing
     turbopack: { root: __dirname }, // Next 16 native
   };
   ```

3. Измерить с **Webpack** (baseline):
   - cold start: `time pnpm --filter web dev` до «ready»
   - hot reload: edit `apps/web/src/app/page.tsx`, замерить ms до refresh
   - bundle size: `pnpm --filter web build` → `.next/build-manifest.json`
4. Измерить с **Turbopack**:
   - `TURBOPACK=true pnpm --filter web dev` (или nextConfig флаг)
   - те же 3 метрики
5. Решение:
   - **adopt** если cold start ≥30% быстрее И hot reload не хуже И build green
   - **reject** иначе, с явной причиной
6. Memo: `.planning/memory/2026-05-1X-turbopack-decision.md` с таблицей цифр.

**Если adopt → отдельный PR `chore(perf): enable Turbopack dev mode`.**
**Если reject → memo как evidence на будущее.**

#### W2-C: Скриншот-проход + research-memo «бэкграунд» (~45-60 мин)

**Контекст:** пользователь явно сказал — это **исследование, не реализация**.
Текущий бэкграунд (subtle gradient на `/lead/report`) — просто фон, без
характера. Нужно собрать визуальные данные (скриншоты со всех ключевых
страниц всех 4 ролей) и набросать идеи, как сделать бэкграунд «не просто
фоном, а какими-то линиями, чем-то поинтереснее». Решение «делать ли
ребренд, тёмную тему, и какой конкретно стиль бэкграунда» принимается
пользователем ПОСЛЕ прочтения memo.

**Шаг 1 — Playwright screenshot spec (NEW file).**

Файл: `apps/web/e2e/screenshots.spec.ts`

Идея: отдельный spec, переиспользует `withRole()` / `waitReady()` из
`regression-uat-v7.spec.ts`. Для каждой роли проходит набор страниц,
для каждой делает `page.screenshot({ path, fullPage: true })`.

```typescript
import * as path from "path";
import { test, type Page } from "@playwright/test";

const AUTH_DIR = path.join(__dirname, ".auth");
const OUT_DIR = path.join(__dirname, "..", "playwright-report", "screenshots");

function withRole(role: "lead" | "head" | "admin" | "viewer") {
  return { storageState: path.join(AUTH_DIR, `${role}.json`) };
}

async function waitReady(page: Page) {
  await page.waitForSelector("#main-content", {
    state: "visible",
    timeout: 15_000,
  });
  await page.waitForLoadState("domcontentloaded", { timeout: 15_000 });
}

const PAGES_BY_ROLE: Record<string, { path: string; name: string }[]> = {
  lead: [
    { path: "/lead/report", name: "lead-report" },
    { path: "/reports?tab=drafts", name: "lead-drafts" },
  ],
  head: [
    { path: "/head/dashboard", name: "head-dashboard" },
    { path: "/reports", name: "head-reports" },
  ],
  admin: [
    { path: "/admin", name: "admin-home" },
    { path: "/admin?tab=reminders", name: "admin-reminders" },
    { path: "/admin?tab=settings", name: "admin-settings" },
  ],
  viewer: [{ path: "/head/dashboard", name: "viewer-dashboard" }],
};

for (const [role, pages] of Object.entries(PAGES_BY_ROLE)) {
  test.describe(`screenshots — ${role}`, () => {
    for (const p of pages) {
      test(`${role}/${p.name}`, async ({ browser }) => {
        const ctx = await browser.newContext({
          ...withRole(role as "lead"),
          viewport: { width: 1440, height: 900 },
        });
        const page = await ctx.newPage();
        await page.goto(p.path);
        if (p.path.includes("/lead/report")) {
          await page.waitForURL((url) =>
            url.pathname.includes("/lead/report/"),
          );
        }
        await waitReady(page);
        await page.screenshot({
          path: path.join(OUT_DIR, `${role}-${p.name}.png`),
          fullPage: true,
        });
        await ctx.close();
      });
    }
  });
}
```

**Acceptance шага 1:** запуск `playwright test e2e/screenshots.spec.ts`
кладёт ≥8 PNG в `apps/web/playwright-report/screenshots/`. Spec
гарантированно зелёный (только goto + screenshot, никаких assertions).

**Шаг 2 — Research-memo `.planning/memory/2026-05-1X-background-research.md`.**

Структура memo:

```text
1. Текущее состояние (per-page заметки + ссылки на скриншоты)
   - lead/report          → screenshots/lead-lead-report.png
     текущий фон: subtle green gradient. Замечание: …
   - head/dashboard       → screenshots/head-head-dashboard.png
     текущий фон: чистый белый. Замечание: …
   - …

2. Идеи направлений (research, не commitment)
   - Линии:  тонкие диагональные / blueprint-grid / topographic
   - Паттерны: subtle dots, noise-texture, gradient-mesh
   - Accents: per-role tint (lead = green, head = blue), per-section
     accent-bars
   - Тёмная тема: оценка готовности design tokens

3. «Что можно улучшить» (per-страница, не более 1-2 пунктов)
   - lead/report: фон ровный, можно добавить subtle line-art сверху
   - head/dashboard: KPI cards теряются на белом, бэкграунд мог бы
     рамить их accent-зоной
   - …

4. Открытые вопросы для пользователя
   - Какое направление развивать (линии/паттерны/accents)?
   - Делать ли тёмную тему вообще?
   - Per-role tinting — ок или избыточно?
```

**Acceptance шага 2:** memo существует, ссылается на каждый PNG, содержит
≥3 идеи направлений и ≥5 «что улучшить» наблюдений. **Никаких UI-правок.**

**Жёсткие границы scope:**

- НЕ менять `*.tsx` страниц / компонентов.
- НЕ добавлять CSS variables или Tailwind utility-классы для бэкграунда.
- НЕ трогать `packages/ui/src/styles/globals.css`.
- НЕ генерировать новые Tailwind / shadcn компоненты под идеи.
- Memo пишется в `.planning/memory/`, не в `apps/web/`.

**Шаг 3 — Frozen-contract fixation (обязательный).**

Контракт «research only — никакой реализации без явного решения пользователя»
должен быть зафиксирован в **трёх местах**, чтобы будущие сессии не
интерпретировали скриншоты как «давай начнём делать gradient»:

1. **Project-level CLAUDE.md** (`/Users/ap/work/customreport/CLAUDE.md`) —
   новая секция `### UI/визуал — research before implementation
(2026-05-1X)`:
   - правило: визуальные изменения (бэкграунды, акценты, темы, ребренд)
     реализуются ТОЛЬКО после прочтения research memo пользователем и
     явного указания «делаем вот это»
   - cross-ref на `.planning/memory/2026-05-1X-background-research.md`
   - запрещены: «давай попробуем X», «применим gradient на Y страницы»,
     любые upstream-эвристики без user sign-off

2. **Auto-memory** (`/Users/ap/.claude/projects/-Users-ap-work-customreport/memory/`):
   - новый файл `feedback_ui_visual_research_first.md` (тип: feedback)
   - запись в `MEMORY.md` index с описанием правила
   - содержит цитату пользователя 2026-05-14 как ground truth

3. **Sам research memo** (`.planning/memory/2026-05-1X-background-research.md`):
   - в начале большой блок `> FROZEN CONTRACT — research-only`
   - перечисление того, что НЕ должно произойти из этого memo
   - инструкция: «следующий agent, читающий это, не должен начинать
     реализацию без явного решения пользователя»

**Acceptance шага 3:** все три файла существуют, содержат cross-references
друг на друга, и `grep -rn "research before implementation" .planning/
CLAUDE.md` находит ≥3 совпадения.

**Парковка:** если время Wave 2 заканчивается — оставить только Шаг 1
(скриншоты) + Шаг 3 (fixation в CLAUDE.md + auto-memory). Шаг 2 (memo
с идеями) можно дописать позже — но fixation должна быть всегда, иначе
теряем контекст между сессиями.

---

### Wave 3 — Planning hygiene + GSD alignment + markdownlint (~1-1.5 часа)

**Контекст пользователя 2026-05-14:** «Также посмотри Markdownlint файлы…
сконсолидировали всё в пленинге и вообще выправили метрики GSD, чтобы…
по его документации всё было. Поresearчи контекстным сем, как GSD всё
правильно выправить».

Wave разделена на три потока (могут идти параллельно):

#### W3-A: Markdownlint baseline (~25 мин)

**Текущее состояние:** в `package.json` нет `markdownlint-cli2`, нет
`.markdownlint.json`, husky `pre-commit` не валидирует `.md`. Накопилось
много `.planning/*.md` с разнородным стилем (H1-дубли, висячие списки,
trailing whitespace).

**Шаги:**

1. Добавить devDep: `markdownlint-cli2` (актуальная major — проверить через
   Context7 / `mcp__plugin_context7_context7__resolve-library-id`).
2. Создать `.markdownlint.json` (root):

   ```json
   {
     "default": true,
     "MD013": { "line_length": 120, "code_blocks": false, "tables": false },
     "MD024": { "siblings_only": true },
     "MD033": false,
     "MD041": false,
     "MD034": false
   }
   ```

   Mотивация порогов:
   - `MD013` line_length 120 — реалистично для ASCII frames в planning
   - `MD024` siblings_only — позволяет повторяющиеся `### Шаги` в разных
     секциях
   - `MD033` off — мы используем raw HTML local для блоков `<details>`
   - `MD041` off — fragments в `.planning/memory/` могут начинаться с
     frontmatter, не с H1
   - `MD034` off — bare URL'ы в session-retros это нормально

3. Скрипты в root `package.json`:

   ```json
   "lint:md": "markdownlint-cli2 \"**/*.md\" \"#node_modules\" \"#dist\" \"#.next\" \"#playwright-report\"",
   "lint:md:fix": "markdownlint-cli2 --fix \"**/*.md\" \"#node_modules\" \"#dist\" \"#.next\" \"#playwright-report\""
   ```

4. Husky `pre-commit` (через lint-staged): добавить
   `"*.md": "markdownlint-cli2 --fix"`.
5. Прогнать `pnpm lint:md:fix`, оценить residual ошибки, при необходимости
   расширить ignore-list или скорректировать пороги. Атомарный коммит
   `chore(lint): markdownlint baseline + auto-fixes`.

**Acceptance:** `pnpm lint:md` зелёный на main. CI workflow (W1-C)
расширен новым job `lint-md`.

#### W3-B: `.planning/` консолидация (~30 мин)

**Текущее состояние (см. `ls .planning/`):** в корне накопилось ~15
audit/handoff файлов разной свежести (`v2.0-MILESTONE-AUDIT.md`,
`v4.0-MILESTONE-AUDIT.md`, ... `v6.0-REVIEW-CLOSEOUT.md`,
`HANDOFF-2026-05-04.md`, `PERF-AUDIT-2026-05.md`). Они засоряют корень и
ломают навигацию.

**Шаги:**

1. Каталог `.planning/local-archive/` уже существует — переместить туда
   все милстон-аудиты v2-v6 и handoff-ы старше 2026-05-08.
2. Сохранить в корне ТОЛЬКО актуальные документы:
   - `STATE.md`, `ROADMAP.md`, `PROJECT.md`, `REQUIREMENTS.md`
   - `INTAKE-2026-05-11.md` (свежий), `NEXT-SESSION-PLAN.md` (живой)
   - `config.json`, `.continue-here.md`
   - регрессионные / interaction-inventory остаются, если последняя
     модификация ≤ 14 дней.
3. Создать `.planning/local-archive/INDEX.md` со списком архивных файлов
   и причинами (один-строчник на файл).
4. Атомарный коммит `chore(planning): archive stale audits to local-archive`.

**Acceptance:** `ls .planning/*.md | wc -l` → ≤8 файлов (вместо текущих ~15).
Каждый перемещённый файл есть в `local-archive/INDEX.md`.

#### W3-C: GSD format alignment (~30-40 мин)

**Цель:** выправить `STATE.md` / `ROADMAP.md` / phase-документы под
canonical GSD format так, чтобы `gsd-sdk query state` (если он работает)
и `/gsd-progress` корректно парсили metadata.

**Шаги:**

1. **Research canonical format через Context7:**
   - `resolve-library-id` → ищем `get-shit-done`
   - либо `microsoft-docs` / `WebSearch "gsd-sdk STATE.md format 2026"`
   - читаем `~/.claude/get-shit-done/workflows/settings.md`,
     `~/.claude/skills/gsd-manager/SKILL.md` (уже частично прочитано)
   - выписываем required-fields для frontmatter: `gsd_state_version`,
     `milestone`, `status`, `last_updated`, `progress.{total,completed,percent}`.
2. **STATE.md frontmatter audit:** текущий `progress.percent: 100` при
   `0/3 phases complete` для v8.1 — внутренний конфликт. Исправить на
   честные цифры (v8.1 ещё в работе, percent ≠ 100 пока phases не закрыты).
3. **ROADMAP.md/REQUIREMENTS.md** — проверить, что frontmatter содержит
   `milestone:` поле, заголовки H1/H2 уникальны (под MD024 siblings-only).
4. **Phase folders** — пройти по `phases/40-*`, `phases/41-*`, `phases/42-*`:
   у каждого должен быть `CONTEXT.md` + `PLAN.md` (если фаза начата) с
   GSD-frontmatter (`phase`, `status`, `parent_milestone`).
5. **GSD checklist sync:** запустить `pnpm gsd:checklist:sync` (есть в
   scripts) — он должен пройти без ошибок.

**Acceptance:**

- `pnpm gsd:checklist:sync` → exit 0
- STATE.md `progress.percent` отражает реальное состояние v8.1 (не 100)
- В каждом активном phase folder есть CONTEXT.md с canonical frontmatter

**Note про Context7:** если `context7` MCP не отвечает или library-id для
`get-shit-done` не находится — fallback на чтение
`~/.claude/get-shit-done/workflows/*.md` напрямую (read-only) и
`~/.claude/skills/gsd-*/SKILL.md`. Это и есть source-of-truth GSD format
на этой машине.

---

### Wave 4 — closure + retro (~30 мин)

```text
1. STATE.md финальный update:
   - phase 16/17 → closed
   - 260426-vxp → resolved
   - milestone v8.1 → still IN PROGRESS (3 фазы parked)
   - new: «Sprint 2026-05-14: HOT closure + monitoring + turbopack done»

2. .planning/memory/2026-05-1X-post-marathon-sprint.md
   - Что закрыто, что parked, какие findings из Grafana
   - Turbopack решение
   - Next: какой milestone дальше?

3. .planning/memory/MEMORY.md — добавить запись с указателем

4. peo-retro full на ru → итоговое summary

5. PR `feat/post-marathon-sprint` → main
   - Описание со списком закрытого
   - Ссылка на memo
   - Approve после CI green
```

---

## От человека

```text
┌─ ▲ ОТ ТЕБЯ ────────────────────────────────────────┐
│                                                    │
│ В Wave 1: ничего (Playwright заменил ручной клик)  │
│                                                    │
│ В Wave 2: ничего (всё автономно)                   │
│   Опционально: если хочешь визуально посмотреть    │
│   Grafana дашборд после моего audit — открой       │
│   http://localhost:3000 (admin/admin)              │
│                                                    │
│ В Wave 3: ничего (markdownlint + planning hygiene  │
│   + GSD format alignment — всё автономно)          │
│                                                    │
│ В Wave 4: выбрать следующий milestone из backlog:  │
│   • Phase 44 Reminder Policies (UFB-036) — admin   │
│     полировка                                      │
│   • Phase 46 Group-Scope Visibility (UFB-040) —    │
│     security полировка                             │
│   • Phase 47 Head Presentation (UFB-041) — UI      │
│   • Phase 50 period-lifecycle                      │
│   • Phase 54 ai-rag activation                     │
│                                                    │
└────────────────────────────────────────────────────┘
```

Всё остальное — Я делаю сам (planning, code, tests, push, PR, retro).

---

## Open questions

| #   | вопрос                                                                           | как решу автономно                                                                                                                                | когда эскалирую                                                          |
| --- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 1   | W1-A: на wipe-кнопке нет `data-testid`?                                          | Добавлю `data-testid="dev-role-switcher-wipe-manual-uat"` в `apps/web/src/components/dev/role-switcher.tsx`                                       | не эскалирую — это 1-line edit                                           |
| 2   | W1-C: какой Node version в CI?                                                   | 22 LTS (соответствует tech-stack.md «Node.js 22.x LTS»)                                                                                           | если в репо есть `.nvmrc` с другой версией → возьму её                   |
| 3   | W2-A: что если Grafana вообще не запускается?                                    | Отдельный плановый item «Phase 37 observability re-verify», memo с findings, не делаю в этом спринте                                              | если блокирует Wave 3 → спрошу                                           |
| 4   | W2-B: Turbopack adopt criterion 30% — это hard threshold?                        | Soft: если 25-30% и hot reload ≤ baseline → adopt с note. Если <25% → reject                                                                      | если adopt всё равно ломает что-то невидимое — memo + reject             |
| 5   | W2-C: сколько страниц снимать в screenshot-spec'е?                               | Стартовый набор: 8 (см. `PAGES_BY_ROLE` в spec). Это покрывает 4 роли и ключевые экраны. Никакой UI-имплементации                                 | если пользователь захочет идею «делать ребренд» — отдельный план         |
| 6   | W3-A: какой `markdownlint-cli2` ставить — major 0.x или 1.x?                     | Через Context7 / `mcp__plugin_context7_context7__resolve-library-id` найду актуальный major на 2026-05. Fallback — npm registry latest            | если major-bump ломает уже принятые рантаймом MD-файлы → memo с decision |
| 7   | W3-B: куда переносить `INTERACTION-INVENTORY-2026-05-05.md`?                     | Если ≤14 дней — оставляю в корне; если старше — в `local-archive/`. Сейчас 2026-05-05 + 14 = 2026-05-19 → пока в корне, проверю по реальной mtime | не эскалирую                                                             |
| 8   | W3-C: STATE.md `progress.percent: 100` при `0/3 phases` v8.1 — баг или фича GSD? | Пересчитаю по правилу `completed_phases / total_phases * 100` для текущего milestone. 0/3 = 0% (а не overall 36/41 = 88%)                         | если поломает gsd-progress парсер — фиксирую через memo                  |
| 9   | Wave 4: какой milestone дальше?                                                  | Не выбираю автономно — это продуктовое решение. Подготовлю краткое сравнение 5 опций к концу Wave 4                                               | эскалирую всегда                                                         |

---

## Files to modify

### Wave 1

```text
- apps/web/e2e/regression-uat-v7.spec.ts            UPDATE (+D-0/H-1 spec)
- apps/web/src/components/dev/role-switcher.tsx     UPDATE (data-testid)
- .planning/STATE.md                                UPDATE (phase 16/17 closure)
- .planning/phases/16-INTAKE-2026-05-14.md          NEW
- .planning/phases/17-INTAKE-2026-05-14.md          NEW
- .planning/quick/260426-vxp-*/RESOLUTION.md        NEW
- .github/workflows/ci.yml                          NEW
```

### Wave 2

```text
- .planning/memory/2026-05-1X-grafana-audit.md           NEW
- apps/web/next.config.ts                                UPDATE (turbopack flag, conditional)
- .planning/memory/2026-05-1X-turbopack-decision.md      NEW
- apps/web/e2e/screenshots.spec.ts                       NEW (no-assertion screenshot pass)
- .planning/memory/2026-05-1X-background-research.md     NEW (research memo + frozen-contract)
- CLAUDE.md (project root)                               UPDATE (+«UI/визуал — research first» convention)
- ~/.claude/projects/-Users-ap-work-customreport/memory/feedback_ui_visual_research_first.md  NEW (auto-memory feedback)
- ~/.claude/projects/-Users-ap-work-customreport/memory/MEMORY.md  UPDATE (index entry)
# NB: НЕТ изменений UI-кода в W2-C. Никаких *.tsx / *.css правок.
```

### Wave 3

```text
- package.json (root)                              UPDATE (devDep markdownlint-cli2 + scripts)
- .markdownlint.json                               NEW (lint config, see W3-A)
- .husky/pre-commit                                UPDATE (lint-staged для *.md)
- package.json (root) lint-staged                  UPDATE (add "*.md": markdownlint-cli2 --fix)
- .github/workflows/ci.yml                         UPDATE (+lint-md job)
- .planning/local-archive/                         POPULATE (move stale audits in)
- .planning/local-archive/INDEX.md                 NEW (one-line entry per moved file)
- .planning/STATE.md                               UPDATE (progress.percent recalculated)
- .planning/ROADMAP.md                             UPDATE (frontmatter normalization if needed)
- .planning/phases/4{0,1,2}-*/CONTEXT.md           CREATE if missing (canonical frontmatter)
- .planning/*.md (all)                             AUTO-FIX through markdownlint-cli2 --fix
```

### Wave 4

```text
- .planning/STATE.md                                UPDATE (final)
- .planning/memory/2026-05-1X-post-marathon-sprint.md  NEW
- .planning/memory/MEMORY.md                        UPDATE
- .planning/session-retros/NEXT-ACTIONS.md          UPDATE
```

---

## Verification

```bash
# Wave 1 — Playwright wipe spec
rtk pnpm --filter @customreport/web exec playwright test \
    e2e/regression-uat-v7.spec.ts -g "D-0/H-1"           # → 1 passed

# Wave 1 — STATE.md closure
rtk grep -n "Phase 16 human gate" .planning/STATE.md     # → должно исчезнуть

# Wave 1 — CI workflow
rtk gh run list --branch chore/ci-baseline --limit 1     # → success
rtk gh pr view <ci-PR>                                   # → MERGED

# Wave 2 — Grafana audit
docker compose -f docker-compose.observability.yml ps    # → 3 services Up
curl -sf http://localhost:9090/-/healthy                 # → ok
curl -sf http://localhost:3000/api/health                # → ok
# Manually: http://localhost:3000 → dashboards рендерятся

# Wave 2 — Turbopack
time pnpm --filter @customreport/web dev                 # baseline
TURBOPACK=true time pnpm --filter @customreport/web dev  # measured
cat .planning/memory/2026-05-1X-turbopack-decision.md    # → adopt|reject + numbers

# Wave 2 — Screenshot research
rtk pnpm --filter @customreport/web exec playwright test \
    e2e/screenshots.spec.ts                              # все screenshots passed
ls apps/web/playwright-report/screenshots/*.png | wc -l  # → ≥8
cat .planning/memory/2026-05-1X-background-research.md   # → memo с идеями + frozen-contract
grep -rn "research before implementation" .planning/ CLAUDE.md  # ≥3 совпадения

# Wave 3 — markdownlint baseline
pnpm lint:md                                             # → 0 errors на main
grep -n "lint-md" .github/workflows/ci.yml               # → CI job exists

# Wave 3 — planning consolidation
ls .planning/*.md | wc -l                                # → ≤8 файлов
test -f .planning/local-archive/INDEX.md && cat $_ | head # → archive index есть

# Wave 3 — GSD format alignment
pnpm gsd:checklist:sync                                  # → exit 0
grep "percent:" .planning/STATE.md                       # → реалистичное число (не 100 при 0/3)
ls .planning/phases/40-*/CONTEXT.md .planning/phases/41-*/CONTEXT.md  # → файлы есть

# Wave 4 — closure
rtk git log --oneline origin/main..HEAD                  # коммиты спринта
rtk gh pr view <sprint-PR>                               # MERGED
rtk grep -n "Sprint 2026-05-14" .planning/STATE.md       # запись есть
```

---

## Side deliverables

```text
[1] CLAUDE.md Conventions (project):
      • CI workflow требование для всех PR в main (после Wave 1)
      • UI/визуал-решения принимаются ПОСЛЕ research-memo + скриншотов,
        не до. Никаких «давай добавим gradient» без memo (после W2-C)

[2] .planning/session-retros/NEXT-ACTIONS.md:
      • Обновить под результат спринта

[3] .planning/memory/MEMORY.md:
      • Запись «post-marathon sprint done» с указателями на 3 memo
        (grafana-audit, turbopack-decision, background-research)

[4] PR(s) описания:
      • W1: chore(ci): baseline CI gate (lint+typecheck+unit+e2e)
      • W1: test(e2e): replace manual wipe UAT with Playwright spec
      • W1: docs(state): close phase 16/17 product-ready gate
      • W2: chore(perf): turbopack adopt/reject decision
      • W2: test(e2e): add screenshots spec + background research memo
        (research-only PR; никаких UI-правок)
      • W3: chore(lint): markdownlint baseline + CI lint-md job
      • W3: chore(planning): archive stale audits to local-archive
      • W3: docs(state): GSD format alignment (progress.percent + CONTEXT.md)
      • W4: docs(memory): post-marathon sprint retro

[5] CI gate как best practice для будущего:
      • Все следующие фазы (40-43, 44, 46, 47) merge'атся через PR с green CI
      • Это закрывает дыру, через которую PR #4 проскочил
```

---

## Pillars / rules self-verify

```text
┌─ Pillars compliance ─────────────────────────────────────────┐
│ 1 TDD-first       ✓ Playwright spec пишется до W1-A fix       │
│ 2 Always Ask      ✓ 9 open questions с автономной колонкой    │
│ 3 Socratic Review ✓ Wave 4 retro = self-check                 │
│ 4 Surgical        ✓ Phase 40 рендр parked, scope = только     │
│                     закрытие долгов + research + hygiene      │
│ 5 Task Tracking   ✓ 4 waves, явные acceptance per task        │
│ 6 Memory          ✓ Wave 2 + Wave 4 пишут 4 memo + frozen-cnt │
│ 7 Plan Before     ✓ этот файл = плана; ExitPlanMode = gate    │
│ 8 Rule Evolution  ✓ CLAUDE.md UI-research convention в W2-C   │
│ 9 Config-First    ✓ .markdownlint.json + workflows/.env       │
│ 10 Depersonalized ✓ роли (lead/head/admin/viewer), не имена   │
│ 11 Subagent Para  ✓ W1 = 3 parallel, W2 = 3 parallel, W3 = 3  │
└──────────────────────────────────────────────────────────────┘
```

---

## DONE WHEN

```text
Wave 1 — HOT closure + CI:
  ✓ Playwright spec D-0/H-1 wipe-manual-uat зелёный локально и в CI
  ✓ STATE.md: phase 16/17 → product-ready closed
  ✓ 260426-vxp: RESOLUTION.md написан
  ✓ .github/workflows/ci.yml на main, gate'ит будущие PR

Wave 2 — Monitoring + Turbopack + Research:
  ✓ Grafana audit memo (что работает / что сломано / TODO)
  ✓ Turbopack decision документировано (adopt | reject + цифры)
  ✓ Screenshot research (W2-C): ≥8 PNG в playwright-report/screenshots/
     + research-memo с идеями (линии/паттерны/accents) + «что улучшить».
     НИКАКОГО UI-кода — решение по реализации остаётся за пользователем
  ✓ Frozen-contract зафиксирован в 3 местах:
     CLAUDE.md project + auto-memory feedback + research memo callout.
     grep -rn "research before implementation" → ≥3 совпадения

Wave 3 — Hygiene + GSD:
  ✓ pnpm lint:md зелёный на main; CI имеет job `lint-md`
  ✓ ls .planning/*.md | wc -l ≤ 8 (вместо текущих ~15);
    .planning/local-archive/INDEX.md заполнен
  ✓ pnpm gsd:checklist:sync → exit 0
  ✓ STATE.md `progress.percent` отражает реальное состояние v8.1 (не 100)
  ✓ phases/40-*, 41-*, 42-* содержат CONTEXT.md с canonical frontmatter

Wave 4 — Closure:
  ✓ Memory + retro 2026-05-14-post-marathon-sprint.md
  ✓ MEMORY.md index обновлён
  ✓ NEXT-ACTIONS.md обновлён под результат спринта
  ✓ Пользователь выбрал следующий milestone (Phase 44/46/47/50/54)
```
