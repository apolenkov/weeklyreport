# Tasks

## 1. Tier 1 — Layout / density (implement)

- [x] T1 Select/combobox chevron spacing (#1). In
      `packages/ui/src/components/ui/select.tsx`, add right padding / chevron
      inset so the glyph is not flush against the border. Confirm the lead
      "Product" select and the admin filter selects pick up the fix (or patch the
      variant). No color change; keep the touch-target size.
  - Evidence (2026-06-10): grep confirmed the shared shadcn `select.tsx` is
    imported NOWHERE in `apps/web` — all affected selects are native
    `<select>` variants, so the "(or patch the variant)" branch applied.
    Added the `.select-chevron` utility to
    `packages/ui/src/styles/globals.css` (appearance:none + inset chevron
    data-URI + `padding-right: 2.5rem`) and applied it to `TabFilter`
    (`apps/web/src/components/admin/tab-header.tsx`, covers users-tab +
    groups-tab filter selects) and to both selects in
    `apps/web/src/components/lead/item-edit-dialog.tsx` (Product +
    Priority rank). Live check: `#item-product` went from
    `appearance=auto, paddingRight=12px` to
    `appearance=none, paddingRight=40px` with the inset glyph.
- [x] T2 Admin users-tab filter row height (#2). In
      `apps/web/src/components/admin/users-tab.tsx`, align `Active` / `All roles`
      / `All groups` / `Search users…` / `Add User` to one shared control-height
      token. Verify each control stays keyboard-focusable + operable.
  - Evidence (2026-06-10): aligned via the shared token
    `min-h-[var(--touch-target-min)]` on `TabFilter` + `TabSearch` in
    `tab-header.tsx` (the row's actual styling source; `Add User` already
    used it). Measured live at 1440×900: before 34/34/34/34/44 px → after
    44/44/44/44/44 px. All five controls remain `tabIndex=0`, enabled,
    operable.
- [x] T3 Status Report header cluster (#3). In
      `apps/web/src/components/head/head-report-shell.tsx`, normalize the action
      buttons to one height and regroup by intent (view-mode toggle | primary
      edit/slides | utility export/archive/reopen) using spacing/weight only.
      Keep one clear primary; do NOT change colors/theme. Re-check tab order.
  - Evidence (2026-06-10): heights unified on
    `min-h-[var(--touch-target-min)]` — `ScopeToggle` 28→44
    (`scope-toggle.tsx`, segments stretch inside the pill), `ViewModeToggle`
    40→44 (`view-mode-toggle.tsx`), icon links already 44. Measured live:
    before 28/40/40/44/44/44 → after 44×6. Cluster regrouped into three
    intent groups (scope | edit/slides | agent-review/present/export) with
    `gap-x-5` between groups, `gap-2` inside; DOM order — and therefore tab
    order — unchanged (verified: 7 focusables in original order, all
    `tabIndex=0`). Colors untouched. Side effect (shared components): the
    lead report header (Edit/Slides 40→44) and lead slides scope toggle
    (28→44) now match their 44px row neighbors too — checked live on both
    surfaces.
- [x] T4 Verify Tier 1. Before/after screenshots of each surface at the same
      viewport; `pnpm typecheck && pnpm lint && pnpm test` green; confirm no
      keyboard-reachability regression (controls stay focusable/operable per
      `a11y-regression-coverage`).
  - Evidence (2026-06-10): before/after PNGs at 1440×900 in
    `/tmp/polish-ui-density-evidence/` (admin users-tab, head report header,
    lead item dialog, lead report header, lead slides). Gates:
    `pnpm typecheck` ✓ (5/5), `pnpm lint` ✓ (ESLint + stylelint + prisma),
    `pnpm test` ✓ (898 passed — 2 pure class-string snapshots refreshed:
    `scope-toggle.test.tsx`, `lead-form-viewmode.snapshot.test.tsx`;
    behavioral role/aria assertions untouched), `pnpm build` ✓ (5/5).
    Keyboard: admin filter row 5/5
    focusable+enabled; head cluster 7/7 focusable in unchanged DOM order
    (Agent review stays `aria-disabled` by design).

## 2. Tier 2 — Palette (RESEARCH ONLY — no CSS without sign-off)

- [x] T5 Stage-chip palette + per-phase icons research (#4). For
      `apps/web/src/components/lead/stage-chip.tsx` and the "assigned"
      product-group background: research current status-pipeline UI patterns,
      produce 2-3 calmer-palette options + optional per-phase SDLC icon set, name
      the exact tokens that WOULD change, and recommend one. Memo only — no CSS.
  - Evidence (2026-06-10): `memos/t5-stage-chip-palette.md` — 3 options
    (cool greens + amber / neutral chips + semantic dot / muted fills +
    left-border stripe), recommendation = Option 3, full token change list,
    7-stage lucide icon set verified against `lucide-react@1.17.0`. The
    beige source is pinned to hardcoded `#fffcf5` in
    `sdlc-pipeline.tsx getProductBackground()`, not `--color-surface-empty`
    as design.md guessed. Adversarial verify pass: 0 corrections. No CSS
    touched.
- [x] T6 Section preview color-hierarchy research (#5). For
      `apps/web/src/components/weekly-report/product-accordion.tsx`
      (`NEEDS ATTENTION` / `RISKS & BLOCKERS` / `TOP PRIORITIES` labels + tinted
      rows): propose a restrained accent hierarchy (one alert accent, muted rest)
      with options + recommendation. Memo only — no CSS.
  - Evidence (2026-06-10): `memos/t6-preview-card-hierarchy.md` — full color
    inventory (7 competing hues, 10 hardcoded literals), 3 restrained-
    hierarchy options, recommendation = Option 2 (single red alert + amber
    left-border for at-risk, labels neutral). Adversarial verify pass found
    8 line-number/omission errors — corrected in the memo. No CSS touched.
- [x] T7 Review the Tier 2 memos with the user; record the chosen direction (or
      "deferred"). Only AFTER explicit sign-off may a FOLLOW-UP change implement
      the approved palette tokens — not under this change.
  - Decision (2026-06-10, explicit user sign-off «го»): T5 = Option 3
    (muted semantic fills + left-border group stripe, hardcoded hexes
    tokenized) PLUS the per-stage lucide icon set; T6 = Option 2 (single
    red alert for blocked, amber left-border stripe for at-risk, all
    section labels neutral). Implementation goes to the follow-up change
    `apply-status-palette` — final visual acceptance there is by
    before/after screenshots, with easy token rollback.
