# Unify web status color tokens

## Why

Report workflow status (at-risk / blocked / on-track) is still painted with raw
hex literals — and one dead hex fallback — scattered across the lead and report
web surfaces, instead of the `--color-status-*` tokens the design system already
defines. This is roadmap #38, the prerequisite for #3 (`unify-status-presentation`):
before status presentation can be reshaped in one place, the CSS-variable layer it
reads must be the single source of truth.

## What Changes

- Route the genuine **report-workflow** status literals (risk severity pills,
  portfolio-overview cells, lead-history severity chips/dots, stage-hint amber,
  the product-accordion "At Risk" pill, and the dashboard blocked/at-risk
  severity badge) onto the existing `--color-status-*` / `--color-destructive`
  tokens; remove the raw hex.
- Fix `save-now-button` — the `var(--color-success,#16a34a)` reference has a dead
  fallback masking a wrong base token (the defined `--color-success` is pale mint,
  not the green the checkmark stroke wants). Point the stroke at the green
  foreground token and drop the fallback.
- Add a `--color-border-subtle` token so the status-presentation surfaces #3
  reshapes have a named hairline instead of `border-[rgba(0,0,0,0.0x)]`.
- **Consolidate the near-duplicate at-risk foreground** (`#8a6d1b`, repeated raw
  across the report-workflow surfaces) onto the single canonical
  `--color-status-at-risk-fg`. This shifts pixels, so it ships under the
  `status-color-semantics` sign-off + before/after gate. The report-surface
  blocked foreground already resolves `--color-destructive` (no consolidation
  needed); the other `#92400e` / `#991b1b` literals live only in the
  out-of-scope admin domain.
- **Explicitly out of scope** (different semantic domains — see design.md): the
  admin role-identity badges, the period-lifecycle / required-asterisk / destructive-action
  reds, and the print/PDF template (its renderer cannot resolve CSS custom properties).

## Capabilities

### New Capabilities

- `web-status-color-tokens`: the concrete token CONTRACT the status-presentation
  layer reads — the status token set is complete (including `--color-border-subtle`),
  token references carry no hex fallback, and the enumerated report-workflow status
  surfaces resolve their color through the named tokens. Operationalizes the
  `status-color-semantics` "no literals" invariant for the web surfaces; does not
  restate or change it.

### Modified Capabilities

<!-- None. status-color-semantics already forbids status literals and gates palette
     changes; this change enforces it on the holdout surfaces and adds one token,
     without changing any existing requirement's behavior. -->

## Impact

- Code: `apps/web/src/components/{lead,report-shell,weekly-report}/*` status
  surfaces; one new token in `packages/ui/src/styles/globals.css`.
- Visual: minor, on the consolidated at-risk foreground only — gated by
  recorded sign-off + before/after screenshots per `status-color-semantics`.
- No API, Prisma, shared-schema, or data changes.
