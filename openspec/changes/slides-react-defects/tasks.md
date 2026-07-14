## 1. Fix duplicate carousel keys

- [ ] 1.1 `apps/web/src/features/slides/ui/head-slide-carousel.tsx`: change
      the button `key` from `item.id` to
      `` `${item.id}:${item.pageIndex ?? 0}` ``
- [ ] 1.2 `apps/web/src/features/slides/ui/head-slide-carousel.test.tsx`
      (new file): render the carousel with two `SectionSlideModel` entries
      sharing one `id` but different `pageIndex`, assert two cards render
      and no duplicate-key warning is logged

## 2. Persist fullscreen across slide navigation

- [ ] 2.1 `apps/web/src/features/slides/ui/status-slide-deck.tsx`: move the
      `useFullscreen(frameRef, frameRef)` call and its `frameRef` from
      `HeadSlideFrame` up to `StatusSlideDeck`'s render body (the outer
      `<section>` is not remounted on `selectedIndex` change)
- [ ] 2.2 Turn `HeadSlideFrame` into a presentational component receiving
      `frameRef`, `isFullscreen`, and `onToggle` as props instead of calling
      `useFullscreen` itself
- [ ] 2.3 Confirm the outer `<section>`'s `handleKeyDown` (Arrow
      navigation) still updates `selectedIndex` without touching the
      hoisted `frameRef`/fullscreen state
- [ ] 2.4 `apps/web/src/features/slides/ui/status-slide-deck.test.tsx`: add
      a case that enters fullscreen (invoke `onToggle`/the overlay control),
      then fires an ArrowRight keydown on the deck root, and asserts
      `DeckFullscreenOverlay`'s `isFullscreen` prop / rendered state is
      still true after the slide change

## 3. Space-key activation on slide rows

- [ ] 3.1 `apps/web/src/features/slides/ui/slide-article-rows.tsx`:
      `handleKeyDown` activates on both `"Enter"` and `" "`, calling
      `event.preventDefault()` for either
- [ ] 3.2 `apps/web/src/features/slides/ui/slide-article-rows.test.tsx`: add
      a case firing a Space keydown on an activatable row and asserting
      `onRowActivate` fires, mirroring the existing Enter case

## 4. Spec delta

- [ ] 4.1 `head-slide-density`: MODIFY "The head deck navigates via a top
      carousel" to require collision-free carousel keys across paginated
      pages of one section
- [ ] 4.2 `head-slide-density`: MODIFY "The active head slide keeps a
      visible fullscreen exit path" to require fullscreen state to persist
      across arrow-key/carousel slide navigation
- [ ] 4.3 `slide-inline-record-editing`: MODIFY "Double-click opens the
      record editor on own slide rows" to add Space as an equivalent
      keyboard activation path alongside Enter

## 5. Live verification (jsdom cannot emulate Fullscreen API or native Space scroll)

- [ ] 5.1 Boot web+api from source
- [ ] 5.2 Dev-login as head; open a report with a section exceeding the
      per-page product count in slides mode; confirm no duplicate-key
      console warning and both paginated cards render
- [ ] 5.3 Enter fullscreen on a slide, press ArrowRight/ArrowLeft; confirm
      fullscreen is not force-exited
- [ ] 5.4 Tab to an own editable row, press Space; confirm the edit dialog
      opens

## 6. Gates

- [ ] 6.1 `pnpm --filter @customreport/api db:generate`
- [ ] 6.2 `cd apps/web && pnpm exec vitest run src/features/slides/ui/head-slide-carousel.test.tsx src/features/slides/ui/status-slide-deck.test.tsx src/features/slides/ui/slide-article-rows.test.tsx`
- [ ] 6.3 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 6.4 `pnpm build`
- [ ] 6.5 `openspec validate slides-react-defects --strict`
