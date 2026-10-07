## Context

See proposal.md. The probe provides the anchor and observable identity; restoration already reloads when repeated pressing does not restore the parent signature.

## Goals / Non-Goals

Require identity and availability at event time. Do not infer equivalence from renamed labels or execute actions against a replacement.

## Decisions

Use the existing page probe for normalized names and semantic roles. Keep full names for identity; shorten only diagnostic display text. Pass the original control to undo so native tag and role are checked alongside the selector anchor. Check current disabled state and viewport hit-test after scrolling before the existing press routine.

Prefix matching and empty-name matching are insufficient evidence. Renamed toggles fall back to bounded reload instead of a label-guessing table.

## Risks / Trade-offs

- Renamed controls need reload: preserve the current fallback.
- Browser checks need the local agent-browser binary: opt-in real-browser tests run explicitly for local acceptance, with isolated synthetic HTTP and no product DB.

## Rollout

No migrations or flags. Period dual-state, role coverage and the destructive database guard remain unchanged. No API/web consumers change. Rollback is the group commit.
