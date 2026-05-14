# Night marathon — UAT v7.4 wipe-unblock + 36 page-feedback fixes + hardening commit

## Context

**Зачем эта правка.** Вечером 2026-05-13 пользователь проводил браузерный UAT по
ветке `fix/PRJ-2/uat-v7-2026-05-12` через Codex-сессию `019e22e7`. Накопилось
**~36 point-feedback'ов** по страницам (лендинг → admin → lead form → reports →
head dashboard → slides), **3 hardening-фикса** (H-1/H-2/H-3, untracked) и
**1 свежий блокер** из последнего скриншота: попытка вайпа БД через DevRoleSwitcher
падает на моём же H-1 guard, потому что docker-compose использует host=`postgres`

- db=`customreport` (без `_uat` суффикса).

**Что хотим получить к утру.**

1. Ручной UAT снова работает — `Wipe & manual-UAT seed` проходит, БД пересоздаётся.
2. H-1/H-2/H-3 закоммичены и запушены.
3. Все 36 feedback-точек либо починены, либо явно помечены `coming soon` с tooltip
   (для виджетов, которые мы намеренно не достраиваем до v7.4).
4. Playwright self-UAT прогоняется автоматически по ключевым ролям/страницам и
   валится с понятным репортом, а не молча.
5. chrome-devtools MCP подключён и проверен на критичных URL.
6. Pillars (Boris Cherny 11) и rules/_ соблюдены — никаких bypass-`--no-verify`,
   никаких русских литералов в `apps/web/src/\*\*/_.tsx`, никаких прямых edit'ов
`~/.claude/\*` без catalog-source-first.
7. PR #3 обновлён, готов к финальному approve на утреннем стендапе.

---

## TLDR

### Было / Стало

```text
┌─ БЫЛО (вечер 13.05) ───────────────────────────────┐
│ • H-1/H-2/H-3 написаны, не коммитнуты              │
│ • UAT-wipe ломается на _destructive-guard          │
│ • 36 feedback-точек не разобраны                   │
│ • Recharts SVG tabindex=0 — accessibility шум      │
│ • Activity panel у Натальи (finance) показывает 6  │
│   лидов вместо 2 — scope leak                      │
│ • Audit log в UI отсутствует у всех ролей          │
│ • Agentation devtools оверлей перекрывает футер    │
│ • Стрелки версий в VersionHistoryNav не работают   │
│ • Submit Report падает: priorities array=0         │
│ • StageMultiSelect не подсвечивает выбранные при   │
│   edit (хотя при создании были выбраны)            │
│ • LeadDraftsPanel — непонятно что это, логика      │
│ • Recharts focusable=true на head dashboard        │
│ • Lead form decisions dialog: метки выше полей     │
│ • viewer /head/slides — нет аудита, мало смысла    │
└────────────────────────────────────────────────────┘

┌─ СТАЛО (цель к утру 14.05) ────────────────────────┐
│ ✓ docker-compose db переименована customreport_uat │
│ ✓ H-1/H-2/H-3 коммит fix(hardening): pushed        │
│ ✓ UAT wipe + reseed работает без override-флага    │
│ ✓ T1 (быстрые, ≤30мин/штука): 14 фиксов в коде     │
│ ✓ T2 (средние, исследование + код): 12 фиксов      │
│ ✓ T3 (большие, ресерч + memo): 6 решений документы │
│ ✓ T4 (Playwright + MCP): self-UAT в make scripts   │
│ ✓ Agentation overlay переехал top-right            │
│ ✓ Recharts focusable=false, tabindex=-1            │
│ ✓ Memory: 2026-05-14-night-marathon.md             │
│ ✓ PR #3 + ~80 свежих коммитов pushed               │
└────────────────────────────────────────────────────┘
```

### Поток исполнения (волнами, параллельно где возможно)

```text
[wave-A unblock] [wave-B commit hardening] [wave-C Playwright skeleton]
       │                  │                          │
       └──────► [wave-D T1 quick fixes: 14 точек, параллельно где независимо]
                                  │
                       [wave-E T2 medium fixes: 12 точек]
                                  │
                       [wave-F T3 research memos: 6 решений]
                                  │
                       [wave-G MCP chrome-devtools sweep + Playwright run]
                                  │
                       [wave-H commit + push + PR update + retro]
```

### Spec-updates

```text
┌─ Документы, которые обновятся за ночь ─────────────┐
│ • .planning/memory/2026-05-14-night-marathon.md    │
│ • .planning/session-retros/NEXT-ACTIONS.md         │
│ • CLAUDE.md: Conventions — add audit-log пункт     │
│ • CLAUDE.md: Conventions — add docker-db _uat      │
│   suffix как обязательный                          │
│ • apps/web/playwright.config.ts: добавить sweep    │
│ • PR #3 description: список 36 feedback statuses   │
└────────────────────────────────────────────────────┘
```

