# Design

## Context

Selected roots and test admission are in the external D37-F14 BRIEF. Public baseline RED reaches actual production hooks/components. Three prior repairs are already present in b7525eb and remain unchanged.

## Goals / Non-Goals

Use existing contracts and their owners. Keep UTC/null/date range, period lifecycle, query, draft reseed, keyboard and route encoding semantics. No new provider or database boundary, numeric admission policy or layout redesign.

## Decisions

- Apply the existing query error hook and mutation-copy helper. Reuse canonical route prefixes verbatim.
- Keep numeric hints mounted with linked errors; remove unsolicited focus movement. Deadline time uses the shared settings admission and local raw/committed state, with the existing parent validity/dirty guard.
- Disable frozen envelope inputs while retaining the exact original Date instants and nullable deadline in a label submission, without converting the displayed date/time inputs back into values; do not alter backend admission or payload policy.
- Period options select on click and primary mousedown only prevents focus loss. Use CSS bottom anchoring above a lower trigger so natural panel height remains authoritative; the existing height cap has one owner and available vertical room bounds scrolling.
- Deduplicate field/SVG presentation without changing glyphs or utility values. History copy changes neither ordering nor streak algorithm.

## Risks / Trade-offs

JSDOM and assigned rectangles verify event/position calculations, not measured browser geometry, Safari or AT. Native numeric sanitization, Decision malformed producer and skeleton layout remain explicit evidence gaps. Root owns integrated full gates/native acceptance. No Report tuple, canonical auth or destructive-target invariants change.

## Migration Plan

Source-only patch intake; no schema or data migration. Root normal hooks/main delivery and aggregate acceptance. Rollback by scoped source reversal.
