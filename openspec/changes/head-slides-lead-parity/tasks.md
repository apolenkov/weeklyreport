# Tasks — head slides lead-deck parity

## 1. Remove the deck heading band (S2)

- [x] 1.1 In `apps/web/src/components/slides/head-slides-client.tsx`, stop
      passing the head `title` ("Group Status Slides") and `subtitle` ("Group
      deck ordered by review risk before publishing.") that drive the deck's
      own heading band.
- [x] 1.2 In `apps/web/src/components/slides/status-slide-deck.tsx`, stop
      rendering the deck's standalone `<header>` heading band for the head
      surface in its entirety, so the report shell header (`Status Report` +
      context label) is the single title. The band holds FOUR things — remove
      all of them for the head surface, not just the title: - `<h1>{title}` + subtitle (S2); - the `groupLabel` pill — drop it: it is redundant with the shell
      header's department context label (`departmentLabel` in
      `head-report-shell.tsx`); - the `reportLabel` pill (week label + range) — drop it: the period
      identity is already carried by the `PeriodNavigator` combobox in the
      slides toolbar context row, so no week identifier is lost; - the "Open focused report" link (handled in task 2.3).
      Remove any prop / chrome that becomes orphaned (e.g. the head
      `title`/`subtitle`/`groupLabel`/`reportLabel` paths on the head branch).

## 2. Relocate Open focused report to the toolbar / header line (S3)

- [x] 2.1 Lift the active-slide owner out of `HeadSlidesClient` so the shell
      header line can target the active slide's lead focused report (see
      `design.md` — Option 1, state-lift).
- [x] 2.2 Render "Open focused report" on the slides-mode header line in
      `apps/web/src/components/head/head-report-shell.tsx`, beside the
      Export-PDF `DocumentActionGroup`, with a visible "Open focused report"
      label; do not render it when no active slide / active period resolves.
- [x] 2.3 Remove the in-deck "Open focused report" link from
      `status-slide-deck.tsx` (the head `sourceHref` / `sourceLabel` deck path).

## 3. Remove the readiness strip (S5)

- [x] 3.1 Delete `ReadinessStrip`, its `head-readiness-strip` testid, and the
      `<ReadinessStrip … />` render from `status-slide-deck.tsx`. The per-slide
      readiness/score model is no longer rendered as deck chrome. Remove any
      import/helper made unused by the deletion.

## 4. Relocate the Agent review placeholder to the toolbar (S6)

- [x] 4.1 Delete the `head-agent-review-slot` wrapper and its
      `AgentReviewComingSoon` render from `status-slide-deck.tsx`; drop the
      `AgentReviewComingSoon` import there if it becomes unused.
- [x] 4.2 In `head-report-shell.tsx`, extend the `mode === "form"` gate on the
      `AgentReviewComingSoon` in `contextControls` so the placeholder also
      mounts in slides mode (the gate existed only to avoid double-mounting
      against the now-removed slide-header slot). Slides mode MUST mount exactly
      one Agent-review placeholder — the toolbar context-row one.

## 5. Parity check (S1 umbrella)

- [x] 5.1 Confirm the head slides chrome reads like the lead-slides layout: no
      deck heading band, toolbar/header-line-hosted actions, Agent review in
      the toolbar context row, no head-only readiness strip. Use the lead deck
      / `head-report-shell` slides header as the reference.

## 6. Tests

- [x] 6.1 In `apps/web/src/components/slides/status-slide-deck.test.tsx`:
      REMOVE/INVERT the assertions for the things this change deletes — the
      readiness strip ("folds readiness into the active slide …" + "shows a
      quiet placeholder when the slide has no readiness items", around the
      `head-readiness-strip` testid) and the slide-header Agent-review slot
      (around the `head-agent-review-slot` testid). Assert the head deck no
      longer renders `head-readiness-strip` or `head-agent-review-slot`, and no
      "Group Status Slides" heading band / in-deck "Open focused report" link.
- [x] 6.2 In `apps/web/src/components/head/head-report-shell.test.tsx`: assert
      that in slides mode the header line carries "Open focused report" (when a
      target resolves) and the toolbar context row carries exactly one
      `AgentReviewComingSoon` placeholder.
- [x] 6.3 Keep the carousel / fullscreen / arrow-key / status-once assertions
      passing (S4 + un-removed `head-slide-density` requirements untouched).

## 7. Verification (required before archive)

- [ ] 7.1 Same-viewport before/after screenshots on `:3000` for user
      acceptance (per `head-slide-density`): many-leads (lead + product scope)
      and a per-active-slide view, showing no deck heading band, "Open focused
      report" on the header line, Agent review in the toolbar context row, and
      no readiness strip. Await user acceptance before archiving.

## 8. Gates

- [x] 8.1 `pnpm typecheck && pnpm lint && pnpm test && openspec validate
  head-slides-lead-parity --strict` — all green before archive.