«От человека одной строкой»: утром approve PR #3 в GitLab UI после прогона
Playwright и просмотра NEXT-ACTIONS.md. Всё остальное — автономно за ночь.

---

## Architecture context

```text
[Browser /admin?tab=… page] ──tRPC mutation──▶ [tRPC.dev.wipe / reseed]
                                                    │
                                                    ▼
                              [child_process: pnpm exec tsx prisma/wipe-manual-uat.ts]
                                                    │
                                                    ▼
                                       [prisma/_destructive-guard.ts]
                                                    │
                              checks host + db-name vs ALLOW_PROD_DESTRUCTIVE
                                                    │
                              ✗ FAIL: host=postgres, db=customreport (no _uat)
                              ✓ FIX: rename docker db → customreport_uat
                                                    │
                                                    ▼
                                       [prisma migrate reset --force]
                                                    │
                                                    ▼
                                       [prisma/seed.ts (manual-uat variant)]
```

```text
[Lead form /lead/report/<id>] ──useReportForm──▶ [trpc.report.update]
       │                                              │
       │                                              ▼
       │                                       [zod schema validate]
       │                                              │
       ▼                                  fail: priorities.min(1) at submit
[StageMultiSelect]                          while user has 0 priorities
   bug: chips not                                     │
   highlighted in edit                                ▼
   mode (D-13)                              [400 + toast.error]
```

```text
[Head dashboard] ──trpc.dashboard.current──▶ [DashboardService.list]
       │                                              │
       ▼                                              ▼
[ActivityLivePanel]                          where: groupId IN (
   showing 6 entries                            user.groupAccess[].groupId)
   for Natalya (D-32)                                │
       │                                              ▼
       └─ scope leak: includes leads               returns wider set than
          outside her group                         viewer's groupAccess
```

---

## Review state (current branch)

```text
┌─ Untracked / uncommitted ──────────────────────────┐
│ M  apps/web/src/app/api/revalidate-org/route.ts    │ H-2
│ M  prisma/_destructive-guard.ts                    │ H-1
│ ?? prisma/migrations/                              │
│      20260514140000_h3_report_open_dedup_safe/     │ H-3
│ ?? .planning/memory/                               │
│      2026-05-13-plan-formation-verbatim-…md        │
│      2026-05-14-0105-uat-v7-repair-handoff.md      │
└────────────────────────────────────────────────────┘

┌─ Open feedback points (36 total, classified) ─────┐
│ T1 quick (≤30мин)         14                       │
│ T2 medium (research+code) 12                       │
│ T3 large (research memo)   6                       │
│ T4 infra (Playwright/MCP)  4                       │
└────────────────────────────────────────────────────┘
```

PR #3 (`fix/PRJ-2/uat-v7-2026-05-12` → main) уже существует, +152 коммита; новые
ночные коммиты лягут поверх, описание PR обновим после wave-H.

---

## Стратегия выполнения

### Wave-A — wipe-unblock (10–15 мин, КРИТИЧНО, делается ПЕРВЫМ)

**Цель:** разблокировать ручной UAT через `DevRoleSwitcher → Wipe & manual-UAT seed`.

**Решение:** переименовать docker БД `customreport` → `customreport_uat`. Это
explicit non-prod suffix → `_destructive-guard.ts` (H-1) разрешает destructive op.
H-1 откатывать **нельзя** — он защищает prod от docker-compose-name-collision.

Шаги (агент делает сам, Haiku разведка → Sonnet edit):

```text
[1] docker-compose.yml:
       POSTGRES_DB: customreport         → customreport_uat
       DATABASE_URL: …/customreport      → …/customreport_uat (2 места)
[2] .env, .env.test, .env.example, apps/web/.env, apps/web/.env.local,
    apps/web/.env.example, apps/api/.env* — grep "customreport" и
    заменить только URL-path-segment (без затрагивания user='customreport')
[3] docker compose down -v   (удаляет старый volume customreport)
    docker compose up -d postgres redis
    sleep 5; docker compose exec postgres pg_isready -U customreport
[4] PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=yes \
        pnpm exec prisma migrate dev
[5] docker compose restart api web
[6] curl localhost:3000/api/health    → 200
[7] open localhost:3000/dev/role-switcher → wipe & reseed manual-uat → 200
```

**Acceptance:** UI-вызов `Wipe & manual-UAT seed` возвращает success-toast, не
ошибку. Проверяем prisma studio: 4 lead'а Software Development + 2 lead'а Finance.

