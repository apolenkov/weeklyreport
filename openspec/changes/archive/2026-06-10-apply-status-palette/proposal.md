# Apply Status Palette

## Why

The palette research from `polish-ui-density-and-palette` (archived
2026-06-10) got an explicit user sign-off the same day: T5 Option 3 for the
stage chips / group backgrounds and T6 Option 2 for the section preview card.
The repo "Visual And Theme Work" gate is therefore satisfied, and the two
garish surfaces the user flagged (beige "assigned" group background, the
7-hue "parrot" preview card) can now be implemented.

## What Changes

- Stage chips (`stage-chip.tsx`): desaturated semantic fills (~40% calmer),
  all hardcoded hex values lifted into named `--color-chip-*` tokens
  (memo T5, Option 3).
- SDLC group backgrounds (`sdlc-pipeline.tsx`): the tinted at-risk/blocked
  card fills (incl. the beige `#fffcf5`) are replaced by a neutral card body
  with a semantic left-border stripe; the advisory banner loses its yellow
  fill the same way.
- Per-stage lucide icons on the pipeline chips (ClipboardList / Search /
  PenTool / Hammer / FlaskConical / Server / Headset), verified against the
  installed `lucide-react`.
- Section preview card (`product-accordion.tsx`): red fires only for
  `blocked`; at-risk rows get an amber left-border stripe on a neutral body;
  all section labels (`NEEDS ATTENTION`, `RISKS & BLOCKERS`, `DECISIONS`,
  `TOP PRIORITIES`) go neutral with weight-based hierarchy; ~10 hardcoded
  literals tokenized (memo T6, Option 2).
- Final acceptance is visual: before/after screenshots of the same surfaces
  reviewed by the user before the change is archived.

## Capabilities

### New Capabilities

- `status-color-semantics`: durable rules for status color usage — semantic
  status colors come from named tokens (no hardcoded hex in components), red
  is reserved for blocked, amber appears only as the at-risk accent, gold
  stays priorities-only.

### Modified Capabilities

<!-- none: ui-control-density's research-gate requirement is being satisfied
     (sign-off recorded in the archived change), not modified -->

## Impact

- `packages/ui/src/styles/globals.css` — new `--color-chip-*` /
  `--color-status-*` / `--color-priority-row-bg` tokens; `--color-success`
  value adjusted (`#d4e9e2` → `#d8ece4`).
- `apps/web/src/components/lead/stage-chip.tsx`,
  `apps/web/src/components/lead/sdlc-pipeline.tsx`,
  `apps/web/src/components/weekly-report/product-accordion.tsx`.
- Snapshot tests touching these components will need refreshing; behavioral
  assertions must stay untouched.
- Risk: low-medium — color/token swaps plus two small layout changes
  (left-border stripes); easy rollback because everything lands as tokens.
