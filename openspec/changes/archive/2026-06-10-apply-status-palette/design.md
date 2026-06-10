# Design

## Context

Source of truth: the two memos in
`openspec/changes/archive/2026-06-10-polish-ui-density-and-palette/memos/`
(T5 = stage chips, T6 = preview card). Both were adversarially verified
against the repo; T6's line numbers were corrected during that pass. User
sign-off («го», 2026-06-10) is recorded in the archived change's T7 and
authorizes exactly: **T5 Option 3 + per-stage icons** and **T6 Option 2**.
Anything beyond those options is out of scope.

## Goals / Non-Goals

**Goals:**

- Implement the approved palette: muted chip fills, left-border status
  stripes instead of tinted card surfaces, neutral section labels, one alarm
  hue.
- Tokenize every hardcoded status color the memos inventoried.
- Per-stage lucide icons on SDLC chips.
- Visual acceptance by the user from same-viewport before/after screenshots.

**Non-Goals:**

- No global rebrand, no theme switching, no dark mode.
- No changes to chip/control sizing (that shipped in
  `polish-ui-density-and-palette`).
- No palette edits on surfaces the memos did not cover.

## Decisions

1. **One shared at-risk stripe token.** T5's stripe used `#987040`, T6's
   used `#a07c30` for the same semantic role on different surfaces. Implement
   ONE token `--color-status-at-risk-border: #a07c30` (the value whose WCAG
   1.4.11 non-text contrast was explicitly checked, ≈3.7:1 on
   `--color-surface-muted`) and use it for every at-risk stripe. T5's chip
   _border_ token stays per-memo (`--color-chip-at-risk-border: #987040`,
   sits on the chip's own bg). Rationale: two near-identical ambers for one
   meaning is exactly the drift this change exists to remove.
2. **Tokens live in `@theme`** in `packages/ui/src/styles/globals.css`,
   same block as the existing color tokens — no new file, no new naming
   scheme beyond the memo-specified `--color-chip-*` / `--color-status-*`.
3. **Stripe = `border-left` on the existing wrapper**, not a new element.
   `getProductBackground()` in `sdlc-pipeline.tsx` becomes a
   style-object helper returning `{ background, borderLeft }` so the JSX
   change stays minimal.
4. **Icons keyed by stage name, not status.** A separate
   `STAGE_ICONS: Record<StageName, LucideIcon>` map (ClipboardList, Search,
   PenTool, Hammer, FlaskConical, Server, Headset); the existing
   status glyph/dot logic in `STATUS_CONFIG` is unchanged. If the canonical
   stage list in code differs from the memo's seven, key off the code's list
   and note the diff in tasks evidence.
5. **Snapshot refreshes are expected** for these components; behavioral
   assertions (roles, aria, focus) must not be weakened.

## Risks / Trade-offs

- [Colors read differently in situ than as hex in a memo] → acceptance is by
  live before/after screenshots; user can reject and we revert tokens (one
  commit).
- [Stripe could shift layout by its border width] → compensate padding on
  the striped wrappers so content x-position is unchanged.
- [At-risk loses its filled-amber pill in the accordion header] → approved
  trade-off in T6 Option 2 (label text + neutral pill carry the state);
  flagged for the user's screenshot review.
- [`FlaskConical`/`Headset` availability] → both verified present in the
  installed `lucide-react@1.17.0` during T5 research.

## Migration Plan

Single landing commit (tokens + components + refreshed snapshots) after the
user approves the screenshots; rollback = revert that commit.