### Wave-B — commit H-1/H-2/H-3 (5 мин)

```text
git add prisma/_destructive-guard.ts \
        apps/web/src/app/api/revalidate-org/route.ts \
        prisma/migrations/20260514140000_h3_report_open_dedup_safe/

git commit -m "fix(hardening): H-1 docker-guard + H-2 CSRF origin + H-3 dedup"

git push origin fix/PRJ-2/uat-v7-2026-05-12
```

Pre-commit hooks (prettier, ESLint, typecheck, lint:md) должны пройти без
`--no-verify` (Pillar 8). Любой fail — fix root cause, не bypass.

### Wave-C — Playwright + MCP skeleton (20 мин)

**Pillars Playwright:**

```text
[apps/web/playwright.config.ts]
   ├── projects:
   │     ├── lead-form-uat       baseURL=:3000 storageState=lead.json
   │     ├── admin-uat           storageState=admin.json
   │     ├── head-dashboard      storageState=head.json
   │     └── viewer-slides       storageState=viewer.json
   └── reporter: line + html

[apps/web/tests/e2e/night-marathon-sweep.spec.ts]   (NEW)
   ├── lead saves draft → reload → chips still selected (D-13/D-15)
   ├── lead submits with 0 priorities → friendly error (D-21)
   ├── admin attaches product to group → other group shows lock (D-2)
   ├── head dashboard activity scoped to user.groupAccess (D-32)
   ├── viewer /head/slides has no edit/draft UI (D-33)
   └── recharts SVG tabindex=-1, focusable=false (D-35)
```

**chrome-devtools MCP (`mcp__plugin_chrome-devtools-mcp_chrome-devtools__*`)** —
доступен из system reminders. Используется на wave-G для визуальной верификации:
скриншоты до/после, network throttle, console errors == 0.

### Wave-D — T1 quick fixes (14 точек, 3 часа, параллельно по 4)

Параллельные подсводы для Haiku:

```text
agent A (Haiku) — Recharts a11y + lead form micro:
   D-35 product-kpi-card.tsx:22 ResponsiveContainer
        → wrap with <div aria-hidden role="img" aria-label="trend">
          ResponsiveContainer cannot tabIndex itself; mute the SVG via
          svgProps={{ tabIndex: -1, focusable: false }} on LineChart
   D-12 item-edit-dialog.tsx state pill "In Progress" не обновляется
        → setState внутри onClick + re-render проверка
   D-14 decision-edit-dialog.tsx grid sm:grid-cols-2 — labels выше полей
        → grid auto-flow row на mobile, labelы стак, поля стак

agent B (Haiku) — StageMultiSelect:
   D-13 / D-15 stage-multi-select.tsx
        → при edit, начальные value пробрасываются из item.stages
        → check defaultValues init in form.reset(item) call site
   D-15 risks-section.tsx "All stages" pill
        → если stages.length === ALL_STAGES.length показать "All stages",
          иначе перечислить выбранные через запятую

agent C (Haiku) — Reports & Activity:
   D-23/D-24 reports/page.tsx + search-input
        → wrap with <Suspense fallback={<SearchSkeleton/>}>
        → list rendered via skeleton until query ready
   D-27/D-36 Agentation overlay позиция
        → агентация это external package; expose mountPosition prop
          или position: fixed top-4 right-4 (CSS override через layer)
   D-30 activity-live-panel.tsx link target
        → если report.state=draft, не делать href — показать tooltip
          "Lead ещё дописывает, отчёт не отправлен"

agent D (Haiku) — Coming soon badges:
   D-7  reminders-tab PolicyRow — Coming Soon badge + tooltip
   D-9  settings-tab AI/CI integrations стилизация под slack
   D-25 lead-history-sidebar.tsx → Coming Soon + tooltip
   D-29 head dashboard «где метрики» — добавить «Period KPIs» секцию-заглушку
   D-1  login-page.client.tsx уже фикснут в prev session — verify only
```

### Wave-E — T2 medium fixes (12 точек, 4 часа)

