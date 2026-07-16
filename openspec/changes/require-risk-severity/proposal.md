## Why

A risk without a severity level cannot exist: the DB column is NOT NULL and the risk dialog always sends a value. But the Zod contract says `severity: riskSeveritySchema.optional()` (`section.schema.ts:123`) — the type lies — and the Prisma column carries a silent `@default("at-risk")`. Because the contract permits `undefined`, both derivation sides grew defensive code against the impossible state, each different (web floors it, API filters it out), which surfaced as a phantom "product fork" during `dedupe-severity-floor-ranking`.

Ratified decision (2026-07-16, product owner): **severity is mandatory** — every risk is explicitly `at-risk` (риск) or `blocked` (блокер). There is no third state and no default.

## What Changes

- `severity` becomes REQUIRED in the risk Zod contract (drop `.optional()`; inventory every risk shape in `packages/shared` that re-declares optionality).
- Drop `@default("at-risk")` from the Prisma `Risk.severity` column (hand-edit the init migration; `migrate reset` per DB) — writes must always carry an explicit value, boot/write fails loud otherwise.
- Tighten `riskSeverityToCanonicalFloor` to accept `RiskSeverity` (exact mapping `blocked → blocked`, `at-risk → at-risk`); the "anything else" branch disappears.
- Delete the now-impossible-state defenses: the API-side explicit-severity filter in `deriveEffectiveProductStatus` and the web-side coercion in `deriveEffectiveStageStatus`; read-model types carry required severity.
- Update characterization grids: the unset-severity permutation leaves the type space (an intentional, ratified assertion change — the only one).

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `status-risk-unification`: risk severity is a required contract field; every floor derivation consumes an explicit severity.

## Impact

- Shared: `section.schema.ts` (+ sibling risk shapes), `canonical-status.ts` floor signature.
- API: `report-sections.status-derivation.ts` filter removal; read-model/mapper types; risk write paths already pass severity through.
- Web: risk read-model types (`{severity?: string}` → required), `stage-status.ts`, derivation grids.
- Prisma: schema + init-migration edit + `migrate reset` on `_dev`/`_test` (MVP: disposable).
- No user-visible behavior change: the DB has always guaranteed the value; this makes the types tell the truth.

## Non-goals

- Changing the severity vocabulary (stays the two-value `at-risk`/`blocked` enum).
- Any change to the floor rule itself, the ladder, or collapse-down semantics.
