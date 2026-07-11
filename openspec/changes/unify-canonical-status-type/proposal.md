# Proposal: unify-canonical-status-type

## Why

The presentation status vocabulary (`blocked` / `at-risk` / `on-track` /
`empty`) is declared three times: `CanonicalStatus` in
`apps/web/src/lib/status-presentation.ts` (the canonical map's key type,
owned by `status-presentation-model`), `StageStatus` in
`features/report-sections/model/traffic-light.ts`, and a verbatim
`StageStatus` duplicate in `features/report-sections/model/mock-data.ts`.
The `architecture-refactor-backlog` spec names this consolidation as the
deferred follow-up owned by `status-presentation-model`. A bonus defect
rides along: `lib/stage-status.ts` imports the type from a feature module —
a lib→feature layering inversion.

## What Changes

- `CanonicalStatus` in `lib/status-presentation.ts` becomes the single
  declaration of the vocabulary.
- `traffic-light.ts` re-declares nothing: `StageStatus` becomes a type-only
  alias of `CanonicalStatus` (feature→lib import, legal direction). The
  `StageStatus` name stays — it is the feature-domain alias at the
  traffic-light boundary; consumers keep compiling unchanged.
- `mock-data.ts` re-exports the alias instead of re-declaring the union.
- `lib/stage-status.ts` re-points its type import at `./status-presentation`,
  removing the lib→feature inversion. No signature changes — the alias is
  structurally identical.
- The literal-union gate (`scripts/find-status-literal-unions.mjs`) learns a
  third rule: a union or zod literal list containing ALL FOUR canonical
  literals fires outside `lib/status-presentation.ts` (the
  `riskSeveritySchema` two-literal subset stays legal). Guards the
  consolidation against silent regression.
- The new rule immediately caught a FOURTH declaration the manual inventory
  missed: `ActivityTone` in
  `features/report-sections/ui/activity-status-strip.tsx` — aliased to
  `CanonicalStatus` the same way. Its private `TONE_LABEL`/`TONE_DOT_CLASS`
  Records stay: folding them into the canonical map is parity-gated
  pre-existing debt (`status-presentation-model` consolidation-parity
  requirement), not this change's scope.
- The backlog records the follow-up as closed.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `status-presentation-model`: gains the single-declaration requirement for
  the canonical status vocabulary.
- `status-type-ssot-gate`: the gate requirement grows the third
  (canonical-vocabulary) detection rule and its allowlist entry.
- `architecture-refactor-backlog`: the traffic-light closure requirement
  stops naming the presentation-vocabulary consolidation as an open
  follow-up.

## Impact

- `apps/web/src/features/report-sections/model/traffic-light.ts`,
  `model/mock-data.ts`, `ui/activity-status-strip.tsx`,
  `apps/web/src/lib/stage-status.ts` — type plumbing only, zero runtime
  change, zero consumer edits.
- `scripts/find-status-literal-unions.mjs` + test — third rule.
  NOTE: implemented only after the parallel session's uncommitted scanner
  edits (z.union rule) land; the scanner files are frozen until then.
- Design grilled with Codex to consensus (2026-07-11): alias approach,
  scanner extension in-change, both names kept intentionally.
