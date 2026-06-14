# Tasks — Lead Live-Walk 2026-06-14

ultracode rework. Advisor decides forks. frontend-design for visual passes.
Branch `feat/finish-backlog-2026-06-13`; no push; PR #10 updated.

## 0. Triage first (data vs code) — BLOCKS items 3

- [ ] 0.1 Reseed the dev DB (disposable) to a clean baseline, then re-check the
      head dashboard activity row for Василий И. AND the slide statuses. Decide:
      dirty-seed artifact (overnight pollution, per the report flag) vs a real
      rethink-pipeline regression. Record the verdict.

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

- [x] 5.1 Make the head action line identical to the lead toolbar (heights,
      radii, spacing, control idiom). frontend-design; reuse lead components.
- [x] 5.2 `agent-review-coming-soon.tsx`: same height as siblings (touch-target).
- [x] 5.3 Move Export-PDF + Publish into the toolbar pill, beside Present/Print.
      Keep behavior/aria/hrefs.
- [x] 5.4 Render tests + live before/after screenshots (head form + slides), at
      1728 and ~1280 widths (wrap, not clip).

## 6. Gates

- [ ] 6.1 `pnpm typecheck && pnpm lint` + vitest for touched packages.
- [ ] 6.2 Live re-check every item at :3000; screenshots to
      `/tmp/finish-backlog-shots/`.
