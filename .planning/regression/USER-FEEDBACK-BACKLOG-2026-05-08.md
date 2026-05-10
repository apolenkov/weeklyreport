# User Feedback Backlog - 2026-05-08

Purpose: preserve the current-session UAT findings as executable work, so the
next regression pass does not rediscover the same gaps from chat/screenshots.

## Priority Map

```text
▲ P0
  UFB-001 admin product stage reassignment does not replace assignee
  UFB-002 reporting scope must use StageAssignment, not Product.owner
  UFB-003 submit validation must ignore products/stages not assigned to author
  UFB-004 unauthenticated pages must redirect to landing/login, not skeleton hang

  P1
  UFB-010 empty products muted/collapsed/non-expandable in weekly report
  UFB-011 weekly/head layouts need top spacing; no header/content merging
  UFB-012 remove misleading Collapse/Toggle controls when content is empty
  UFB-013 Activity This Period vs Lead Reports duplicated semantics
  UFB-014 current/next/risk/decision/priority items need optional multi-SDLC stages
  UFB-015 author/owner fields in modals must be read-only/defaulted
  UFB-016 admin settings must model reporting groups cleanly
  UFB-017 all list forms need search
  UFB-018 reminders tab must expose real configuration, not only queue/status
  UFB-019 Action Log must be understandable and useful for support/debug
  UFB-020 logs must capture Unexpected error with cause/correlation id

▼ P2
  UFB-030 base wipe mode for manual UAT
  UFB-031 Grafana/Prometheus/logging onboarding docs and dashboard links
  UFB-032 richer background/surface tokens and UI review batch
```

## Items

### UFB-001 - Admin stage reassignment

Status: done

User signal:

```text
/admin?tab=products
DevOps-инструменты
Testing: changing Igor -> Maria does not update
Check logs and Action Log
```

Implementation:

```text
StageAssignment unique key:
old: userId + stageId + projectId
new: stageId + projectId

saveStageAssignment:
replace userId for existing project/stage row
```

Regression:

```text
apps/web/e2e/regression/admin-stage-reassignment.spec.ts
.planning/regression/evidence/2026-05-08-admin-stage-reassignment/README.md
.planning/regression/evidence/2026-05-08-admin-groups-stage-reassignment/README.md
```

### UFB-002 - Reporting scope source of truth

Status: done

Rule:

```text
Report forms and submit validation use StageAssignment.
Product owner is metadata/future notification target only.
```

Regression needed:

```text
lead author sees only products/stages assigned by StageAssignment
owner-only product is not required for submit
head report can show owner metadata without expanding author scope
```

Regression/evidence:

```text
apps/api/src/modules/report-sections/report-sections.integration.test.ts
  getSectionById excludes product-owner projects without StageAssignment
  submitSection ignores product-owner projects without StageAssignment

apps/api/src/modules/report-sections/report-sections.service.test.ts
  submits by read-model scope and does not require owner-only projects

.planning/regression/evidence/2026-05-08-reporting-scope-submit/README.md
```

### UFB-003 - Submit validation by assigned stage only

Status: done

Bug class:

```text
User with no assigned stages on a product should not be blocked by that product.
At-risk/blocked validation applies only to assigned stages in author scope.
```

Regression needed:

```text
lead with DevOps stages only submits without Security Gateway content
stage status/risk validation ignores unassigned products
```

Current:

```text
Unit regression PASS: submit validation uses read-model project scope only.
Integration regression PASS: product-owner-only project does not block submit.
```

### UFB-004 - Auth/no-cookie redirect

Status: done

Bug class:

```text
/head/dashboard without valid cookie can hang on skeleton.
Expected: landing/login/dev-login flow, not infinite loading.
```

Regression needed:

```text
empty browser context -> /head/dashboard -> redirected or actionable auth state
no long-lived skeleton after request failure
```

Implementation/evidence:

```text
apps/web/src/proxy.ts
  dev stub no longer bypasses protected routes without session cookie

apps/web/proxy.test.ts
  redirects no-cookie protected pages even when NEXT_PUBLIC_AUTH_STUB=true

.planning/regression/evidence/2026-05-08-auth-no-cookie-redirect/README.md
```

### UFB-010 - Empty products visual behavior

Status: partially_done_needs_live_verification

Rule:

```text
No content product:
muted grey card
collapsed by default
not expandable
no hover jump under section header
```

Regression needed:

```text
weekly report portfolio overview with empty products
assert no expand affordance / disabled state
assert stable bounding boxes on hover
```

