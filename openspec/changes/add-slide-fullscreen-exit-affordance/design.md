# Design

## Context

`slide-fullscreen-button.tsx` toggles native fullscreen
(`el.requestFullscreen()` / `document.exitFullscreen()`) and already syncs its
state from the native `fullscreenchange` event (so the icon/label flip
Maximize↔Minimize correctly even on `Esc` exit). It exposes two variants:

- default — an in-flow toolbar button (icon + `aria-label` flip), mounted in the
  LEAD hero/toolbar controls (`lead-slides-client.tsx`, `lead-form.tsx`). The
  HEAD deck has NO default toggle.
- `floating` — a `fixed top-4 right-4 z-50` pill that returns `null` unless
  `isFullscreen`, mounted ONLY inside `HeadSlideArticle`
  (`status-slide-deck.tsx:286`).

Corrected against the real code (Codex round 2 flagged my earlier wrong premise):
the lead deck has the persistent default toggle and NO floating pill; the head
deck has the floating pill and NO default toggle. Crucially, the `f` keydown +
`fullscreenchange` listeners live in EVERY `SlideFullscreenButton` instance's
effect and keep running even when the floating pill renders `null` (the early
return is after the hooks). So today there is exactly one `f` owner per deck:
lead = the default toggle, head = the always-mounted floating instance. Adding a
floating pill to the LEAD would create a SECOND `f` owner on lead → double toggle.

The lead deck's only exit control (the default toggle) can scroll out of view in
fullscreen — the reported "cannot find how to leave". The head deck already has
the floating exit pill, so its EXIT is fine; its ENTER is `f`-key-only (no
visible enter button) — a separate, pre-existing gap, noted but out of scope.

Verified against MDN Fullscreen API + web.dev + caniuse:

- `Esc` (and F11) ALWAYS exit and cannot be suppressed — it is the guaranteed
  escape hatch; the product's only job is discoverability.
- Drive UI from the `fullscreenchange` event + `document.fullscreenElement`,
  never a local boolean — the repo already does this.
- `requestFullscreen()` rejects without transient activation / in disallowed
  iframes; the existing `.catch` handles that.
- The unprefixed API covers current target browsers (Chrome 71+, Firefox 64+,
  Safari 16.4+, Edge 79+); no polyfill needed.

## Decision 1 — reuse the floating pill on the lead deck

**Chosen:** mount the existing `SlideFullscreenButton variant="floating"` on the
lead slides container, exactly as the head deck does. It self-gates on
`isFullscreen`, so it adds nothing outside fullscreen and a persistent, always-
visible top-right "Exit fullscreen" control inside it. No new component.

Rejected: a bespoke lead-only exit button (duplicates the floating variant);
relying on the toolbar toggle alone (the bug — it scrolls away).

**One owner for the global `f` shortcut — hoist to deck level (Codex F5/N4).**
The `f` keydown + `fullscreenchange` currently live in each button's effect.
Adding the floating pill to the lead would add a second document keydown handler —
two competing handlers plus a SPLIT state source (each instance keeps its own
local `isFullscreen`), not a clean "double toggle that cancels out". A per-variant
guard ("floating never registers `f`") is WRONG: the head
deck's ONLY instance is the floating one, so that guard would strip `f` from head
entirely — and head has no default toggle and no visible enter button, so it
would become unable to enter fullscreen at all. The correct fix is to hoist the
`f` shortcut + the `fullscreenchange` subscription into a SINGLE deck-level owner
— a `useFullscreen(targetRef)` hook called once per deck container (always
mounted) — and make `SlideFullscreenButton` a presentational toggle that receives
`isFullscreen` + `onToggle`. Then each deck has exactly one `f` owner and one
state source: the lead's added floating pill creates no second listener, and head
keeps its single `f` owner. This is also the research recommendation (drive state
from one `fullscreenchange` owner, not per-component local state).

