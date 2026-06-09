# Tasks

## 1. Tier 1 — Layout / density (implement)

- [ ] T1 Select/combobox chevron spacing (#1). In
      `packages/ui/src/components/ui/select.tsx`, add right padding / chevron
      inset so the glyph is not flush against the border. Confirm the lead
      "Product" select and the admin filter selects pick up the fix (or patch the
      variant). No color change; keep the touch-target size.
- [ ] T2 Admin users-tab filter row height (#2). In
      `apps/web/src/components/admin/users-tab.tsx`, align `Active` / `All roles`
      / `All groups` / `Search users…` / `Add User` to one shared control-height
      token. Verify each control stays keyboard-focusable + operable.
- [ ] T3 Status Report header cluster (#3). In
      `apps/web/src/components/head/head-report-shell.tsx`, normalize the action
      buttons to one height and regroup by intent (view-mode toggle | primary
      edit/slides | utility export/archive/reopen) using spacing/weight only.
      Keep one clear primary; do NOT change colors/theme. Re-check tab order.
- [ ] T4 Verify Tier 1. Before/after screenshots of each surface at the same
      viewport; `pnpm typecheck && pnpm lint && pnpm test` green; confirm no
      keyboard-reachability regression (controls stay focusable/operable per
      `a11y-regression-coverage`).

## 2. Tier 2 — Palette (RESEARCH ONLY — no CSS without sign-off)

- [ ] T5 Stage-chip palette + per-phase icons research (#4). For
      `apps/web/src/components/lead/stage-chip.tsx` and the "assigned"
      product-group background: research current status-pipeline UI patterns,
      produce 2-3 calmer-palette options + optional per-phase SDLC icon set, name
      the exact tokens that WOULD change, and recommend one. Memo only — no CSS.
- [ ] T6 Section preview color-hierarchy research (#5). For
      `apps/web/src/components/weekly-report/product-accordion.tsx`
      (`NEEDS ATTENTION` / `RISKS & BLOCKERS` / `TOP PRIORITIES` labels + tinted
      rows): propose a restrained accent hierarchy (one alert accent, muted rest)
      with options + recommendation. Memo only — no CSS.
- [ ] T7 Review the Tier 2 memos with the user; record the chosen direction (or
      "deferred"). Only AFTER explicit sign-off may a FOLLOW-UP change implement
      the approved palette tokens — not under this change.
