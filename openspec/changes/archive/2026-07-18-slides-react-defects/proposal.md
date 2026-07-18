## Why

BL-14 (P1) from `docs/reviews/repo-excellence-review-2026-07-14.md`. Three
independent React/a11y defects in the status slide deck, all confirmed
against current source:

**(a) Duplicate React keys on the head carousel.** `HeadSlideCarousel`
(`apps/web/src/features/slides/ui/head-slide-carousel.tsx`) keys its option
buttons by `key={item.id}` alone. `paginateSectionSlides` splits one
section's items across multiple pages without changing `item.id` — only
`pageIndex` differs — so a section that exceeds
`DEFAULT_PRODUCTS_PER_PAGE` produces two-or-more carousel cards sharing one
React key. `StatusSlideDeck` (same file's sibling, `status-slide-deck.tsx`)
already worked around this same collision for its own keyed nodes with
``key={`${slide.id}:${String(slide.pageIndex ?? 0)}`}``; the carousel
button was never given the same treatment.

**(b) Fullscreen force-exit on arrow-key navigation.** `HeadSlideFrame`
(defined inside `status-slide-deck.tsx`, lines 33-49) owns its own
`useFullscreen(frameRef, frameRef)` call, and `StatusSlideDeck` renders it
keyed by ``key={`${slide.id}:${String(slide.pageIndex ?? 0)}`}`` (line
156-157). `StatusSlideDeck`'s own `handleKeyDown` (arrow-key navigation,
bound on the persistent outer `<section>`, line 66-75) calls `onSelect`,
which changes `selectedIndex` — and because the key changes with the slide,
React unmounts and remounts `HeadSlideFrame` on every arrow-key press. A
fresh `frameRef` means `useFullscreen` re-initializes, and the remount tears
down the actual `Fullscreen API` element — the browser force-exits
fullscreen. The lead deck (`isLead` branch, same file, lines 144-154) does
not own fullscreen inside the keyed node at all, so it does not hit this;
the head branch is the only one affected.

**(c) Missing Space-key activation on slide rows.** `slide-article-rows.tsx`
renders own-editable rows with `role="button"` (line 226) but
`handleKeyDown` (line 197-201) only checks `event.key !== "Enter"` — Space
is silently ignored, violating the WAI-ARIA `role="button"` keyboard
contract (both Enter and Space MUST activate a button). The
`slide-inline-record-editing` spec already documents Enter as an activation
path ("double-clicks (or presses Enter on a focused) own item, risk, or
decision row") without mentioning Space.

## What Changes

- `head-slide-carousel.tsx`: key each carousel button by
  `` `${item.id}:${item.pageIndex ?? 0}` ``, matching the composite key
  `StatusSlideDeck` already uses.
- `status-slide-deck.tsx`: hoist `useFullscreen` from `HeadSlideFrame` to
  `StatusSlideDeck`'s persistent root (the outer `<section>`, which is
  never remounted by `selectedIndex` changes), and pass
  `isFullscreen`/`onToggle` down to the keyed slide-frame node instead of
  each frame owning its own fullscreen instance — mirroring how the lead
  branch already avoids owning fullscreen inside a keyed node.
- `slide-article-rows.tsx`: `handleKeyDown` also activates on `" "` (Space),
  calling `event.preventDefault()` for both keys (Space's default is page
  scroll on a non-native button element, so the guard is load-bearing, not
  cosmetic).

## Claim disposition

| Claim (review doc)                                                                       | Disposition                                                                                                                                                                                                                                                                                                                                       | Evidence                                                                                                                                                                       |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| (a) Carousel buttons key by `item.id` alone; pagination never changes `item.id`          | CONFIRMED                                                                                                                                                                                                                                                                                                                                         | `head-slide-carousel.tsx` line ~38 `key={item.id}`; `StatusSlideDeck` uses `` `${slide.id}:${pageIndex ?? 0}` `` for the same collision elsewhere in the same file             |
| (a) `StatusSlideDeck` already worked around the same collision with a composite key      | CONFIRMED                                                                                                                                                                                                                                                                                                                                         | lines 149, 157 of `status-slide-deck.tsx`                                                                                                                                      |
| (b) `HeadSlideFrame` owns `useFullscreen` and is keyed per-slide                         | CONFIRMED                                                                                                                                                                                                                                                                                                                                         | lines 33-49 (component + hook call), line 156-157 (keyed render site)                                                                                                          |
| (b) Arrow-key navigation is handled on an ancestor and remounts the fullscreened element | CONFIRMED                                                                                                                                                                                                                                                                                                                                         | `handleKeyDown` on `<section>` (line 66-84) calls `onSelect`, which is the `selectedIndex` state setter one level up; the key prop changes when `slide.id`/`pageIndex` changes |
| (b) The lead deck avoids this by owning fullscreen on a persistent outer ref             | CONFIRMED — but not literally "the lead deck owns fullscreen"; the lead branch (line 144-154) does not call `useFullscreen` inside `StatusSlideDeck` at all. `LeadSlidesClient` owns its own fullscreen elsewhere, outside the keyed slide render. Framed correctly as "the head branch is the only one with fullscreen inside a remounted node." |
| (c) `role=button` row only handles Enter, not Space                                      | CONFIRMED                                                                                                                                                                                                                                                                                                                                         | `slide-article-rows.tsx` line 197-201 `if (event.key !== "Enter") return;`                                                                                                     |

