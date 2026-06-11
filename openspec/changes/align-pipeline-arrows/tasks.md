# Tasks — Align SDLC Pipeline Arrows to the Chip Centerline

Decisions D1-D2: `design.md`. Evidence anchors: `proposal.md`.
Web-only change (`apps/web/src/components/lead/`); no shared/ui/api
work.

## 1. Chip height token (D1)

- [x] 1.1 `stage-chip-config.ts`: export a named chip box-height
      constant (value measured from the rendered chip at
      implementation time; no inline magic number at use sites).
- [x] 1.2 `stage-chip.tsx`: chip button takes the constant as its
      fixed height with internally centered content
      (`inline-flex items-center justify-center`); locked corner
      badge stays absolutely positioned and unaffected.

## 2. Row and arrow alignment (D2 + D1)

- [x] 2.1 `sdlc-pipeline.tsx:253`: stages row `items-center` →
      `items-start` (keep `flex-wrap justify-center gap-2`).
- [x] 2.2 `sdlc-pipeline.tsx:270-288`: each `[arrow, chip]` cell
      `items-center` → `items-start`; arrow wrapper gets the same
      height constant with `flex items-center`; remove the orphaned
      `alignSelf: "center"`.

## 3. Tests (honest, new contract)

- [x] 3.1 `sdlc-pipeline.test.tsx`: structural assertions — stages
      row and cells are top-aligned; arrow wrapper carries the shared
      height value.
- [x] 3.2 `stage-chip.test.tsx`: chip button carries the same shared
      height value (token parity with the arrow box).
- [x] 3.3 Review any snapshot diffs touching the stages row; if the
      diff matches D1/D2 only, regenerate — never hand-edit, never
      revert unrelated snapshot noise (note: the pre-existing
      uncommitted `product-accordion.test.tsx.snap` modification must
      stay untouched). — No snapshots for sdlc-pipeline or stage-chip exist; none regenerated.

## 4. Verification

- [x] 4.1 Gates: `pnpm typecheck && pnpm lint && pnpm test` — all
      green. typecheck: 5/5 tasks successful; lint: no issues;
      test: 1037/1037 passed.
- [x] 4.2 Live visual check on the lead report page (:3000):
      arrow midline == chip midline (a) with assignee names,
      (b) with "— unassigned" labels, (c) on a narrow viewport that
      forces a wrap — chips top-aligned on every row; screenshot for
      the change record. — Done 2026-06-11 in a live browser
      (Playwright) with `getBoundingClientRect` midline measurements:
      (a) lead1, 4 pipelines, all arrow mids == chip mids (e.g.
      529.5 == 529.5), chip and arrow boxes both 36px; (b) boris,
      row mixing named and "— unassigned" labels, mids all 567.5,
      chip tops identical; (c) 480px viewport, every pipeline wraps
      to 3 lines, chips share the top edge per line and every arrow
      mid equals its line's chip mid. Screenshots:
      `verification/align-pipeline-arrows-desktop-named-unassigned.png`,
      `verification/align-pipeline-arrows-narrow-wrap.png`.
      Note: the long-running :3000 dev server had a pre-existing
      corrupted webpack RSC bundle for `/lead/report/[reportId]`
      (500 + `__webpack_modules__[moduleId] is not a function`;
      other routes fine; needs a `dev:fresh` restart). The check ran
      against the same working tree via the repo's sanctioned
      parallel dev server (`NEXT_DIST_DIR`, port 3005) on the same
      API and dev DB.
