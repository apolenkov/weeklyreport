# Tasks

## 1. Web — lead deck exit affordance (apps/web)

- [x] 1.1 Mount the floating exit affordance on the lead slides container
      (`lead-slides-client.tsx`), mirroring the head article. Implemented via the
      shared `DeckFullscreenOverlay` (floating pill + Esc hint) inside the
      `deckRef` div on BOTH render branches (own/summary + product); it
      self-gates on `isFullscreen`.
- [x] 1.2 Add a transient "Press Esc to exit" hint rendered inside the
      fullscreened element, shown ~3s on entering fullscreen then auto-dismissed;
      shared by lead + head decks (`DeckFullscreenOverlay` → `SlideEscHint`,
      top-center to avoid the top-right pill).
- [x] 1.3 (F5/N4) Hoisted the `f` keydown + `fullscreenchange` subscription into
      a single deck-level `useFullscreen(targetRef, focusOnExitRef, enabled)`
      hook (always mounted); `SlideFullscreenButton` is now presentational
      (`isFullscreen` + `onToggle`). Each deck has exactly one `f` owner.
- [x] 1.4 (verify finding) Lead ownership is explicit across the split: on the
      lead-form-hosted path `lead-form` owns the single `useFullscreen(deckRef)`
      and threads `isFullscreen` + `onToggle` into BOTH its toolbar toggle AND
      `LeadSlidesClient` (new props); the hosted `LeadSlidesClient` passes
      `enabled=false` to its local hook so NO second listener is added; the
      standalone path owns the hook itself. Acceptance proven directly by
      `use-fullscreen.test.ts` (two hooks, one disabled → exactly one keydown).

## 2. Web — toggle a11y (apps/web)

- [x] 2.1 Added `aria-pressed={isFullscreen}` to `slide-fullscreen-button.tsx`.
- [x] 2.2 On the transition to non-fullscreen, the `useFullscreen` owner returns
      focus to a STABLE per-deck target via `focusOnExitRef` — the lead's
      persistent toolbar toggle (captured via `buttonRef`); the head deck article
      made focusable via `tabIndex={-1}` (X2) — NEVER the floating pill (F6/N7).
      The hook only focuses on the true→false transition (not on mount).

## 3. Reviewed-but-deferred (flag only, no edit unless user agrees)

- [x] 3.1 Left a `TODO(add-slide-fullscreen-exit-affordance)` on the lead
      click-anywhere-to-exit handler in `status-slide-deck.tsx` noting it is now
      redundant with the pill + Esc hint and a removal/scoping candidate — NOT
      changed in this change. (The `f` shortcut is preserved with one owner.)

## 4. Tests (apps/web)

- [x] 4.1 jsdom: `slide-fullscreen-button.test.tsx` asserts `aria-pressed`/label
      flip + the floating self-gate; `deck-fullscreen-overlay.test.tsx` asserts
      the pill + Esc hint appear in fullscreen and the hint auto-dismisses (fake
      timers).
- [x] 4.2 (F6/F5) `use-fullscreen.test.ts` proves focus returns to the stable
      control ONLY on exit, `f` toggles exactly once, `f` is ignored in form
      fields, and the single-listener invariant (one enabled + one disabled hook
      → exactly one keydown owner) holds — the bug the whole hoist prevents.

## 5. Docs & specs

- [x] 5.1 `status-slide-rendering` delta — strengthens the exit-affordance
      requirement (this change).

## 6. Verification

- [x] 6.1 `pnpm typecheck && pnpm lint && pnpm test && pnpm build` green
      (combined gate across all five changes — see the implementation branch).
      NOTE: `lead-slides-client.tsx` carries a recorded `/* eslint-disable
    max-lines */` (last-resort, with reason) — it is one cohesive deck client
      whose reusable control bits are already extracted to
      `deck-fullscreen-overlay.tsx`; splitting the data layer further would
      scatter the unit for a marginal line count.
- [ ] 6.2 Live: enter fullscreen on the lead deck — the floating "Exit" pill and
      the transient Esc hint are visible; Esc and the pill both exit; the toggle
      returns to "Enter fullscreen" and regains focus. (Live-verify phase — see
      handoff.)
- [x] 6.3 `openspec validate add-slide-fullscreen-exit-affordance --strict`.