### UFB-011 - Layout top spacing

Status: open

Screens/user signal:

```text
Content sticks to header/top in head/report and weekly report views.
Cards/sections need consistent top offset.
```

Regression needed:

```text
visual bounding-box assertions:
section top >= header bottom + token spacing
modal/content controls do not overlap
```

### UFB-012 - Collapse/Toggle controls

Status: open

Rule:

```text
Do not show Collapse all / Toggle all when there is nothing meaningful to expand.
If all products are empty, control is hidden or disabled with clear semantics.
```

### UFB-013 - Dashboard sections semantics

Status: open

Decision needed:

```text
Activity This Period -> Submission Activity
Lead Reports -> Reports With Content
Avoid two sections linking to the same empty form.
```

### UFB-014 - SDLC stage selection on report items

Status: open

Rule:

```text
Current Week, Next Week, Risks, Decisions, Priorities:
stage selection optional
if omitted -> applies to all relevant stages
if selected -> allow multi-select and display selected stage chips
```

### UFB-015 - Modal author/owner fields

Status: open

Rule:

```text
Owner/author is derived from current user or directory.
Do not free-text edit author fields in item/risk/decision modals.
```

### UFB-016 - Admin reporting groups/departments

Status: done

Rule:

```text
Use product term: groups.
Admin must have a Groups form/list to create and maintain groups.
Users must choose from existing groups; no free-text department input.
Head is scoped to one group unless multi-group access is explicitly added later.
Settings should not hard-code CustomReport copy.
```

Implementation/evidence:

```text
Prisma model: ReportingGroup
Admin tab: /admin?tab=groups
Users tab: group select from existing groups, no free-text department field
Settings tab: report header defaults only
Regression: apps/web/e2e/regression/admin-groups.spec.ts
Evidence: .planning/regression/evidence/2026-05-08-admin-groups-stage-reassignment/README.md
```

### UFB-017 - Search everywhere lists exist

Status: partially_done

Known:

```text
Products had search.
Users/reminders/jobs/actions were updated recently.
Need verify all current and future list surfaces.
```

### UFB-018 - Reminders config

Status: partially_done

Bug class:

```text
/admin?tab=reminders showed no real configuration.
Dashboard reminder action complained: No active reminder rule for this period.
```

Regression needed:

```text
create active reminder rule
dispatch reminder for current period
queue row / action log visible
no misleading empty config
```

Current:

```text
/admin?tab=reminders now exposes Add Rule form, report period selector, type, fireAt, timezone, active/paused rules, search.
Remaining gap: full dispatch/queue/action-log regression for dashboard Send Reminder.
```

### UFB-019 - Action Log clarity

Status: partially_done

Rule:

```text
Show user actions with procedure/status/reference.
Hide internal proof calls.
Make labels understandable for support.
```

Regression needed:

```text
admin.saveStageAssignment mutation appears after stage change
admin.updateSettings appears after settings save
manual-action-log-proof rows hidden
```

### UFB-020 - Log coverage for Unexpected error

Status: partially_done_needs_audit

Rule:

```text
Frontend error toast/log must carry correlation id.
Backend tRPC error logs must include cause code/meta without leaking payloads.
```

Regression needed:

```text
force weeklyReport.get failure
assert UI reference id
assert backend log has procedure + cause + correlationId
```

### UFB-030 - Base wipe mode

Status: done

Rule:

```text
Manual UAT wipe preserves:
users, roles, products, stages, group/settings

Manual UAT wipe clears:
reports, report sections, content items, risks, decisions, priorities,
and possibly StageAssignment depending on chosen demo/base variant
```

Decision:

```text
base-empty should clear StageAssignment
demo-ready can keep StageAssignment
User decision 2026-05-08: base-empty clears StageAssignment.
```

Implementation:

```text
prisma/wipe-manual-uat.ts deletes stageAssignments and preserves users/products/stages/settings.
```

### UFB-031 - Observability docs

Status: in_progress

Rule:

```text
README/onboarding must explain:
Grafana login/password
dashboard URLs
Prometheus metrics URL
logs location
how to debug failed weekly report load
```

### UFB-032 - UI background/surface tokens

Status: open

Rule:

```text
Make background calmer but richer than flat beige.
Use surface tokens, not ad-hoc one-off colors.
Run design review against screenshots and domain workflows.
```

Skill/review sources:

