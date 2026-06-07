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

## 2. Shared-shell a11y (axe)

- [ ] 2.1 `button-name` (49) + `label` (49) — critical. Fix at the shared
      nav/shell source; add discernible text / associated labels.
- [ ] 2.2 `link-name` (49), `nested-interactive` (49), `region` (49) — serious /
      moderate. Fix at source.
- [ ] 2.3 `aria-hidden-focus` (4), `page-has-heading-one` (4),
      `scrollable-region-focusable` (2).
- [ ] 2.4 Re-run the sweep after each cluster; confirm the targeted rule drops to
      zero across all roles.

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

- [ ] 4.1 `openspec validate fix-sweep-ui-findings --strict` green.
- [ ] 4.2 Final sweep re-run; attach the before/after anomaly counts.

## Deferred (Non-goals — do NOT do here)

- [ ] 5.1 (NOTE) `color-contrast` (41) — theme-token work, research-only per
      `CLAUDE.md` until the user picks a direction. `TODO` left at the call site.
- [ ] 5.2 (NOTE) Within-route flow/logic bugs — need the 3.1 AI Driver, owned by
      `behavioral-ui-regression-gate`.