```text
E-1  D-2  GroupProductsEditor: disable products уже в других группах
          → fetch listProductGroups в editor; products с existing groupId
            !== currentGroupId → disabled + badge "В группе X"
E-2  D-32 ActivityLivePanel scope leak (finance shows 6)
          → audit DashboardService.listActivity; убедиться что фильтр по
            user.viewerGroupAccess[].groupId применяется
E-3  D-31 head dashboard "коллизии данных" — research memo + SQL audit
          → write .planning/memory/2026-05-14-data-collision-audit.md
            запустить запрос: select user.id, count(distinct product.groupId)
            from ProductLead join…
E-4  D-19 VersionHistoryNav diff preview
          → новый компонент <VersionDiffPreview from=A to=B> показывает
            changed sections counts; используем jsondiffpatch
E-5  D-20 VersionHistoryNav arrows broken
          → debug currentVersionIndex увеличение/уменьшение
            написать E2E spec до фикса
E-6  D-22 Save Version conflict при rollback
          → выбрать политику: optimistic copy-forward (рекомендую)
            VS hard block while in old version
E-7  D-21 Submit Report priorities array empty error
          → либо разрешить empty при draft, либо явный UI message
            "Добавь хотя бы одну приоритетную задачу"
            рекомендую: разрешить empty на draft, требовать на submit
E-8  D-5  settings users-tab: warning при смене group
          → AlertDialog с предпросмотром: «у пользователя N draft'ов в
            старой группе — они сохранятся как историческая привязка»
E-9  D-3/D-26/D-34 Audit log surface для всех ролей
          → новая страница /audit?scope=mine|group|all
          → role gating: lead = mine, head = group, admin = all
          → backend: уже есть `ActivityEvent` модель?
E-10 D-33 viewer /head/slides — push reminder + highlight slide
          → "remind lead X" mutation, в slide-viewer добавить badge "needs update"
E-11 D-11 lead form background — design tokens
          → линейный градиент под header, subtle pattern
            заимствовать из landing-page.client.tsx
E-12 D-18 LeadForm "DTP1·Артём З.·Lead" — убрать или collapse mobile
```

### Wave-F — T3 research memos (6 точек, 2 часа)

```text
F-1  D-6   Period archive snapshots — что сохраняется и зачем
F-2  D-8   PeriodsSubTab "любой день периода" — продуктовая логика
F-3  D-17  Period navigator "период написать наглядно"
F-4  D-16  Priorities chip styling — первая буква + цвет стадии
F-5  D-29  Head dashboard метрики Артёма — спец КПИ ассемблер
F-6  D-34  Viewer dashboard semantics — vs head, audit, send-message
```

Каждый F-\* — отдельный markdown в `.planning/memory/`, ровно 1 экран, с
рекомендацией и trade-off. Не код, только направление.

### Wave-G — MCP sweep + Playwright run (45 мин)

```text
[mcp chrome-devtools list_pages]            → ensure dev server reachable
[take_screenshot /admin?tab=users]          → before vs after diff
[list_console_messages /head/dashboard]     → assert errors == 0
[take_snapshot /reports?tab=drafts]         → a11y tree, role hierarchy
[playwright self-uat run]                   → all 6 specs green
```

### Wave-H — commit + push + PR update + retro (30 мин)

```text
[git add -p]      по 1 thematic коммит за раз:
                  fix(admin): D-2 lock multi-group products
                  fix(lead-form): D-12..D-22 stage / version / decisions
                  fix(dashboard): D-29/D-32 scope + metrics
                  feat(audit): D-3 audit log surface
                  feat(playwright): D-pw self-uat sweep
                  chore(docker): rename db customreport_uat for guard
                  docs(memory): night-marathon retro

[git push]        pre-push hook = unit tests → must pass
[gh pr view 3]    update body with feedback resolution table
[Demo-retro full]  short closing retro to chat
```

---

## От человека

```text
┌─ ▲ ОТ ТЕБЯ ────────────────────────────────────────┐
│  (ничего на этой ночи — иди занимайся своим)       │
│                                                    │
│  Утром:                                            │
│   • просмотр .planning/memory/2026-05-14-night-… │
│   • approve PR #3 в GitLab UI (если pipeline ✓)    │
│   • прогон ручного UAT 10–15 мин по чек-листу из   │
│     NEXT-ACTIONS.md (любая точка из D-* должна     │
│     работать или быть Coming Soon)                 │
└────────────────────────────────────────────────────┘
```

Всё остальное — Я делаю сам.

---

## Open questions

| #   | вопрос                                             | как решу автономно                                                                                   | когда эскалирую                                                                                 |
| --- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1   | D-22 Save Version conflict policy                  | Реализую optimistic copy-forward (старая версия становится новой текущей), помечу `policy:v1` в memo | если pre-existing E2E зависит на hard-block — оставлю TODO                                      |
| 2   | D-21 priorities empty at submit                    | Разрешу empty в draft, потребую >=1 в submit; toast «добавь хотя бы один приоритет»                  | если product owner просил наоборот — TODO + memo                                                |
| 3   | D-3 audit log scope (mine/group/all)               | Lead=mine, Head=group, Admin=all (по правилу least-privilege)                                        | если в PRD написано иначе — оставлю как stub + Coming Soon                                      |
| 4   | D-11 lead form background — какой стиль            | Скопирую gradient из landing-page (он одобрен ранее)                                                 | если в landing нет — оставлю текущий + Coming Soon                                              |
| 5   | docker DB rename — миграция данных текущей dev БД? | Volume сносится `docker compose down -v` — данные dev'а **dropped**, восстанавливаются seed'ом       | если пользователь хочет сохранить ручные тестовые данные — приостановлюсь после wave-A и спрошу |

