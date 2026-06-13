# Tasks — Redesign Head Slide Density

IMPLEMENTED 2026-06-11 (was captured 2026-06-10 as capture-only). Group 1
(taste questions) was answered by the user 2026-06-10, which unblocked
implementation; groups 2–6 landed 2026-06-11. Outstanding: screenshot
acceptance (7.2) and user sign-off (7.3). Spec contract:
`specs/head-slide-density/spec.md`; design decisions D1–D5 in `design.md`.

## 1. Settle direction (blocks all implementation)

- [x] 1.1 Walk the user through design Open Questions 1–6 (grid shape,
      watermark, attribution, sidebar treatment, metric tiles, shared
      `QuadrantCard` extraction); record each answer in `design.md` as a
      dated decision before any code.
      ANSWERED 2026-06-10: 2×2 grid; watermark yes; product badge yes;
      sidebar restyled to card idiom; metrics as the lead capsule;
      shared-component call deferred until geometry is final. See
      design.md "Open Questions — ANSWERED".
- [x] 1.2 Confirm no new color token is needed — verify every accent maps
      to an existing token in `packages/ui/src/styles/globals.css`
      (`--slide-quadrant-min`, `--color-decisions-accent`, chip-border
      tokens); record the confirmation.
      CONFIRMED 2026-06-11: all accents resolve to existing tokens in
      `packages/ui/src/styles/globals.css` —
      `--color-chip-on-track-border` (:51), `--color-chip-at-risk-border`
      (:54), `--slide-quadrant-min` (:131), `--color-status-dot-at-risk`
      (:137), `--color-decisions-accent` (:141), plus the long-standing
      `--color-primary`. No new token added.

## 2. Card shell (apps/web)

- [x] 2.1 Decide D3: extract a shared `QuadrantCard` from
      `lead-unified-slide.tsx` for both slides to import, OR give
      `HeadSlideArticle` a head-local card matching the same recipe —
      per the geometry settled in 1.1.
      DECIDED 2026-06-11 per recorded answer 1.1 #6: head-local
      `HeadSectionCard` in `status-slide-deck.tsx` matching the lead card
      recipe; shared extraction deferred until the geometry survives the
      screenshot-acceptance round (comment at the card marks this).
- [x] 2.2 Replace the head content block (`status-slide-deck.tsx:229`,
      `grid gap-4 xl:grid-cols-2` of bare `<section>`s) with framed cards:
      existing card shell, per-card left status stripe from the token map
      (Current → `--color-chip-on-track-border`, Next → `--color-primary`,
      Risks → `--color-chip-at-risk-border`, Decisions →
      `--color-decisions-accent`), per-card `min-h` floor from
      `--slide-quadrant-min`, in the grid shape chosen in 1.1.

## 3. Neutral headers and row rendering (apps/web)

- [x] 3.1 Make all head section headers neutral (muted foreground);
      remove the red Risks header (`status-slide-deck.tsx:247`) and the
      green Decisions header (`:257`) — hierarchy via typography weight.
- [x] 3.2 Drop count-based truncation: remove the `textList` `limit = 3` + "+N more" behavior (`:104`, `:124-128`) for head section cards;
      every row renders.
- [x] 3.3 Render an empty section as a framed dashed-border placeholder
      with section-specific copy; remove the conditional-hide of the
      Decisions section (`:255`). Keep the decisions overflow reachable via
      in-card scroll (per `status-slide-rendering` overflow rule).

## 4. Head-specific surfaces (keep distinct)

- [x] 4.1 Confirm the multi-lead sidebar (`status-slide-deck.tsx:439`),
      readiness aside (`:272`), metric tiles (`:215`), owner header
      (`:191`), and `AgentReviewComingSoon` (`:221`) stay distinct — apply
      only the consistency restyle chosen in 1.1, no structural fold into
      the card grid. Keep cross-lead navigation working.
- [x] 4.2 Apply attribution per the 1.1 decision (D5): product badge on
      head rows, or none if per-lead grouping makes it redundant.

## 5. Resolve the deferral and clean up

- [x] 5.1 Remove `TODO(v8.4.3-slide-redesign)`
      (`status-slide-deck.tsx:225-228`) now that the redesign lands; remove
      any orphaned imports/helpers the rewrite leaves (e.g. an unused
      `metricLabel`/`textList` path if the head no longer uses it).

## 6. Tests

- [x] 6.1 Unit tests for the new contract: head section renders framed
      cards (not bare sections); empty section renders the dashed
      placeholder (never hidden / bare header); dense section renders all
      rows with no "+N more"; section headers are neutral; each stripe
      uses its token. Update any existing head-slide tests/snapshots that
      assert the old DOM.

## 7. Gates, screenshots, and user acceptance

- [x] 7.1 Gates: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
      — record results here.
      PASSED 2026-06-11: `pnpm typecheck` clean (5/5 tasks);
      `pnpm lint` clean (ESLint: no issues); `pnpm test` 1031/1031 web
      tests green (113 files); `pnpm build` succeeded (29s).
- [ ] 7.2 Live screenshots: head deck with one lead, many leads, an
      empty-section lead, a dense-decisions lead, and fullscreen;
      before/after pairs per `status-color-semantics`.
      NOTE 2026-06-11: not taken in the overnight run — the "before"
      state needs the pre-change build (recoverable: parent of the
      implementation commit) and the listed data states need targeted
      seeding; do this in the morning acceptance session.
- [ ] 7.3 User acceptance: present the before/after set; fold any feedback
      rounds back into design/tasks (the lead slide needed four); record
      explicit accept + archive approval before archiving.
