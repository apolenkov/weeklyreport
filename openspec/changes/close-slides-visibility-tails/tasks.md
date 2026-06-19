# Tasks — close-slides-visibility-tails

## 1. Tail 1 — fetch-gate divergence (code)

- [x] 1.1 Extract a pure predicate `crossAuthorContentFetchEnabled({ hasReport,
  visibilityHydrated, isEveryone, isOwnDeck })` into a shared util; unit-test
      its truth table, crucially the foreign-deck row (`isOwnDeck:false ⇒ false`
      even when `isEveryone`).
- [x] 1.2 Both hosts call it in their `enabled:` — `lead-form.tsx:466` passing
      `isOwnDeck: !isForeignSlidesDeck`, and `lead-slides-client.tsx:180` passing
      its existing `isOwnDeck`. This pins the "every host" spec clause via one
      tested function (Codex round-2 finding 1).
- [x] 1.3 Belt-and-suspenders (round-1 finding 2): add `!isForeignSlidesDeck` to
      the `foreignContentRows` memo guard (line 796) so foreign rows are gated at
      BOTH the fetch and the consume sites.
- [x] 1.4 Integration test in `lead-form-visibility.test.tsx` (the bug site, has
      the `crossAuthorContent` request spy): slides mode + persisted Everyone +
      a FOREIGN `authorId` ⇒ `crossAuthorContent` is never requested. Confirm the
      legitimate own-deck Everyone fetch (own `authorId` or none) still fires.

## 2. Tail 2 — per-row attribution Coming-Soon affordance (code)

- [x] 2.1 Extract a `useIsFullscreen` hook (reads `document.fullscreenElement`,
      subscribes to `fullscreenchange`); refactor `SlideFullscreenButton` to use
      it instead of its private `isFullscreen` state (round-2 finding 3).
- [x] 2.2 Add `ForeignTagsComingSoon` inert control (shared `ComingSoonBadge`
      primitive, canonical amber style, `title="Coming Soon"` + descriptive
      `aria-label`) under `apps/web/src/components/slides/`.
- [x] 2.3 Render it in the lead slide hero controls ONLY when
      `isEveryone && scope !== "product" && !isFullscreen` (own deck + Everyone +
      own-scope bullet-row view, NOT product-grid, AND hidden in fullscreen) in
      `lead-slides-client.tsx` (default branch, line 324), reading `useIsFullscreen`.
- [x] 2.4 Add it to the `coming-soon-style.test.tsx` canonical-style control
      list so the single-style guard covers it.
- [x] 2.5 Test: visible in Everyone own deck own-scope non-fullscreen; absent in
      Mine, on a foreign deck, in product-scope, AND in fullscreen (round-2
      finding 2 — simulate `document.fullscreenElement` / fire `fullscreenchange`).

## 3. Tail 3 — head-toolbar dismissals (decision record)

- [x] 3.1 Dismissals recorded in `design.md` with the live-check evidence
      (no code changes).

## 4. Tail 4 — Codex Act-2 disposition (decision record)

- [x] 4.1 Disposition recorded in `design.md`, naming the concrete no-leak
      guards (`section-slide-utils.test.ts` reference-unchanged +
      `lead-form-visibility.test.tsx` 7d.5/7d.8 own-only payload), not only the
      prose scenario.
- [x] 4.2 Append the disposition to `docs/adr/0003-slides-record-visibility-everyone.md`.

## 5. Gates + verify

- [x] 5.1 `openspec validate close-slides-visibility-tails --strict` clean.
- [x] 5.2 `npx prisma generate` then typecheck / lint / web + api tests green.
- [x] 5.3 Live-verify: foreign deck fires no `crossAuthorContent` read; Everyone
      own deck shows the affordance, Mine hides it.