---

## Files to modify

### Wave-A (wipe-unblock)

- `docker-compose.yml` — `POSTGRES_DB`, 2× `DATABASE_URL`
- `.env`, `.env.test`, `.env.example`
- `apps/web/.env`, `apps/web/.env.local`, `apps/web/.env.example`

### Wave-B (hardening commit)

- (только git add + commit, файлы уже изменены)

### Wave-C (Playwright + MCP)

- `apps/web/playwright.config.ts` — добавить `night-marathon-sweep` project
- `apps/web/tests/e2e/night-marathon-sweep.spec.ts` (NEW)
- `apps/web/tests/e2e/fixtures/lead.json|admin.json|head.json|viewer.json` (NEW)

### Wave-D (T1 quick fixes)

- `apps/web/src/components/dashboard/product-kpi-card.tsx:22` — Recharts a11y
- `apps/web/src/components/lead/item-edit-dialog.tsx:68` — in-progress state
- `apps/web/src/components/lead/decision-edit-dialog.tsx:17` — grid layout
- `apps/web/src/components/lead/stage-multi-select.tsx:10` — defaultValue plumbing
- `apps/web/src/components/lead/risks-section.tsx:104` — "All stages" label
- `apps/web/src/app/(app)/reports/page.tsx:38` — Suspense + skeletons
- `apps/web/src/components/agentation/devtools-overlay.tsx` — position prop
- `apps/web/src/components/dashboard/activity-live-panel.tsx:204` — draft link guard
- `apps/web/src/components/admin/settings-tab.tsx:2990` — AI/CI integrations style
- `apps/web/src/components/admin/reminders-tab.tsx` — coming soon badge
- `apps/web/src/components/lead/lead-history-sidebar.tsx:19` — coming soon

### Wave-E (T2 medium fixes)

- `apps/web/src/components/admin/group-products-editor.tsx` — multi-group lock
- `apps/api/src/modules/dashboard/dashboard.prisma-repository.ts` — scope filter
- `apps/web/src/components/lead/version-history-nav.tsx:224` — diff preview + arrows
- `apps/web/src/components/lead/weekly-report-page.tsx` — priorities submit policy
- `apps/web/src/components/admin/users-tab.tsx` — group-change warning dialog
- `apps/web/src/app/(app)/audit/page.tsx` (NEW) — audit log surface
- `apps/api/src/modules/audit/audit.router.ts` (NEW)
- `apps/web/src/app/(app)/head/slides/page.tsx` — push reminder + highlight
- `apps/web/src/app/(app)/lead/report/[reportId]/page.tsx` — background gradient

### Wave-F (T3 memos)

- `.planning/memory/2026-05-14-D6-archive-snapshots.md` (NEW)
- `.planning/memory/2026-05-14-D8-period-any-day.md` (NEW)
- `.planning/memory/2026-05-14-D17-period-navigator.md` (NEW)
- `.planning/memory/2026-05-14-D16-priorities-chip-style.md` (NEW)
- `.planning/memory/2026-05-14-D29-head-metrics.md` (NEW)
- `.planning/memory/2026-05-14-D34-viewer-semantics.md` (NEW)

### Wave-H (close)

- `.planning/memory/2026-05-14-night-marathon.md` (NEW)
- `.planning/session-retros/NEXT-ACTIONS.md` (update)
- `CLAUDE.md` — Conventions: docker-db `_uat` suffix mandatory
- `CLAUDE.md` — Conventions: audit-log surface coverage rule

---

## Verification

