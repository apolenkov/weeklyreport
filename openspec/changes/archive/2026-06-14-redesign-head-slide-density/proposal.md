# Redesign Head Slide Density

## Why

The lead "Own" slide was rebuilt 2026-06-10 into a strict, framed, neutral
density idiom (`redesign-lead-slide-quadrants`, four feedback rounds,
user-accepted). The head deck still renders the old loose layout the lead
slide left behind: a free-flowing `xl:grid-cols-2` content block that
"breaks visual rhythm at sparse / medium / heavy content density" — the
deferral the code itself records at
`apps/web/src/components/slides/status-slide-deck.tsx:225` as
`TODO(v8.4.3-slide-redesign)`. This change carries the accepted lead idiom
over to the head deck so the two surfaces read as one product, not two.

## What Changes

- `HeadSlideArticle` (`status-slide-deck.tsx:180`) adopts the lead idiom:
  framed cards with neutral section headers, fixed topology (height floors
  / no rhythm collapse), token-only accents, and a neutral identity badge
  for attribution.
- The head-specific surfaces stay head-specific: the multi-lead sidebar
  list (`status-slide-deck.tsx:440`), the per-lead readiness aside
  (`:272`), the metric tiles (`:215`), the agent-review coming-soon control
  (`:221`), and head navigation chrome are NOT folded into the lead idiom —
  the design enumerates SAME vs head-specific.
- Resolves the `TODO(v8.4.3-slide-redesign)` deferral
  (`status-slide-deck.tsx:225`); the comment is removed when the redesign
  lands.
- No new color tokens. No backend/API/schema work — purely presentational.
- This is CAPTURE-ONLY: artifacts only, no implementation. Direction is not
  chosen yet; the design opens the taste questions for the user to settle
  visually (he reviews screenshot-driven, as on the lead slide).

## Capabilities

### New Capabilities

- `head-slide-density`: durable density/layout invariant for the head-role
  status deck — framed cards, neutral section headers, fixed topology, and
  token-only accents adapted to multi-lead portfolio content. The durable
  `lead-slide-quadrants` spec governs only the lead "Own" slide and lists
  the head slide as a Non-goal; this is the parallel head contract.

### Modified Capabilities

<!-- none: status-slide-rendering scopes its density rules to the lead deck
     and states "the head-role report slides view is out of scope"
     (status-slide-rendering/spec.md:39, 50); status-color-semantics
     already permits reusing existing tokens, which this change does. No
     existing requirement changes. -->

## Impact

- `apps/web/src/components/slides/status-slide-deck.tsx` — `HeadSlideArticle`
  (`:180`) and the head sidebar/aside; possibly a small extract shared with
  `lead-unified-slide.tsx` if the quadrant-card shell is reused.
- Purely presentational — `SectionSlideModel` already carries every field
  the head slide needs (`section-slide-utils.ts:47-71`): per-lead items,
  risks, decisions, readiness, score, products.
- Status: IMPLEMENTED 2026-06-11 — taste decisions were recorded 2026-06-10
  (design "Open Questions — ANSWERED"), unblocking implementation. Awaiting
  screenshot acceptance and user sign-off (tasks 7.2–7.3) before archive.
