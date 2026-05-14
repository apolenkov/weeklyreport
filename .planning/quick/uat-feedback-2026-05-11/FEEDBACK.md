# UAT feedback — 2026-05-11

Source: live UAT session by user on PR #2 (branch `night/2026-05-11`).
User accumulating items; not implementing yet. Each item → ticket on close.

## Items

### 1. Manual period create in admin

- **Where:** `/admin?tab=periods`
- **What:** User wants to create periods manually (override cron auto-creator).
  Phase 50-B `PeriodCreatorScheduler` creates daily at 00:05 of `defaultTimezone`,
  but admin should have a button «Create period» with form: start date, end
  date, deadline, optional weekLabel.
- **Why:** Initial population of demo data; one-off catch-up periods; tenants
  with manual cadence (Phase 51-A `periodCadence` future = `monthly`).
- **Status:** OPEN — not in 51-B scope; deferred via 51-B SUMMARY open
  question «SCHEDULED → Open manual transition not exposed».
- **Propose:** Phase 50-D follow-on or quick task `manual-period-create`:
  - `admin.createPeriodManual(input)` tRPC mutation (admin-only)
  - «New period» button on `/admin?tab=periods` opening a dialog
  - Reuse `business-date.computeDeadline` helper from 50-C
  - Audit `period.manualCreate` envelope

### 2. Pagination in Admin → Actions

- **Where:** `/admin?tab=actions`
- **What:** No pagination — full list dumps to DOM.
- **Risk:** With audit log growing, page bloats / browser stalls.
- **Status:** OPEN.
- **Propose:** quick task `admin-actions-pagination`:
  - Standard cursor-based pagination (already in tRPC `paginationInputSchema`)
  - Page size 50, infinite-scroll OR «Load more» button
  - Same pattern as 51-B periods archive
- **Risk register entry:** ▲ medium — audit log is the largest table by row
  count after a few months.

### 3. Audit pagination across other admin tabs

- **Where:** any admin tab listing >50 rows
- **What:** Same as #2 — apply pagination uniformly.
- **Status:** sweep required.
- **Propose:** quick task `admin-pagination-sweep`:
  - List every admin list view (Users, Groups, Products, Reminders, Reopen, Jobs, Actions, Settings — Settings has no list)
  - For each, check row-count expectation + add pagination if uncapped
  - Standard component / hook so we don't re-roll per tab

### 5. «Slow head dashboard» — diagnosed: NOT perf, functional 404 bug

- **Where:** `/head/dashboard` cold load
- **User report:** «долго грузится всё», «долго грузится роль head»
- **Investigation (chrome-devtools MCP perf trace + network panel 2026-05-11):**
  - LCP: 431ms (good, target <2500ms)
  - TTFB: 363ms (dev mode Turbopack, acceptable)
  - CLS: 0.00 (excellent)
- **Actual root cause — 4 endpoints fail:**

  ```
  GET /trpc/review.dashboard,archive.list,weeklyReport.get,dev.listUsers,auth.me  → 207 Multi-Status
  GET /trpc/weeklyReport.get          → 404 ✗ (retry 1)
  GET /trpc/weeklyReport.get          → 404 ✗ (retry 2)
  GET /trpc/weeklyReport.get          → 404 ✗ (retry 3)
  POST /api/client-logs                → 404 ✗
  ```

