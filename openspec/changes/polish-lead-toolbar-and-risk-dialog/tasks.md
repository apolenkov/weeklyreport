# Tasks — Polish Lead Toolbar, Risk Dialog, Slide Hero

CAPTURE DRAFT (2026-06-13 live-walk feedback). Presentation only; no logic
changes. Re-check each against the live app before/after. Items marked DESIGN
need a concrete proposal before editing.

Before starting: `git status --short`, `openspec list`. UI strings stay
English; Russian only in data/comments/tests.

## 1. Toolbar — control consistency

- [x] 1.1 Archive toggle: remove the archived-count signal that reads as a CTA;
      make it a quiet inert indicator (`ArchiveToggle` →
      `report-shell/toolbar-icon-button.tsx`). Keep the switch behavior + aria.
- [x] 1.2 Version "Coming soon" control: make it fully rounded and visually
      consistent with the 32×32 sibling controls (`lead/version-coming-soon.tsx`).
- [ ] 1.3 Fill-from / copy: re-consolidate into ONE control — default click
      copies; drop the separate copy control (`lead/fill-from-button.tsx`).
      DESIGN: confirm the merged interaction first (see proposal open question).
- [x] 1.4 Add a unit/render test per changed control (shape/aria/behavior).

## 2. Risk edit dialog — clearer layout (DESIGN first)

- [ ] 2.1 Propose a concrete lighter layout for `lead/risk-edit-dialog.tsx`
      (field grouping, spacing, reduced competing emphasis). Capture a
      before screenshot.
- [ ] 2.2 Implement the agreed layout; keep all fields/behavior intact.
- [ ] 2.3 After screenshot; update any snapshot tests honestly.

## 3. Slide hero — height alignment

- [x] 3.1 VERIFIED ALREADY ALIGNED — no rendered change needed. Live measurement
      at `:3000 ?mode=slides` (blocked slide): tone badge and metric capsule are
      both 44px tall (`h-11`), the author text is 20px but centered, and all
      three share centerY 292 — the row is on one baseline. The named const
      `HERO_ROW_HEIGHT_CLASS` in `slides/lead-slide-hero.tsx` only locks the
      shared-height contract between the two boxed elements; it intentionally
      produces no visual change because the row was already correct. The user's
      "taller" perception is the bordered pill vs. the borderless author text,
      which is by design.
- [x] 3.2 VERIFIED across tones: `HERO_ROW_HEIGHT_CLASS` is applied
      unconditionally, only the color classes vary by status, so badge/capsule
      height is constant for on-track / at-risk / blocked. The render test
      asserts the shared `h-11` for all three tones; no row wraps or misaligns.

## 4. Gates

- [x] 4.1 `pnpm typecheck && pnpm lint` + vitest for touched web/ui packages.
- [x] 4.2 Live re-check each item at `:3000` (form + `?mode=slides`); before/after
      screenshots for the visual items.

## Notes

- Growing list: more live-walk annotations may be appended.
- DESIGN items (1.3, 2.x) need a direction before code — do not improvise a
  redesign.
