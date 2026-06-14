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
- [x] 1.3 Fill-from / copy: re-consolidated into ONE split-button — a wider
      main segment (copy = fill from the most recent submitted period) joined to
      a slim chevron segment that opens the past-report picker (search + confirm
      flow kept). Both segments keep distinct buttons + aria-labels; the chevron
      keeps `dropdownTriggerRef`. The phase-A two-circle pair is gone; no
      separate copy control was passed by `report-toolbar`/`lead-form` to remove
      (`lead/fill-from-button.tsx`). Live-verified at :3000: main click opens the
      Week 23 confirm dialog, chevron opens the picker.
- [x] 1.4 Render/unit test per changed control: split-button asserts the joined
      shared container + the fill-flow (main-click confirm, chevron-open list);
      risk dialog asserts the single-column layout with every field present.

## 2. Risk edit dialog — clearer layout (DESIGN first)

- [x] 2.1 Layout decided + before screenshot captured: single column,
      max-w-2xl, p-5. Prose fields (Risk/Impact/Mitigation) stack full-width,
      then a light bordered "Classification" sub-panel groups SDLC stages +
      severity chips + product. Before: `/tmp/finish-backlog-shots/before-risk-dialog.png`.
- [x] 2.2 Implemented in `lead/risk-edit-dialog.tsx`. Presentation only — every
      field, the "Select at least one stage." validation, the SDLC context strip,
      severity semantics, and all behavior unchanged. Live-verified at :3000:
      dialog is 672px wide, no md grid, Classification panel present.
- [x] 2.3 After screenshot `/tmp/finish-backlog-shots/after-risk-dialog.png`.
      No snapshot tests exist for this component; the layout unit test was
      updated honestly to the single-column contract.

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

- [x] 4.1 Gates green after phase B (1.3 + 2.x): `pnpm typecheck` ✓,
      `pnpm lint` ✓ (exit 0), full `apps/web` vitest 1083/1083 ✓ (touched files
      fill-from-button 10/10 + risk-edit-dialog 24/24). No `packages/ui` change.
- [x] 4.2 Live re-check at `:3000` (form + `?mode=slides`): split-button main
      click copies (Week 23 confirm), chevron opens picker; risk dialog renders
      single-column with the Classification panel; slides mode loads clean.
      Screenshots in `/tmp/finish-backlog-shots/` (before/after toolbar +
      risk dialog, split-button dropdown, slides).

## Notes

- Growing list: more live-walk annotations may be appended.
- DESIGN items (1.3, 2.x) need a direction before code — do not improvise a
  redesign.