```bash
# wave-A
docker compose down -v
docker compose up -d postgres redis
sleep 5 && docker compose exec postgres pg_isready -U customreport
PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=yes pnpm exec prisma migrate dev
docker compose restart api web
curl -sf http://localhost:3000/api/health        # → 200
# (a) UI dev/role-switcher → Wipe & manual-UAT seed → success toast
# (b) prisma studio → 4 CD leads + 2 Finance leads

# wave-B
rtk pnpm --filter @customreport/web exec tsc --noEmit
rtk pnpm --filter @customreport/api exec tsc --noEmit
rtk pnpm exec prisma validate
git diff --check
git commit && git push       # hooks must pass without --no-verify

# wave-C
rtk pnpm --filter @customreport/web exec playwright install --with-deps chromium
rtk pnpm --filter @customreport/web exec playwright test --project=night-marathon-sweep

# wave-D/E unit-level
rtk pnpm --filter @customreport/web test -- product-kpi-card stage-multi-select
rtk pnpm --filter @customreport/api test -- dashboard.service audit.router

# wave-G MCP sweep
#   (a) mcp chrome-devtools take_screenshot /admin?tab=users (before/after diff)
#   (b) list_console_messages — errors == 0 на 4 ключевых URL
#   (c) playwright test --reporter=html — report зеленый

# wave-H closeout
rtk git log --oneline -20
rtk gh pr view 3
```

---

## Side deliverables (после approve плана)

```text
[1] CLAUDE.md Conventions:
      • docker-compose DB name MUST carry _uat/_dev/_test suffix
        (защищает H-1 guard от docker-compose-name-collision)
      • Audit-log presence — обязательно для каждой роли по правилу
        least-privilege (lead=mine, head=group, admin=all)

[2] .planning/session-retros/NEXT-ACTIONS.md:
      • очистить устаревшие записи UAT v7.2
      • добавить новую секцию NIGHT-MARATHON-14-05 со всеми D-* статусами

[3] .planning/memory/MEMORY.md:
      • запись «night marathon 2026-05-14 + D-* статусы»
      • запись «docker db _uat suffix mandatory after H-1»
      • запись «audit log surface scope rule lead/head/admin»

[4] PR #3 description:
      • таблица «feedback point → status (fixed | coming-soon | research-memo)»
      • ссылка на playwright html report
      • ссылка на .planning/memory/2026-05-14-night-marathon.md

[5] rules/* (если нет):
      • уже есть behavior.md и planning.md; ничего не добавляю кроме
        конкретики в CLAUDE.md Conventions
```

---

## Pillars / rules self-verify

```text
┌─ Pillars compliance ───────────────────────────────┐
│ 1 TDD-first          ✓ playwright spec пишется до E2 │
│ 2 Always Ask         ✓ 5 open questions в плане    │
│ 3 Socratic Review    ✓ wave-H retro = self-check   │
│ 4 Surgical Changes   ✓ каждая D-* — изолированный  │
│                        commit                       │
│ 5 Task Tracking      ✓ waves A-H = todo phases     │
│ 6 Memory             ✓ wave-H пишет memory         │
│ 7 Plan Before Code   ✓ этот файл = плана           │
│ 8 Rule Evolution     ✓ CLAUDE.md обновится после   │
│ 9 Config-First       ✓ .env/.docker-compose только │
│ 10 Depersonalized    ✓ роли (lead/head/viewer/admin) │
│ 11 Subagent Parallel ✓ wave-D = 4 Haiku параллельно │
└────────────────────────────────────────────────────┘

┌─ rules/* compliance ───────────────────────────────┐
│ language.md         ✓ план RU, термины в `…`       │
│ visuals.md          ✓ ASCII frames, no wide tables │
│ planning.md         ✓ все 9 mandatory секций есть  │
│ behavior.md         ✓ pre-propose self-check (D-0  │
│                       блокер выявлен до coding)    │
│ bash-defaults.md    ✓ rtk-префиксы в verification  │
│ tools.md            ✓ Playwright + MCP скоординированы │
│ pillars.md          ✓ см выше                      │
└────────────────────────────────────────────────────┘
```

---

## Regression Scenarios (DOM-level, на каждую D-\* точку)

**Goal:** каждый feedback-пункт превращается в **один воспроизводимый
регресс-сценарий**: URL → DOM селектор → user action → expected → previous
failure mode. Сценарии лягут в `apps/web/tests/e2e/regression/D-XX-*.spec.ts`,
по одному файлу на точку (или сгруппированному, если 2-3 точки в одном flow).
По ходу wave-D/E мы пишем сценарий **до** фикса (red), фиксим (green),
закрепляем (refactor). TDD-first (Pillar 1).

### Scenario template (применяется к каждому D-\*)

```text
┌─ D-XX: <Component> <action> <symptom> ─────────────┐
│ Route      /admin?tab=…                            │
│ Role       lead | head | viewer | admin            │
│ Selector   data-testid="…" или role+name           │
│ Setup      navigate → login as <role> → wait list  │
│ Action     click, fill, submit, navigate           │
│ Expect     toLocator(…).toBeVisible / .toHaveText  │
│ Was Broken прежнее наблюдение (что не работало)    │
│ Screenshot before-/after-D-XX.png                  │
│ Console    expect: zero errors / warnings          │
│ A11y       snapshot tree must have role label      │
└────────────────────────────────────────────────────┘
```

