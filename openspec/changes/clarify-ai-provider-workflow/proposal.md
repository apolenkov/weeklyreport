## Why

The current `AI → Provider` surface exposes a large direct form before it
answers the administrator's first question: whether AI is configured and what
must happen next. The existing API already has a lifecycle (`save`, `test`,
`activate`, `disable`, `restore`, `discard`, and progress reads), but the UI
does not present that lifecycle as a coherent workflow. This makes active,
draft, preparing, failed, and unconfigured states difficult to scan and makes
available actions appear arbitrary.

The decision-ready research in
`docs/research/admin-ai-provider-card-ux-2026-09-04.md` recommends a compact
state summary, peer Generation and Embeddings cards, an explicit lifecycle
stepper, and retained history as secondary recovery detail.

## What Changes

- Replace the current direct-form/no-summary presentation in
  `ai-provider-admin-layout` with a top state summary and a guided
  `Configure → Test → Activate` workflow.
- Present Generation and Embeddings as distinct peer cards while preserving
  conditional separate-embedding fields and the current PEO visual language.
- Show explicit reasons for disabled actions, loading/progress states, and
  actionable operation errors using the existing API results.
- Make configuration mode explicit: an active revision opens in read/summary
  mode with `Edit configuration`; an unconfigured or draft revision opens the
  editable form needed to continue setup.
- Keep retained revisions and diagnostics available as secondary detail, with
  restore/discard actions mapped to their existing server semantics.

## Non-goals

- No API, tRPC, database, lifecycle, provider allowlist, or secret-handling
  changes.
- No model discovery, provider catalog, new provider, or embedding backend
  behavior.
- No change to active-service continuity during preparation or to the existing
  organization-wide configuration model.
- No replacement of the established PEO palette, typography, tokens, or page
  shell.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ai-provider-admin-layout`: make provider state and the existing lifecycle
  understandable through a summary-first, guided card layout.

## Impact

The change is limited to the Admin AI Provider presentation, interaction copy,
and browser/unit acceptance around existing contracts. It should not require a
Prisma migration, new runtime dependency, API route, or provider integration.
