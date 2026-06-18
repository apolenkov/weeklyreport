# Tasks

- [x] 1. Add `--color-toggle-active` (#3f4a44 slate) and `--toolbar-control-h`
     (32px) tokens to `packages/ui/src/styles/globals.css`.
- [x] 2. `SegmentedToggle`: compact at `--toolbar-control-h`, slate active fill,
     icon-only segment support (square, sr-only accessible name).
- [x] 3. `ViewModeToggle`: icon-only Edit (pencil) / Slides (grid) with sr-only
     label + tooltip; keep `<Link>` URL navigation.
- [x] 4. `RecordVisibilityToggle` (lead): icon-only Mine (User) / Everyone
     (Users) with aria-label + tooltip.
- [x] 5. `ScopeToggle`: compact text (Product/Leads) via the same primitive.
- [x] 6. `SlideFullscreenButton`: in-toolbar variant icon-only at the shared
     height (floating overlay keeps its labeled pill).
- [x] 7. Unify heights to `--toolbar-control-h`: lead pill actions + Toggle All,
     head/weekly Publish & Lock + Move-to-archive, period navigator wrapper,
     Agent-review compact placeholder.
- [x] 8. Right-align the view cluster: period nav (+ archive) left, a flex
     spacer, then Agent review + toggles (+ Toggle All / Fullscreen) right —
     in lead-form and head-report-shell context controls.
- [x] 9. Update tests/snapshots (view-mode + scope-toggle + lead-viewmode +
     head-report-shell) for icon-only names and the slate/compact classes.
- [x] 10. Gates green (typecheck/lint/test 1167) + live-verify lead edit/slides
      - head at 1088/1200px: one row of equal-height controls, slate active,
        icons, right-aligned, no period-nav crowding.