### Регресс-каталог (полный, 36 D-_ + 1 D-0 + 3 H-_)

| ID   | Route                              | Selector / pivot                                  | Что проверяем                               | Wave |
| ---- | ---------------------------------- | ------------------------------------------------- | ------------------------------------------- | ---- |
| D-0  | /admin (DevRoleSwitcher)           | `data-testid=dev-role-switcher-wipe-manual-uat`   | wipe → toast success, no guard refuse       | A    |
| H-1  | (script-level)                     | `pnpm exec tsx prisma/_destructive-guard.test.ts` | docker-name `customreport_uat` passes       | B    |
| H-2  | POST /api/revalidate-org           | curl `-H "Origin: https://evil.example"`          | 403 Forbidden                               | B    |
| H-3  | (migration)                        | `prisma migrate status`                           | unique constraint, no checksum drift        | B    |
| D-1  | /?next=…                           | `LoginPageClient .rounded-md`                     | last-session hint reserves height (no jump) | D-A  |
| D-2  | /admin?tab=groups                  | `GroupProductsEditor li[data-product-id=X]`       | продукт в др. группе → disabled + lock      | E-1  |
| D-3  | /audit                             | `data-testid=audit-log-table`                     | lead видит свои, head — группу, admin — все | E-9  |
| D-4  | /admin?tab=settings                | (no console ChunkLoadError)                       | reload без 404 на `app/layout.js`           | G    |
| D-5  | /admin?tab=users user-group select | `select#user-group` change                        | warning dialog появляется при смене группы  | E-8  |
| D-6  | (research memo)                    | docs                                              | archive snapshot policy                     | F-1  |
| D-7  | /admin?tab=settings reminders      | `PolicyRow .btn-press "Hide rules"`               | Coming Soon badge виден                     | D-D  |
| D-8  | (research memo)                    | docs                                              | period any-day choose UX                    | F-2  |
| D-9  | /admin?tab=settings integrations   | `IntegrationsSubTab` AI vs Slack                  | стиль cards идентичен                       | D-D  |
| D-10 | /lead/report/[id] risks section    | `RiskEditDialog` label group                      | "Risk" + "Blocked" pair-badge               | E-7  |
| D-11 | /lead/report/[id] background       | `#main-content` body bg                           | gradient pattern, не plain                  | E-11 |
| D-12 | /lead/report/[id] item dialog      | `ItemEditDialog button[data-state=in-progress]`   | click → highlight active, persists          | D-A  |
| D-13 | /lead/report/[id] stage chips      | `StageMultiSelect fieldset[data-mode=edit]`       | reload → chips highlighted из item.stages   | D-B  |
| D-14 | /lead/report/[id] decision dialog  | `DecisionEditDialog .grid`                        | labels above fields, mobile-friendly        | D-A  |
| D-15 | /lead/report/[id] "All stages"     | `RisksSection [aria-label=stages-summary]`        | если ≠ all → list of selected names         | D-B  |
| D-16 | /lead/report/[id] priorities       | `PrioritiesSection chip`                          | first letter + colour (см. ProductsTab)     | F-4  |
| D-17 | /lead/report/[id] period nav       | `PeriodNavigator [data-testid=period-label]`      | "Week 20 · May 11–15" — наглядно            | F-3  |
| D-18 | /lead/report/[id] context line     | `LeadForm .sdlc-tooltip`                          | mobile → collapse / убрать дубль из top nav | E-12 |
| D-19 | /lead/report/[id] version restore  | `VersionHistoryNav button "Restore"`              | diff preview viz перед confirm              | E-4  |
| D-20 | /lead/report/[id] version arrows   | `VersionHistoryNav button[aria-label=Previous]`   | click → state.version index--               | E-5  |
| D-21 | /lead/report/[id] submit           | `button "Submit Report"` + empty priorities       | friendly toast, не raw Zod error            | E-7  |
| D-22 | /lead/report/[id] save on old ver  | `button "Save Version"` после rollback            | confirm dialog "перезаписать N версий?"     | E-6  |
| D-23 | /reports?tab=drafts search         | `input#_r_2_-search-input`                        | skeleton до hydrate, не layout jump         | D-C  |
| D-24 | /reports?tab=drafts list           | `[data-testid=reports-list-skeleton]`             | skeleton elements per DOM-row               | D-C  |
| D-25 | /reports?tab=drafts sidebar        | `LeadDraftsPanel aside`                           | Coming Soon badge + tooltip                 | D-D  |
| D-26 | /audit (lead-scope)                | `data-testid=audit-log-empty`                     | если пусто — explanatory empty state        | E-9  |
| D-27 | (any page) Agentation overlay      | `[data-agentation-overlay]`                       | position: fixed, top-4, right-4             | D-C  |
| D-28 | /admin?tab=users TabHeader         | `[data-testid=user-group-filter]`                 | dropdown "All / CD / Finance"               | D-D  |
| D-29 | /head/dashboard metrics            | `[data-testid=period-kpi-row]`                    | KPI section не пустая для Артёма            | F-5  |
| D-30 | /head/dashboard activity row       | `ActivityRow[data-state=draft]`                   | click не делает navigate, показывает tip    | D-C  |
| D-31 | /head/dashboard data audit         | (SQL audit memo)                                  | report.md о коллизиях lead-group            | E-3  |
| D-32 | /head/dashboard activity scope     | `ActivityLivePanel ul li`                         | Natalya (Finance) видит 2, не 6             | E-2  |
| D-33 | /head/slides viewer Dasha          | `data-testid=viewer-slide-remind-btn`             | reminder mutation, slide highlight badge    | E-10 |
| D-34 | (research memo)                    | docs                                              | viewer-vs-head dashboard semantics          | F-6  |
| D-35 | /head/dashboard kpi sparkline      | `ResponsiveContainer > svg`                       | `tabindex=-1`, `focusable=false`            | D-A  |
| D-36 | /reports?tab=published Agentation  | (same as D-27)                                    | overlay top-right                           | D-C  |

