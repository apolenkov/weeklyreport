# Tasks — Lead Live-Walk 2026-06-14

ultracode rework. Advisor decides forks. frontend-design for visual passes.
Branch `feat/finish-backlog-2026-06-13`; no push; PR #10 updated.

## 0. Triage first (data vs code) — BLOCKS items 3

- [x] 0.1 Reseeded the dev DB (db:fresh:advanced, active period 2026-06-08..14).
      VERDICT split: (a) slide statuses = a REAL bug (see 3.1, fixed). (b) the
      head dashboard "not started" / wrong week = NOT a code bug and NOT rethink
      (rethink does not touch activity-live-panel/compiledHistory) — it is PERIOD
      DRIFT: head "current" resolves to a later EMPTY week (live shows Week 26
      Jun 22-28 as Current though the seed's active is Jun 8-14), so the empty
      current period correctly reads "not started". Period-resolution oddity
      flagged for the user; out of this change's scope.

## 1. Risk dialog — two columns, justified (frontend-design)

- [x] 1.1 `lead/risk-edit-dialog.tsx`: revert single-column to a balanced TWO
      column layout. No stray empty space; aligned/parallel columns of
      comparable height; total height well under 92vh. Keep all
      fields/validation/behavior. Update snapshots honestly.
- [x] 1.2 Render test + live before/after screenshots.

## 2. Slides product card

- [x] 2.1 `slides/lead-product-grid.tsx`: surface risk/decision CONTENT on the
      card (not only counts), consistent with the form. Keep it readable.
- [x] 2.2 Equal-height product cards across the grid row.
- [x] 2.3 Tests + live screenshots.

## 3. Statuses (only if 0.1 says real bug)

- [x] 3.1 If real: fix status/completeness derivation (in rethink-pipeline scope)
      so a started lead is not "not started" and slide statuses are correct.
      Live-verify. If dirty-seed: note it, no code change.
      VERDICT: REAL bug (rethink-pipeline scope), not dirty-seed. The slide
      product badge read the persisted, pre-floor `project.trafficLight` while
      every stage was risk-floored, so a stale persisted status drifted the
      badge from the stages below it. Fixed in `section-slide-utils.ts` —
      `SlideProduct.status` now derives from the worst floored stage (worst-of),
      mirroring the live pipeline's own-status path. Live-verified at :3000
      ?mode=slides: 4/6 products match the pipeline stripe exactly; the 2 that
      differ (Платёжный шлюз, CRM-Sales Hub) carry only a CROSS-AUTHOR risk
      (Boris's `PROD_PAYMENTS` at-risk) which the per-lead own-section slide
      intentionally omits — that aggregate surfaces in the head by-product view.

## 4. Reports history behavior

- [x] 4.1 `app/(app)/reports/page.tsx`: History defaults to NO archive.
      `includeArchive` is now `useState(false)` unconditionally — the URL
      `?tab=` no longer forces archive on. Live-verified head (`?tab=published`)
      and lead (`?tab=drafts`) both land archive-OFF.
- [x] 4.2 Archive toggle must NOT mutate the URL (no query param churn).
      `toggleArchive` + its `router.push` removed; `onChange` is now
      `setIncludeArchive`. Live-verified the address bar stays put on toggle.
- [x] 4.3 `navigation/nav-bar.tsx`: the "History" nav active/selected state is
      INDEPENDENT of the archive toggle (toggling archive never un-highlights it).
      `isActiveLink` reports branch is pathname-only now (`/reports` or a
      published report path); the `activeReportsTab`/`reportsTabFromHref`/
      `useSearchParams` coupling was removed. Live-verified History stays
      highlighted with the toggle on and with no `tab` param at all.
- [x] 4.4 Tests for default-state, URL-stability, and nav-active independence.
      page.test.tsx: head default-no-archive on `?tab=published`, lead+head
      toggle does NOT push the URL. nav-bar.test.tsx: head+lead History active
      on `/reports` with NO tab param.

## 5. Head report toolbar — 1:1 with lead

- [x] 5.1 DONE the CORRECT way (commit 367c015c): per the user's lead reference
      image, the lead actions live in an UNFRAMED header-right cluster (not a
      framed bar). Added a `headerActions` slot to WeeklyReportPage; head + viewer
      pass their controls there, so the head/viewer header reads 1:1 with lead.
      The earlier framed `ReportActionsPill` (PR#10) was reverted + deleted.
- [x] 5.2 `agent-review-coming-soon.tsx` UNCHANGED (its `compact` is still used
      by slide decks); head/viewer just stopped passing `compact`, so the
      placeholder is now full touch-target height like the siblings.
- [x] 5.3 Export-PDF + Publish already live in the WeeklyReportPage header row;
      head's Present/Print/scope/view now join them there via `headerActions`
      (one unframed cluster), instead of a separate pill. Behavior/aria/hrefs
      preserved.
- [x] 5.4 head-report-shell.test.tsx covers the cluster + slides-header omission;
      live before/after at 1728 captured (head form, viewer). Both verified 1:1
      with the lead reference by eye.

## 6. Gates

- [x] 6.1 typecheck (web) clean; eslint on changed files clean; web vitest
      1103/1103 pass.
- [x] 6.2 Live re-checked head form, viewer, history at :3000; screenshots
      d-head-form.png / d-viewer.png / d-history.png sent to the user.