- **Why it feels slow:** React Query default `retry: 3` on failed tRPC procedure → 3 sequential retries with exponential backoff → 3-5 seconds of loading state UI before final failure rendered.
- **Real bug:** `weeklyReport.get({})` returns 404 when no current Period row exists. Phase 50-B `PeriodCreatorScheduler` is cron-daily (00:05) and hasn't run on this dev DB yet, so no period for «current week» exists.
- **Compounded by:** UAT feedback item #1 (no manual period create) — there's no admin escape hatch to seed a period on a fresh DB without waiting for the cron.
- **Trace artefact:** `.planning/quick/uat-feedback-2026-05-11/perf-head-dashboard.json`
- **Status:** OPEN — ▲ HIGH priority (user-blocking on cold envs)
- **Propose fix sequence:**
  1. **Immediate** — `admin.createPeriodManual` mutation (closes item #1 + this) so admin can seed a period on fresh DB
  2. **Robust** — `weeklyReport.get` should auto-create a draft Period for the current cadence-aligned week if none exists, OR return `{ status: 'pending', message: 'No active period — schedule will create one at next tick' }` instead of 404. This makes the loading-state graceful.
  3. **UI** — head dashboard renders a clear «No active period yet — admin can create one» empty state when `weeklyReport.get` returns the pending/empty shape. Today the 404 + retries leave the user staring at a spinner with no feedback.
  4. **React Query config** — set `retry: 0` (or `retry: (failureCount, err) => err.statusCode !== 404`) for `weeklyReport.get` so 404 short-circuits instead of retrying.
  5. **Audit:** verify `dev.listUsers` (in batch) — likely the cause of the 207 partial status. Either it 404s in real-auth mode (only AUTH_STUB exposes it) or the role-gate is misfiring.
  6. **Client-logs 404** — separate small bug, the dev-mode client-logger POST endpoint doesn't exist on api. Either remove the call or add the endpoint.

### 6. Top nav-bar skeleton on reload (FOUC fix)

- **Where:** every app page, top nav-bar on cold reload
- **Symptom:** «моргает и не очень правильное моргание» — nav-bar flashes / pops in after session/auth hydration
- **Cause hypothesis:**
  - `useSession()` hook reads tRPC `auth.me` which resolves async after first paint
  - Until session resolves, the nav-bar either renders empty or with default placeholder, then re-renders with user info → visible flash
  - Phase 35 added some skeleton handling but the top nav-bar slot may not have been included
- **Status:** OPEN — low-effort visual polish.
- **Propose:** quick task `nav-bar-skeleton`:
  - Add a `<NavBarSkeleton>` placeholder rendering at same height (e.g. 56px) with greyed-out segments for logo / nav links / user pill
  - In `app-shell.tsx` (or wherever `<NavBar>` mounts), wrap with `<Suspense fallback={<NavBarSkeleton />}>` OR conditionally render skeleton while `sessionQ.isLoading`
  - Use existing shimmer classes from Phase 35 if any (`animate-pulse` from Tailwind)
  - Keep DOM structure stable: same width/height as real nav, no layout shift on swap (CLS budget)
- **Priority:** ▼ medium — cosmetic but user-visible. Pair with #5 fix (404 retries also contribute to flash).

### 7. Period cadence → length-based universal model

- **Where:** `/admin?tab=settings` → Periods sub-tab → «Period cadence» field
- **What's wrong:** schema has TWO fields that mean the same thing:
  - `periodLengthDays: Int @default(7)` — generic length in days (Phase 50-A wired)
  - `periodCadence: enum('weekly' | 'bi-weekly')` — preset bucket (Phase 51-A persist-only)
  - Result: a custom 10-day or 30-day cadence is **unrepresentable** today. User has to pick weekly or bi-weekly even though periodLengthDays accepts any integer.
- **User quote:** «Если у меня период 10 дней, или у некоторых месячный, а у нас вот недельный — надо подумать про универсальность».
- **Proposed redesign (UFB-068):**
  - Drop `periodCadence` enum entirely (or make it `'custom'` only as label)
  - Settings UI replaces the radio with a numeric input «Period length (days)» + presets sidebar:
    - 7 = Weekly
    - 14 = Bi-weekly
    - 30 = Monthly (~)
    - 90 = Quarterly (~)
  - Period creator scheduler reads `periodLengthDays` only (already does — `periodCadence` was never consumed)
  - Per-tenant deployment can set any integer 1-365
  - Cadence-neutral UI copy (already partially done in UFB-062 sweep)
- **Status:** OPEN — schema migration needed (drop or deprecate `periodCadence`)
- **Priority:** ▲ medium — blocks tenants who need 10-day / 30-day cadences
- **Risk:** ▼ low — `periodCadence` has zero consumers in code (verified by UFB-062 audit). Safe drop.
- **Propose:** Phase 51-D or UFB-068 quick task:
  1. Migration: drop `AppSettings.periodCadence` column (or rename to `_legacy_periodCadence` for one release for safety)
  2. Settings UI: replace radio with `<input type="number" min="1" max="365">` + preset chips
  3. Schema test: remove cadence enum from Zod
  4. Verify scheduler still creates periods correctly with custom length (e.g. 10)
  5. UFB-062 follow-on: re-sweep «weekly/bi-weekly» UI copy that referenced the cadence radio

### 8. Eliminate brand skeleton — SSR org identity

- **Where:** every page top nav-bar
- **User quote:** «нам бы статику для топ-меню сделать, как admin sub-tabs которые мгновенно из URL рендерятся... может хэши какие-нибудь»
- **Today (post-UFB-066):** brand pill shows skeleton while `useSession()` query in-flight → swap to real PEO. Skeleton is zero-CLS but still visible for ~100-300ms cold.
- **Root cause:** organization identity comes via tRPC `auth.me` which is a client-only React Query. Server has the info (cookie → session → org cache 60s TTL in trpc.context.ts) but doesn't pass it to the SSR render.
- **Proposed fix (UFB-070):**
  - In `app/(app)/layout.tsx`: server-side read session cookie → fetch org (cache-hit from in-process LRU since 60s TTL) → pass `organization` as prop to NavBar via React Server Component.
  - NavBar becomes a Server Component that pre-renders the brand pill with real values; client hydration uses the same values via useSession() so first paint matches final paint exactly.
  - Skeleton path stays for the unauthenticated case (`/` landing) — there session.organization can legitimately be null until query resolves.
- **Cache invalidation idea (per user «может хэши»):**
  - Add ETag header on `org.getPublic` derived from `organization.updatedAt` hash
  - Client sends If-None-Match; server returns 304 if unchanged
  - Combined with the existing 60s in-process cache: even cross-tab navigation gets sub-1ms hits.
- **Status:** OPEN — Next.js 16 RSC migration touch.
- **Priority:** ▼ medium — current skeleton is already non-jarring, but server-render would be the gold standard.
- **Risk:** ▼ low — additive, falls back to skeleton if SSR fails.

### 9. Landing — remember last role hint

- **Where:** `/` (landing, AUTH_STUB mode)
- **User quote:** «Та роль, которая была последней — запоминать её, и в footer лендинга показывать "ты типа под этой ролью заходишь, если надо — поменяй"».
- **Today:** dev-stub login always defaults to admin. User has to switch role from DevRoleSwitcher post-login.
- **Proposed (UFB-071):**
  - On successful dev-login, write `lastRole` to localStorage (or cookie if SSR-friendly)
  - On landing page: read `lastRole` if present
  - Below the «Enter Application» CTA: small grey text «Last session: {Role} · change role» where «change role» is a button revealing a role picker
  - One-click: go to `/auth/dev-login?role={lastRole}&email={lastEmail}` to re-enter same role
  - If no `lastRole` saved: fall back to current «default role: admin» message
- **Status:** OPEN — landing polish.
- **Priority:** ▼ medium — UX nice-to-have for repeat UAT sessions.
- **Risk:** ▼ low — localStorage only, fully reversible.

### 10. Lead form — pre-select all owned stages by default

- **Where:** lead form (`/lead/report`), Item/Risk/Decision/Priority creation
- **User quote:** «Когда я заполняю лидом все эти айтемы, наверное, по умолчанию нужно включать все стадии, на которые меня записали. Чтобы я постоянно их не выбирал».
- **Today:** lead must explicitly pick the stage(s) for each new entry from the dropdown / checkboxes, even though their `StageAssignment[]` already lists which stages they own on this product.
- **Proposed (UFB-073):**
  - When the lead opens the «New item» (or risk/decision/priority) dialog, the stage selector should pre-check **all** stages from the lead's `ownedStages` for the current Project
  - User can de-select any if the item is stage-specific; default = «applies to all my stages»
  - If lead owns only 1 stage → pre-select that one and hide the picker entirely (no choice → no UI)
- **Source data:** `report.section.projects[].ownedStages[]` (already in the read model, line `app/api/.../report.ts` near ReportSectionReadModel)
- **Status:** OPEN
- **Priority:** ▼ medium — UX speed-up for lead workflow
- **Risk:** ▼ low — purely default-value change; lead can still de-select

### 4. CI integration in Settings → Integrations

- **Where:** `/admin?tab=settings` → sub-tab `Integrations` (already exists for Phase 55 Telegram badge)
- **What:** Add a third integration row for CI (build status / pipeline URLs / deploy tokens).
- **Why:** Same scaffolding pattern as Phase 55 — abstract adapter + Settings UI row + status badge.
- **Fields needed (initial guess):**
  - CI provider type (`gitlab` | `github` | `jenkins` | `none`)
  - Base URL (`https://gitlab.example/api/v4` or similar)
  - Access token (write-only, masked in UI like SMTP_PASSWORD pattern)
  - Project ID / repo slug
  - Optional: webhook secret for inbound build events
- **Status:** OPEN — seeds-only phase like Phase 55.
- **Propose:** Phase 60 `ci-integration` stub or quick task scaffolding:
  - `CiAdapter` interface + `MockCiAdapter` (returns hardcoded build status)
  - `CiBinding` schema: `{ provider, baseUrl, token, projectSlug }`
  - Settings UI row in Integrations sub-tab («GitLab CI», status badge)
  - tRPC `admin.testCiConnection({ provider, baseUrl, token })` proves wiring
  - TODO(Phase-60-activation) per CLAUDE.md TODO discipline
  - Real provider activation deferred until token + URL provided

## Next-action queue (when UAT pause)

1. Triage items into proper tickets (Phase number or quick task)
2. Decide priority order: ▲ #2 (audit log bloat is real) → ▼ #1 (manual create
   is nice-to-have, scheduler works) → ▲ #3 (cross-tab sweep depends on #2 pattern)
3. Implement in order

## Notes

User is mid-session — keep adding items below as he reports. When session
pauses, run through triage and convert to commits.