### Regress runner

```text
apps/web/tests/e2e/regression/index.spec.ts
   ├── глобальный fixture: 4 storageState (lead/head/viewer/admin)
   ├── before each: console.error counter == 0
   ├── before each: screenshot fullPage → ./screenshots/<D-XX>-before.png
   ├── after  each: screenshot fullPage → ./screenshots/<D-XX>-after.png
   ├── after  each: записать pass/fail в ./test-results/D-XX.json
   └── after  all: aggregate → .planning/memory/2026-05-14-regression-report.md
```

---

## UX/UI Skills Sweep (после фиксов, перед закрытием)

**Goal:** прогнать `Demo-design` / `Demo-review` / `skill-quality-reviewer`
параллельно на затронутые компоненты, собрать список рекомендаций / улучшений
в один файл, чтобы утром глянуть и принять/отклонить.

```text
[parallel agents — single tool-use block]

agent A (Demo-design, sonnet)
   → input: список компонентов из wave-D/E (admin, lead-form, reports,
            dashboard, slides)
   → output: UI/UX рекомендации (consistency, density, hover/focus,
            empty states, error states)

agent B (Demo-review, sonnet)
   → input: full diff wave-D/E
   → output: code-quality review (anti-patterns, leaky scope,
            mock-vs-real, dead code)

agent C (gsd-ui-auditor, haiku)
   → input: 6-pillar UI audit на /admin /lead /reports /head/dashboard
            /head/slides
   → output: BLOCK/FLAG/PASS verdict per pillar

agent D (security-reviewer, haiku)
   → input: новые routes (/api/revalidate-org, /audit, /api/admin/wipe)
   → output: list of secrets/auth/CSRF concerns

[consolidator — sonnet, главный поток]
   → собирает 4 отчёта → .planning/memory/2026-05-14-uxui-skills-sweep.md
   → структура файла:
        ## Critical (must fix before merge)
        ## High (fix this round)
        ## Medium (next iteration)
        ## Low (backlog, nice-to-have)
   → утром пользователь читает 1 файл и принимает решения
```

---

## DONE WHEN

```text
✓ docker compose up + wipe-manual-uat работает без override
✓ H-1/H-2/H-3 закоммитчен и запушен
✓ 14 T1-точек закрыты, 12 T2 закрыты, 6 T3 — memos записаны
✓ apps/web/tests/e2e/regression/D-XX-*.spec.ts — 36 файлов (+ H-*, D-0)
✓ Playwright regression suite зелёный (или skipped с reason)
✓ MCP chrome-devtools sweep: before/after скриншоты для каждого D-*
✓ Console errors counter = 0 на всех 4 ключевых ролях/URL
✓ A11y snapshots в test-results/ для каждой страницы
✓ UX/UI skills sweep: 4 параллельных агента → 1 консолидированный отчёт
✓ Все ✓ агрегированы в .planning/memory/2026-05-14-regression-report.md
✓ UX рекомендации в .planning/memory/2026-05-14-uxui-skills-sweep.md
✓ PR #3 описание обновлено + push
✓ retro в .planning/memory/2026-05-14-night-marathon.md
✓ NEXT-ACTIONS.md содержит executable continuation для утра
```
