# Tasks — Polish Lead Toolbar, Risk Dialog, Slide Hero

CAPTURE DRAFT (2026-06-13 live-walk feedback). Presentation only; no logic
changes. Re-check each against the live app before/after. Items marked DESIGN
need a concrete proposal before editing.

Before starting: `git status --short`, `openspec list`. UI strings stay
English; Russian only in data/comments/tests.

## 1. Toolbar — control consistency

- [ ] 1.1 Archive toggle: remove the archived-count signal that reads as a CTA;
      make it a quiet inert indicator (`ArchiveToggle` →
      `report-shell/toolbar-icon-button.tsx`). Keep the switch behavior + aria.
- [ ] 1.2 Version "Coming soon" control: make it fully rounded and visually
      consistent with the 32×32 sibling controls (`lead/version-coming-soon.tsx`).
- [ ] 1.3 Fill-from / copy: re-consolidate into ONE control — default click
      copies; drop the separate copy control (`lead/fill-from-button.tsx`).
      DESIGN: confirm the merged interaction first (see proposal open question).
- [ ] 1.4 Add a unit/render test per changed control (shape/aria/behavior).

## 2. Risk edit dialog — clearer layout (DESIGN first)

- [ ] 2.1 Propose a concrete lighter layout for `lead/risk-edit-dialog.tsx`
      (field grouping, spacing, reduced competing emphasis). Capture a
      before screenshot.
- [ ] 2.2 Implement the agreed layout; keep all fields/behavior intact.
- [ ] 2.3 After screenshot; update any snapshot tests honestly.

## 3. Slide hero — height alignment

- [ ] 3.1 Align the status badge ("Blockers", `h-11`) to the same height/baseline
      as its sibling row elements in `slides/lead-slide-hero.tsx`. Named const,
      no magic number.
- [ ] 3.2 Verify across statuses (on-track / at-risk / blocked) and product
      counts so no row wraps or misaligns.

## 4. Gates

- [ ] 4.1 `pnpm typecheck && pnpm lint` + vitest for touched web/ui packages.
- [ ] 4.2 Live re-check each item at `:3000` (form + `?mode=slides`); before/after
      screenshots for the visual items.

## Notes

- Growing list: more live-walk annotations may be appended.
- DESIGN items (1.3, 2.x) need a direction before code — do not improvise a
  redesign.