```text
.planning/regression/UI-REVIEW-2026-05-07.md
.planning/reports/UI-REVIEW-2026-05-07.md
.planning/phases/17-ui-redesign/17-UI-REVIEW.md
.planning/phases/39-performance/39-UI-REVIEW.md
.planning/regression/UI-UX-FULL-REVIEW-PLAN-2026-05-08.md
requested skills:
frontend-design
bencium-controlled-ux-designer
ui-ux-pro-max:ckm:design
ui-ux-pro-max:ckm:ui-styling
design-audit
gsd-ui-review
security-audit
typography:ui-typography
ui-ux-pro-max:ui-ux-pro-max
web-design-guidelines
```

Current review lanes:

```text
.planning/regression/review-lanes/2026-05-08-ui-design-lane.md
.planning/regression/review-lanes/2026-05-08-ui-styling-typography-lane.md
.planning/regression/review-lanes/2026-05-08-security-accessibility-lane.md
```

### UFB-021 - Landing: вернуть combobox-default-admin

Status: open
Date: 2026-05-09
Source: user feedback (chat, screenshot of broken PEO overlap)

Problem:

- Текущий лендинг (commit bc180ffa, Phase 35-08 UX-16) рендерит PEO brand
  panel слева + grid из 9 dev-login карточек справа.
- Right panel: `w-full` без `lg:flex-1` когда `showDevPicker=true` →
  накрывает PEO panel на узких viewport (визуальный bug).
- User: "раньше был прекрасный комбобокс. По умолчанию входили под админа,
  потом выбирали роль. Зачем нужно было что-то делать?"

Желаемое поведение:

- Один primary CTA "Войти как Admin" (по умолчанию) → /auth/dev-login?role=admin.
- Дополнительный role-selector (combobox / dropdown) для смены роли:
  head | admin | viewer | lead.
- Убрать grid 9 пользователей с лендинга (он рос с числом seed users).

Files:

- apps/web/src/app/page.tsx (DevLoginGrid → DevLoginCombobox)

### UFB-022 - Admin role: только admin меню

Status: open
Date: 2026-05-09
Source: user feedback (chat)

Problem:

- В page.tsx:38 admin редиректится на `/head/dashboard`.
- Admin-роль видит nav-bar Dashboard + Weekly Report + Reports + Lead etc.
- User: "роли админа нужны только одно меню — связанное с администрированием".

Желаемое поведение:

- DEFAULT_FOR_ROLE.admin → '/admin' (не /head/dashboard).
- Nav для admin: только /admin (с табами users/products/periods/...).
- Убрать Dashboard / Weekly Report / Reports links для admin role.

Files:

- apps/web/src/app/page.tsx — DEFAULT_FOR_ROLE.admin
- apps/web/src/components/navigation/nav-bar.tsx — фильтрация по role

### UFB-023 - Подтверждено: 4 роли

Status: confirmed (no action)
Roles: head | admin | viewer | lead

Совпадает с current code (DEFAULT_FOR_ROLE, Role type, ROLE_ORDER).

### UFB-024 - SC-16-02 theme toggle SKIPPED не BLOCKED

Status: open
Date: 2026-05-09
Source: user feedback (chat)

Problem:

- SC-16-02 theme toggle visual behavior сейчас рапортует BLOCKED.
- Decision: theme toggle не нужен (user explicit).
- BLOCKED означает "не смогли проверить" — вводит в заблуждение,
  будто фича planned-but-deferred.

Желаемое:

- Заменить status="BLOCKED" → status="SKIPPED" с reason
  "product decision: no theme toggle".
- Update в `apps/web/e2e/regression/phase16-17-uat.spec.ts` SC-16-02 logic
  - uat-live-results.json.

### UFB-025 - Admin: вкладка Groups/Departments (ведение групп = департаментов)

Status: open
Date: 2026-05-09
Source: user (chat)

Sentence: "У админа должна быть панель ещё, какие группы есть. Ведение групп равно департаменту по сути."

Action:

- Добавить admin tab "Groups" (или "Departments") в админку.
- Sidebar nav (ReopenTab/PeriodsTab pattern).
- CRUD: создание / переименование / удаление группы.
- Связать с пользователем: каждый user → одна группа.

### UFB-026 - Admin tabs: единый стандарт layout (Users / Groups / Products / Periods / Reopen)

Status: open
Date: 2026-05-09

Problem: tab-к-tab расхождение:

- Users vs Products: search bar и счётчик строк находятся в разных местах.
- Periods: по аналогии не стандартизирован.
- Reopen: search отсутствует.