## Non-goals

- Not touching `LeadSlidesClient`'s own fullscreen ownership — it is
  unaffected by this bug class (verified: it does not remount on
  arrow-key nav).
- Not changing `paginateSectionSlides`'s pagination model or `item.id`
  scheme — the fix is key composition on the consuming component, not the
  data model.
- Not adding Space handling anywhere `role="button"` is not already present
  on slide rows (e.g. status badges, tooltips) — scoped to the one
  activatable row in `slide-article-rows.tsx`.
- Not a `head-slide-density` visual/layout change — no screenshots or
  design sign-off required; this is a defect fix within the existing
  carousel/fullscreen/keyboard contract, not a redesign. (The spec's
  "ships only with recorded sign-off" requirement gates NEW density/layout
  work, not bug fixes to already-accepted behavior.)

## File manifest

- `apps/web/src/features/slides/ui/head-slide-carousel.tsx` — composite key
  fix.
- `apps/web/src/features/slides/ui/status-slide-deck.tsx` — hoist
  `useFullscreen` to the outer `<section>`; `HeadSlideFrame` becomes a
  presentational component receiving `isFullscreen`/`onToggle` as props
  instead of calling the hook itself.
- `apps/web/src/features/slides/ui/status-slide-deck.test.tsx` — add cases:
  arrow-key navigation while fullscreen keeps `isFullscreen` true across a
  slide change; carousel-card selection likewise.
- `apps/web/src/features/slides/ui/slide-article-rows.tsx` — Space-key
  activation.
- `apps/web/src/features/slides/ui/slide-article-rows.test.tsx` — add a
  Space-key activation case alongside the existing Enter case.
- No new test file for `head-slide-carousel.tsx` exists today; add
  `apps/web/src/features/slides/ui/head-slide-carousel.test.tsx` asserting
  no duplicate keys are produced for a paginated section (render with two
  pages sharing one `item.id`, assert both cards render without a React
  key-collision console error/warning).

No barrel changes — all three files are internal to the `slides` feature
slice; no new cross-slice export is introduced.

## Verification

(b) and (c) are exactly the class of defect unit tests under jsdom can miss
(jsdom's Fullscreen API and native Space-key default-scroll behavior are not
faithfully emulated) — a live browser drive step is required in addition to
the unit suite:

1. Unit: `cd apps/web && pnpm exec vitest run src/features/slides/ui/head-slide-carousel.test.tsx src/features/slides/ui/status-slide-deck.test.tsx src/features/slides/ui/slide-article-rows.test.tsx`
2. Live (Playwright MCP or manual, real Chromium — jsdom does not implement
   `Element.requestFullscreen`):
   - Boot web+api from source.
   - Dev-login as head; open a report with a section exceeding the
     per-page product count, in slides mode.
   - Confirm the carousel renders one card per paginated page without a
     duplicate-key console warning.
   - Enter fullscreen on a slide, press ArrowRight/ArrowLeft to navigate;
     confirm fullscreen stays active across the navigation (no forced exit).
   - Tab to an own editable slide row; press Space; confirm the edit dialog
     opens (same as Enter today).
3. `pnpm typecheck && pnpm lint && pnpm test`
4. `pnpm build` (webpack production build — the repo's real gate for this
   slice; no barrel changes here, but the standing rule from `docs/adr/0016`
   is to keep the build green through every change in this batch).

## Sequencing

Standalone — independent of `viewer-period-navigator-scope`,
`admin-presentation-type-ssot`, and `stage-step-component-dedup`. No shared
files with any of the other three changes in this batch.
