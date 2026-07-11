# Design: unify-canonical-status-type

## Context

Verified import graph (2026-07-11): `status-presentation.ts` imports only
`lucide-react`; `traffic-light.ts` exports `StageStatus` +
`trafficToStageStatus`/`stageStatusToTraffic`; `mock-data.ts` duplicate is
imported by `stage-chip.tsx`, `stage-chip-config.ts`,
`lead-form-sync-bridge.tsx`, `sdlc-collapsed-indicator.tsx`, and
`sdlc-pipeline-health.ts`; `lib/stage-status.ts:1` imports `StageStatus`
from the feature module (inversion). Files `lead-form.ts`,
`lead-cross-author.ts`, `weekly-report-page.tsx` were recently reworked by
the parallel `unify-role-type` session — the alias design leaves every
consumer file untouched, so no overlap.

During implementation the new gate rule exposed a FOURTH declaration the
manual inventory missed: `ActivityTone` in
`features/report-sections/ui/activity-status-strip.tsx:30`. It joins the
consolidation as an alias; its private `TONE_LABEL`/`TONE_DOT_CLASS`
Records are keyed lookups (not type declarations) and folding them into the
canonical map is parity-gated pre-existing debt, deliberately untouched.

## Goals / Non-Goals

**Goals:**

- One declaration of the canonical vocabulary; aliases preserve names.
- Fix the lib→feature type import.
- Gate the vocabulary against re-declaration (all-four rule).

**Non-Goals:**

- No rename of `StageStatus` consumers (`CanonicalStatus` and `StageStatus`
  are both intentional names — repo-wide vs feature-domain).
- No `TRAFFIC_RANK` / `statusSeverity` ranking dedup (separate follow-up).
- No label/tone/icon map changes (owned by the existing
  `status-presentation-model` requirements; zero pixels move).

## Decisions

1. **`CanonicalStatus` is the declaration; `StageStatus` the alias.** The
   canonical map in `lib/status-presentation.ts` is the spec-owned home; a
   type-only `import type { CanonicalStatus }` + `export type StageStatus =
CanonicalStatus` in `traffic-light.ts` preserves structural identity and
   exhaustiveness with zero consumer churn (Codex-verified: no cycles, no
   runtime edge).
2. **`mock-data.ts` re-exports** (`export type { StageStatus } from
"./traffic-light"`) instead of re-declaring — its consumers keep their
   import paths.
3. **`lib/stage-status.ts` types against `CanonicalStatus` directly**,
   deleting the lib→feature import; `deriveEffectiveStageStatus` signatures
   stay source- and runtime-equivalent.
4. **Scanner rule: contains-all-four, extras allowed**, `status-presentation.ts`
   centrally allowlisted; `riskSeveritySchema` (`at-risk`/`blocked`) is a
   two-literal subset and never fires. Implemented after the parallel
   session's scanner edits land (same-file freeze until then).

## Risks / Trade-offs

- **Alias keeps two names alive.** Deliberate: renaming erases feature
  context without strengthening the SSOT; revisit only if stage vocabulary
  genuinely diverges from canonical presentation vocabulary.
- **Scanner freeze dependency.** If the parallel session's edits do not land
  tonight, the gate extension is re-scoped out of this change before
  archive and the spec delta adjusted — the consolidation itself does not
  depend on it.