Action: один tab-template для всех админских вкладок.

- header layout: title + count + search bar (порядок одинаковый везде).
- table column conventions (id, name, status, ts, actions) — same.
- toolbar (Add new + filter chips) — same position.

### UFB-027 - Logout button missing / должен возвращать на лендинг

Status: open
Date: 2026-05-09
Source: user (chat)

Problem: "не вижу кнопочки Logout, которая будет меня выводить на лендинг".

Action:

- Logout кнопка в nav-bar (рядом с user identity).
- Click → POST /auth/logout → cookie cleared → redirect /.
- На лендинге useEffect `if (!session)` показывает CTA снова.

### UFB-028 - Reset DB: полный wipe для чистого UAT

Status: open
Date: 2026-05-09
Source: user (chat)

Sentence: "Я хочу, чтобы wipe данных полностью перетирал, в том числе админские штуки, логи, аудиты. Нужна нулёвая база. Как иначе тестировать?"

Action:

- `pnpm db:reset:hard` script.
- Drops/truncates every table (Report, ReportSection, ItemEntry, Risk, Decision,
  Priority, ReminderRule, ReminderExecution, ReopenRequest, AuditLog, JobLog,
  User, StageAssignment, Period, Product, etc.).
- Затем re-runs migrations + db:seed:simple.
- Single command, no manual psql.

### UFB-029 - Admin: Settings page header standard

Status: open
Date: 2026-05-09
Source: user (chat)

Problem: на странице `/admin?tab=settings` отсутствует стандартный header / section title как на других admin вкладках (Sections example).

Action:

- Audit всех admin tabs (`SettingsTab`, `UsersTab`, `ProductsTab`, `PeriodsTab`,
  `RemindersTab`, `ReopenTab`, `JobsTab`).
- Добавить единый `TabHeader` компонент: title + description + actions.
- Применить на каждой вкладке.

## Closure log — 2026-05-10

| UFB     | Status              | Closing commit / note                                                                                                                                                     |
| ------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UFB-012 | done                | lead-form Toggle All hidden when every items/risks/decisions/priorities list is empty (lead-form.tsx:1183)                                                                |
| UFB-013 | done                | "Activity This Period" already renamed to "Submission Activity" in 35-08; LeadReportsGrid + LeadReportCard removed as dead code (no longer mounted in dashboard-page.tsx) |
| UFB-015 | confirmed-no-change | decision-edit-dialog owner is readOnly + aria-readonly; item-edit-dialog author auto-derived from currentUserName, no free-text input                                     |
| UFB-019 | done                | action-log-tab humanizeProcedure + statusLabel (06e306e)                                                                                                                  |
| UFB-020 | done                | action-log-tab CorrelationCell with copy-to-clipboard (06e306e)                                                                                                           |
| UFB-021 | done                | landing single CTA (4fcff57)                                                                                                                                              |
| UFB-022 | done                | admin nav isolation (4fcff57)                                                                                                                                             |
| UFB-024 | done                | SC-16-02 SKIPPED status (4fcff57)                                                                                                                                         |
| UFB-025 | done                | groups-tab exists + standardized via TabHeader (6a1c057)                                                                                                                  |
| UFB-026 | done                | unified TabHeader across 9 admin tabs (6a1c057)                                                                                                                           |
| UFB-027 | done                | nav Logout button (e359202)                                                                                                                                               |
| UFB-028 | done                | pnpm db:reset:hard (e359202)                                                                                                                                              |
| UFB-029 | done                | settings-tab TabHeader (6a1c057)                                                                                                                                          |
| UFB-030 | subsumed            | covered by UFB-028 (db:reset:hard already wipes audit + jobs)                                                                                                             |
| UFB-031 | done                | docs/OBSERVABILITY-ONBOARDING.md (06e306e)                                                                                                                                |
| TOOL-01 | done                | next-env.d.ts auto-fixed by Next.js dev server back to .next baseline                                                                                                     |

Outstanding:

- UFB-010 (empty products visual reg) — needs live screenshot/baseline
- UFB-011 (top spacing) — needs visual targets
- UFB-016 (admin reporting groups schema audit) — partial via UFB-025 base; full schema review pending
- UFB-017 (search-on-list) — covered for admin via TabSearch + lead history existing search; full inventory pending
- UFB-032 (UI background tokens) — needs design spec
- TOOL-02 (48 leaf-fix regression) — backlog, individual triage

## Closure log — 2026-05-10 (cont.)

