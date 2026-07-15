## Why

The head slide deck waits for, and can fail because of, `activity.live` even when weekly report sections already provide every slide. P1-4 in `docs/reviews/2026-07-15-external-sweep.md` identifies the unconditional loading/error gate in `head-slides-client.tsx`.

## What Changes

- Make weekly-report data the primary deck gate.
- Consult `activity.live` loading, error, and rows only when the loaded weekly report has zero lead sections and activity fallback is enabled.
- Keep viewer behavior unchanged: viewers never query the head-only activity procedure.
- Add tests for populated-report independence and empty-report fallback loading, failure, and success.
- Implement after `sweep15-placeholder-data-gating` because both changes touch the same report query consumer and loading-state contract.

## Capabilities

### New Capabilities

- `head-slides-activity-fallback`: live activity gates the deck only when it is actually the empty-report fallback source.

### Modified Capabilities

<!-- none -->

## Impact

- Web: `apps/web/src/features/slides/ui/head-slides-client.tsx` and its unit tests.
- No API, query contract, authorization, schema, or viewer behavior changes.

## Non-goals

- Removing activity fallback from the head deck.
- Adding viewer access to `activity.live`.
- Changing slide composition, ordering, or scope semantics.
