# Tasks

Gates after every code step: `pnpm typecheck && pnpm lint && pnpm test`, then a
sweep re-run (`pnpm test:uat`) after any change that touches a swept surface.

> **Status (2026-06-07).** Triage done: 621 anomalies clustered to ~11 findings
> (see `proposal.md`). React cluster (§1) FIXED + verified by sweep re-run
> (duplicate-key 226→0, hydration pageerror 1→0; totals 621→394). a11y (§2) and
> the Agentation noise source (§3) are next. User approved React→a11y; contrast
> deferred; PR not opened.

## 1. React runtime correctness — DONE (verified by sweep re-run)

- [x] 1.1 Duplicate-`key` source confirmed = `key={p.rank}` over
      `report.priorities` (ranks repeat across a merged report). Fixed in
      `product-accordion.tsx` and `app/print/[reportId]/page.tsx` with a
      `${rank}-${index}` key. (`status-slide-deck:172` was a red herring — its
      key would include `0`; the reported keys were 1/2/3.)
- [x] 1.2 Regression test: `product-accordion.test.tsx` renders duplicate-rank
      priorities and asserts no "same key" console error + all items render.
- [x] 1.3 Hydration mismatch fixed: `lead-section-preview-auth.tsx` loading
      branch rendered a bespoke inline skeleton that diverged from the page's
      `<Suspense fallback={<WeeklyReportSkeleton/>}>`. Now renders the same
      `WeeklyReportSkeleton`. Test: `lead-section-preview-auth.test.tsx`.
- [x] 1.4 Sweep re-run confirmed: zero duplicate-`key`, zero hydration pageerror
      across all 4 roles.

## 2. a11y (axe)

> **MAJOR REFRAME (2026-06-07).** Axe node-selector capture (§3.1) proved the
> systemic ×49 rules were NOT the product shell. `button-name`, `label`,
> `link-name`, `nested-interactive`, and `region`/canvas — 245 of ~290 axe
> findings — were ALL the Agentation dev-tools widget (`.styles-module__*`
> classes from `agentation@3.0.2`), which renders only because the sweep ran
> `next dev`. Fixed at source by disabling devtools in the sweep (§3) →
> `.styles-module__*` findings 245→0. The original 2.1/2.2 "fix the shared
> nav/shell" plan was a false trail; do NOT chase it.

The genuine product a11y findings (after the devtools artifacts are gone):

- [x] 2.1 `scrollable-region-focusable` (2, serious) — the lead current/next-week
      scroll containers (`max-h-[420px] overflow-y-auto`) were not keyboard
      focusable. Added `tabIndex={0}` + `role="group"` + `aria-label` (with a
      documented `eslint-disable` for the jsx-a11y vs axe rule conflict).
- [x] 2.2 `aria-hidden-focus` (1–4, serious) — the dashboard KPI sparkline wraps
      a Recharts chart in `aria-hidden`; Recharts injected a focusable keyboard
      layer. Added `accessibilityLayer={false}`.
- [x] 2.3 `page-has-heading-one` (4, moderate) — NOT 4 distinct routes: it is the
      single `/` landing route seen by 4 roles (one component). The landing brand
      is the graphical PulseMark wordmark with no semantic heading. Fixed
      2026-06-07: added an `sr-only` `<h1>` as the first child of `<main>` in
      `login-page.client.tsx` + a test asserting exactly one level-one heading.
      Verified live: sweep `page-has-heading-one` 4→0.
- [ ] 2.4 `color-contrast` (41, serious) — DEFERRED (theme-token work,
      research-only per `CLAUDE.md`; see Non-goals). Not fixed here.
- [x] 2.5 Re-ran the sweep 2026-06-07: `scrollable-region-focusable`,
      `aria-hidden-focus`, AND `page-has-heading-one` all 0 across all roles;
      sweep green (4 passed). The "flaky `next dev` webServer startup" was
      misdiagnosed — root cause was a corporate-proxy 502 on the loopback health
      probe (`HTTP_PROXY` set, `NO_PROXY` missing `127.0.0.1`); fixed durably by
      `e2e/no-proxy-localhost.ts`. See the `sweep-webserver-proxy-502` memo.

## 3. Sweep harness — noise

> Source IDENTIFIED (2026-06-07): `ERR_CONNECTION_REFUSED` (98) =
> `AgentationDevtools` (`agentation-devtools.tsx`) rendering `<Agentation
endpoint="http://localhost:4747" />`. The component correctly gates on
> `NODE_ENV === "development"` and returns null otherwise — but the sweep boots
> the web app via `next dev`, which FORCES `NODE_ENV=development`, so the devtools
> render and fail to reach their backend on :4747 (not up in the sweep). Pure
> sweep-environment artifact, NOT a product bug.

- [x] 3.1 Added `page.on('requestfailed')` URL capture (kind `network`) with an
      `IGNORED_REQUEST_URLS` devtools-endpoint list (`:4747`); other refused URLs
      still surface. Also added axe `violation.nodes[].target` capture so a11y
      fixes (§2) can be targeted to the offending elements.
- [x] 3.2 Filtered the bare `net::ERR_CONNECTION_REFUSED` + `[Agentation]`
      console lines with a comment recording the confirmed `next dev`→:4747
      source. Sweep re-run confirmed both → 0 across all roles.

## 4. Close out

- [x] 4.1 `openspec validate fix-sweep-ui-findings --strict` green (2026-06-08).
- [x] 4.2 Final sweep re-run 2026-06-08 (`pnpm test:uat`, 4 passed, 1.2m).
      Totals per role: admin 18, head 15, lead 8, viewer 4 = **45** anomalies.
      Honest before/after: on the **original console+axe+pageerror ruler** the
      baseline 621 → **41**, and all 41 are the deferred `color-contrast` (§2.4 /
      §5.1, theme-token, research-only). Every other original cluster (React
      duplicate-key, hydration, the ×49 axe rules, ERR_CONNECTION_REFUSED noise,
      scrollable/aria-hidden/heading) is **0**. The remaining **4** are
      `network`-kind (`/api/client-logs net::ERR_ABORTED`) — NOT part of the 621
      baseline (the proposal cluster table has no `network` row; network capture
      was first added in §3.1, so these are newly _visible_ from better
      instrumentation, not a regression). They are benign: `client-logger.ts:58`
      POSTs with `keepalive: true`, and keepalive requests in flight during the
      sweep's rapid route-to-route navigation are aborted by the browser
      teardown — best-effort-by-design, not a product defect. Deliberately NOT
      filtered: `/api/client-logs` is a real product endpoint, so suppressing it
      would blind the sweep to genuine future failures (unlike the §3 devtools
      `:4747` artifact, which `next dev` forces and prod cannot emit).

## Deferred (Non-goals — do NOT do here)

- [ ] 5.1 (NOTE) `color-contrast` (41) — theme-token work, research-only per
      `CLAUDE.md` until the user picks a direction. `TODO` left at the call site.
- [ ] 5.2 (NOTE) Within-route flow/logic bugs — need the 3.1 AI Driver, owned by
      `behavioral-ui-regression-gate`.