| UFB     | Status              | Closing commit / note                                                                                                                                                                                                                                                                                    |
| ------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UFB-010 | confirmed-no-change | portfolio-overview-table empty-product behaviour already meets the rule: muted EMPTY_CARD_BG, disabled+aria-disabled, cursor-default, no hover-shadow, no expand affordance                                                                                                                              |
| UFB-011 | needs-evidence      | NavBar is non-sticky; head/report wrapper has py-6 above weekly-report-page space-y-4. No reproducible top-spacing collision in current layout — leave open until a new screenshot surfaces a real overlap                                                                                               |
| UFB-016 | done-prior          | groups admin tab exists, ReportingGroup Prisma model in place, regression spec at apps/web/e2e/regression/admin-groups.spec.ts                                                                                                                                                                           |
| UFB-017 | done                | every list surface has search: admin tabs (TabSearch via 6a1c057), /reports archive (SearchInput in reports/page.tsx), /lead/history sidebar (SearchInput). Print + trends pages have no list to search.                                                                                                 |
| UFB-032 | partial-done        | Two highest-frequency ad-hoc surfaces consolidated into tokens — `--color-surface-hover` (66 callsites of `bg-[#f8f6f2]`) and `--color-surface-empty` (7 callsites of `bg-[#fafaf7]`). Long tail of one-off colours (#fef3c7, #fee2e2, #d4a017, etc.) intentionally left for the next dedicated UI-pass. |

---

## New ideas — 2026-05-10 (post-wave-5 session)

### UFB-041 - Head presentation mode (slide deck of lead sections)

Status: idea / future phase

User signal:

```text
"У хэда должен быть режим презентации, красивый. Каждый слайд — отчёт
лида. Можно пройти по аналогии с PowerPoint, на всю страницу развернуть
и показать презентацию отчёта."
```

Shape:

- Trigger: button in `/head/dashboard` или `/head/report` → "Present"
- Fullscreen mode (no navbar / no shell), one section per slide
- Keyboard navigation: arrows / space / Esc to exit
- Slide order: same as section order in dashboard (alphabetical by lead name?
  or by traffic-light severity?)
- Slide content:
  - Lead name + photo / avatar
  - Project status grid (traffic lights)
  - Current week items
  - Risks / decisions / priorities highlights
- Optional: auto-advance every N seconds for kiosk-mode display
- Out of scope for v1: animations, transitions, custom themes, exporting
  to .pptx

Implementation hints:

- Existing `/head/report/[reportId]/print` route already renders all sections
  on one page — can fork into `/head/report/[reportId]/present` with the
  same data fetch but per-section pagination + fullscreen API
- Use `requestFullscreen()` + `keydown` listener
- shadcn `Carousel` or react-swipeable as the slide engine

Phase candidate: **Phase 47 — Head Presentation Mode** (UI-only, ~5 plans).
Depends on: nothing structural (data already in dashboard).

### UFB-040 - Group-scope visibility (head sees all; viewer sees all)

Status: planned (Phase 46 — see `.planning/phases/46-group-scope-visibility/`)

Already captured in roadmap. Mention here so backlog reads complete.

### UFB-039 - Reporting groups need leaders + viewer access M:M

Status: done

- Schema: f10857a (ReportingGroup.headUserId + ViewerGroupAccess)
- UI: 082c4aa (Leader dropdown in Groups tab)

### UFB-038 - head ≠ admin role separation

Status: done — a94a482 (D-AUTH-03 retired, 27 admin endpoints switched to
adminProcedure, /admin layout REQUIRED=['admin'], nav-bar.tsx admin tab
admin-only).

### UFB-037 - Demo seed: 8 reporting periods + Russian lead names

Status: done — d5f97b0 (Тимлид 1 → Василий И., 4 historical published
periods + 2 future open periods + existing 2 = 8 total).

### UFB-036 - Reminder rules per-period model is unusable

Status: planned (Phase 44 — see `.planning/phases/44-reminder-policies/`)

### UFB-035 - Timezone select for reminder rule editor

Status: done — 301f366 (TIMEZONE_OPTIONS curated list, Russia + EU + APAC
zones in `<optgroup>`s).

### UFB-034 - Dev-login per-role redirect map out of sync

Status: done — 8774e53 (head → /head/dashboard, viewer → /reports?tab=published).

### UFB-033 - Landing infinite reload loop in AUTH_STUB mode

Status: done — 0f8ef8f (disable auto-redirect in stub mode, CTA is the only
explicit path).
