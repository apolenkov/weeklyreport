# Add a discoverable exit affordance to lead slides fullscreen

## Why

A lead entered slides fullscreen and could not find how to leave (live
feedback, 2026-06-20: "она раскрыла, а обратно-то как?"). The slide deck uses
the native browser Fullscreen API. Exit paths exist but none is discoverable on
the **lead** deck:

- the in-toolbar toggle flips to an "Exit fullscreen" icon, but in the lead deck
  it lives in the hero/toolbar controls that can scroll out of view in fullscreen;
- `Esc` always exits (native, cannot be suppressed) but there is no on-screen hint;
- an undocumented `f` key toggles fullscreen;
- a click-anywhere handler exits — but only on the lead article, and it can
  collide with interactive children.

A persistent floating "Exit" pill (`variant="floating"`) already exists in the
code but is mounted **only on the head slide article**, never the lead deck —
the exact gap the lead hit. The durable `status-slide-rendering` spec already
requires "a visible control … the user MUST never be trapped in fullscreen"; the
lead deck does not satisfy it.

## What Changes

1. **Mount the floating exit pill on the lead deck.** Render the existing
   `SlideFullscreenButton variant="floating"` on the lead slides container (it
   self-renders only while `document.fullscreenElement` is set), giving a
   persistent top-right "Exit fullscreen" control regardless of scroll position —
   matching the head deck.
2. **Transient "Press Esc to exit" hint** shown for ~3s on entering fullscreen,
   auto-dismissed, low-emphasis, rendered inside the fullscreened element. Esc is
   the guaranteed escape hatch; the UI only needs to make it discoverable (MDN).
3. **Accessibility:** add `aria-pressed={isFullscreen}` to the toggle; on exit,
   return focus to the toggle so keyboard users are not stranded. State stays
   driven by the native `fullscreenchange` event (already wired), so the controls
   stay correct even when the user exits via `Esc`.

## Non-goals

- Not changing which element goes fullscreen, nor the enter behaviour.
- Not reworking the head deck (it already has the floating pill).
- The undocumented `f` shortcut and the lead click-anywhere handler are reviewed
  in `design.md`; removing them is optional and called out, not required here.
- No native-fullscreen polyfill / vendor prefixes (unprefixed API is supported
  across current target browsers).

## Capabilities

- `status-slide-rendering` — MODIFIED: the exit-fullscreen affordance must be a
  persistent visible control on every deck (lead included) plus a discoverable
  Esc hint, with `aria-pressed` and focus return.