**Lead ownership is split across two components — make it explicit (verify
finding).** On the primary lead path (`/lead/report/[reportId]?mode=slides`) the
toolbar toggle is rendered by `lead-form.tsx` while the new floating pill goes
inside `LeadSlidesClient` (also rendered by `lead-form.tsx`, sharing only
`deckRef`, NOT fullscreen state). A shared ref is not shared state, so "one hook
per deck" must say WHO owns it per topology:

- **lead-form-hosted path:** `lead-form` owns the single `useFullscreen(deckRef)`
  hook and threads `isFullscreen` + `onToggle` BOTH into its own toolbar toggle
  AND down into `LeadSlidesClient` (new props) so the floating pill is purely
  presentational. One owner, one keydown listener.
- **standalone `LeadSlidesClient` path:** `LeadSlidesClient` owns the hook itself.
- **head:** single component (`HeadSlideArticle`) owns its hook.
  Acceptance check: with both lead controls mounted, exactly ONE document keydown
  listener exists. Without this, a literal implementation gives either two hooks
  (two listeners) or one (the other component's button never gets state and never
  renders) — losing either the toolbar toggle or the floating pill on the lead.

## Decision 2 — transient "Press Esc to exit" hint

**Chosen:** on entering fullscreen, show a low-emphasis pill "Press Esc to exit"
for ~3s, then auto-dismiss; rendered INSIDE the fullscreened element (else it is
invisible in fullscreen). This directly addresses the discoverability gap; `Esc`
is the universal exit. It complements the floating pill (the persistent path).

Mechanics: a small effect keyed off the `isFullscreen` transition sets a
visible flag and clears it on a timer; cleared immediately if the user exits.
Tests use fake timers per `web-test-timer-discipline`.

## Decision 3 — a11y: aria-pressed + focus return

`aria-pressed={isFullscreen}` on the toggle (it is a toggle button). On the
transition to non-fullscreen, the deck-level owner returns focus to a STABLE
element — NEVER the floating pill, which unmounts when `!isFullscreen` (Codex
F6/N7). The stable target is per-deck: on the LEAD deck it is the persistent
toolbar/hero toggle (the "Enter fullscreen" affordance); the HEAD deck has no
persistent toggle, so focus returns to the deck article made PROGRAMMATICALLY
focusable — add `tabIndex={-1}` to the `HeadSlideArticle` root and `.focus()` it
(Codex X2 — a plain `<article>`/`<h2>` is not focusable). The requirement is
"return focus to a concrete focusable control on the deck", not "the toolbar
toggle" specifically. Holds for exit via pill, toggle, or `Esc`. Label flips
between "Enter fullscreen" / "Exit fullscreen".

## Reviewed but NOT required here

- **`f`-key behaviour** is now in scope only to the extent of single-owner
  hoisting (above). Whether to KEEP the `f` shortcut at all, scope it to the
  slides container, or document it is a taste call left to the user; this change
  preserves it with one owner rather than removing it.
- **Head ENTER affordance** — head can only enter fullscreen via `f` (no visible
  button). Pre-existing gap; the `useFullscreen` hook makes adding a head enter
  toggle trivial later, but it is out of this change's lead-focused scope.
- **Lead click-anywhere-to-exit** (`status-slide-deck.tsx:240-246`) — can bubble
  from interactive children (product chips) and exit unexpectedly. With the
  floating pill + Esc hint present it is redundant and a candidate for removal;
  flagged for the user, not removed here.

## Spec & invariants

- `status-slide-rendering` "Slide Deck Must Provide an Exit-Fullscreen
  Affordance" is MODIFIED to require a PERSISTENT visible exit control on every
  deck (lead included) plus a discoverable Esc hint, `aria-pressed`, and focus
  return — the current text is satisfied only by the head deck.
- No DB / API / shared-schema change.

## Test strategy

jsdom cannot enter real fullscreen. Per the research recipe: stub
`document.fullscreenElement` via `Object.defineProperty` and dispatch a
`fullscreenchange` `Event`; assert the toggle's `aria-pressed`, label, and icon
flip, that the floating pill renders on the lead container only while
"fullscreen", and that the Esc hint appears then auto-dismisses (fake timers).
Live-verify real enter/exit in a browser.
