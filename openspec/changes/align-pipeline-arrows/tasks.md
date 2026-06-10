# Tasks — Align SDLC Pipeline Arrows to the Chip Centerline

Decisions D1-D2: `design.md`. Evidence anchors: `proposal.md`.
Web-only change (`apps/web/src/components/lead/`); no shared/ui/api
work.

## 1. Chip height token (D1)

- [ ] 1.1 `stage-chip-config.ts`: export a named chip box-height
      constant (value measured from the rendered chip at
      implementation time; no inline magic number at use sites).
- [ ] 1.2 `stage-chip.tsx`: chip button takes the constant as its
      fixed height with internally centered content
      (`inline-flex items-center justify-center`); locked corner
      badge stays absolutely positioned and unaffected.

## 2. Row and arrow alignment (D2 + D1)

- [ ] 2.1 `sdlc-pipeline.tsx:253`: stages row `items-center` →
      `items-start` (keep `flex-wrap justify-center gap-2`).
- [ ] 2.2 `sdlc-pipeline.tsx:270-288`: each `[arrow, chip]` cell
      `items-center` → `items-start`; arrow wrapper gets the same
      height constant with `flex items-center`; remove the orphaned
      `alignSelf: "center"`.

## 3. Tests (honest, new contract)

- [ ] 3.1 `sdlc-pipeline.test.tsx`: structural assertions — stages
      row and cells are top-aligned; arrow wrapper carries the shared
      height value.
- [ ] 3.2 `stage-chip.test.tsx`: chip button carries the same shared
      height value (token parity with the arrow box).
- [ ] 3.3 Review any snapshot diffs touching the stages row; if the
      diff matches D1/D2 only, regenerate — never hand-edit, never
      revert unrelated snapshot noise (note: the pre-existing
      uncommitted `product-accordion.test.tsx.snap` modification must
      stay untouched).

## 4. Verification

- [ ] 4.1 Gates: `pnpm typecheck && pnpm lint && pnpm test &&
    pnpm build` — record results here.
- [ ] 4.2 Live visual check on the lead report page (:3000):
      arrow midline == chip midline (a) with assignee names,
      (b) with "— unassigned" labels, (c) on a narrow viewport that
      forces a wrap — chips top-aligned on every row; screenshot for
      the change record.
