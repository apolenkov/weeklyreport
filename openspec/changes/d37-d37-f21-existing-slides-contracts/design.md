# Design

## Context

See proposal.md and the D37-F21 durable BRIEF. Current section readiness already follows the published own-status contract. Loaded/skeleton and author-marker classes already have `slide-layout.ts` as their owner.

## Goals / Non-Goals

Repair only demonstrated existing contracts. Preserve report isolation, risk-derived own readiness, author color/order, accessibility names, layout tokens and outer fullscreen identity. No new API or test-only production seam.

## Decisions

- Initials: roster consumers call the existing web wrapper, preserving its empty placeholder and code-point behavior.
- Empty cards: a project subsection counts as status context only when its effective status is non-null. Update-bearing subsections remain visible.
- Lead reads: own-deck loading includes the enabled cross-author health query. Error-state policy remains unchanged.
- Head reads: activity error reporting uses an unconditional existing hook call with `isError` gated by the same fallback enablement. A cached unrelated error is not an active page failure.
- Source ownership: one article-key formula, existing shared traffic adapter for all status labels/icons, text-only foreign item rows, and removal of unreachable first-child style variants. These mechanics preserve runtime values and require no manufactured behavioral RED.

Before: enabled health pending → ready own deck; active activity error → empty state without site log. After: enabled health pending → loading; active activity error → existing empty state plus one log-only policy entry. No database or schema path changes; lifecycle tuple, role middleware and destructive guard invariants are preserved.

## Risks / Trade-offs

- Native layout, AT and configured log-forwarder delivery are unmeasured → retain needs-evidence; coordinator owns native acceptance.
- Optional cross-author failure is not changed to a new fatal deck policy.
- No performance improvement is claimed for removing dead item alarm work.

## Migration Plan

No migration, new dependency or feature flag. Deliver an owned patch for Root ordinary-hook integration; revert that patch for rollback. Full six gates and independent review remain coordinator-owned.
