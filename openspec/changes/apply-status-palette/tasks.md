# Tasks

## 1. Baseline + tokens

- [x] 1.1 Capture BEFORE screenshots at 1440×900: lead report Product Status
      pane (chips + at-risk group bg + advisory banner) and a published
      report's preview card (head `/reports` or weekly-report accordion with
      NEEDS ATTENTION / RISKS / PRIORITIES visible).
  - Evidence (2026-06-10): `/tmp/apply-status-palette-evidence/`
    `palette-before-stage-pipeline.png` (boris lead report, beige at-risk
    group visible) and `palette-before-preview-card{,-risks}.png` (head
    week-23 report `…0001`, «Маркетинговый портал» expanded — red labels,
    amber rows, 7 competing hues).
- [x] 1.2 Add tokens to `packages/ui/src/styles/globals.css` per memo T5
      Option 3 + memo T6 Option 2 + design decision 1: `--color-chip-*`
      (9 chip tokens), `--color-status-blocked-bg`,
      `--color-status-at-risk-border: #a07c30` (shared stripe token),
      `--color-priority-row-bg`, `--color-highlight-shadow`;
      `--color-success` `#d4e9e2` → `#d8ece4`.
  - Evidence: 13 tokens added in the `@theme` block with a sign-off
    comment; `--color-success` value updated.

## 2. T5 — stage chips + pipeline (lead)

- [x] 2.1 `stage-chip.tsx`: switch `STATUS_CONFIG` to the new chip tokens;
      no hardcoded hex remains.
  - Evidence: config extracted to `stage-chip-config.ts` (kept
    `stage-chip.tsx` under the 300-line budget); all four statuses on
    `--color-chip-*` / `--color-surface-empty` tokens.
- [x] 2.2 `sdlc-pipeline.tsx`: replace tinted group fills (`#fffcf5`,
      `#fdf8f8`) with neutral card body + 4px left stripe
      (at-risk = `--color-status-at-risk-border`, blocked = chip blocked
      border token); advisory banner `#fffbeb` → card bg + 3px amber stripe;
      compensate padding so content x-position is unchanged.
  - Evidence: `getProductCardStyle()` + `STRIPE_BY_STATUS`. Live user
    feedback (2026-06-10, mid-implementation) extended this: ALL product
    cards share ONE body (card surface + neutral ring) and only the stripe
    color changes (blocked red / at-risk amber / on-track green / empty
    neutral) — matching the advisory-banner idiom. Banner text went
    neutral (foreground/muted); its amber literals (`#8a6d1b`, `#d4a017`)
    were removed; unbacked-stage pills use chip tokens.
- [x] 2.3 Per-stage lucide icons: `STAGE_ICONS` map keyed by stage name
      (ClipboardList / Search / PenTool / Hammer / FlaskConical / Server /
      Headset), rendered on the chip alongside the existing status logic.
  - Evidence: map in `stage-chip-config.ts` (incl. "Dev" ↔ "Development"
    alias). Live user feedback: the status glyph (✓/!/✕/○) is REMOVED from
    the chip face — the colored stage icon + chip fill/border carry status;
    the popover menu, tooltip, and aria-label keep the textual status. The
    lock moved off the label into a small white corner badge. WCAG 1.4.1
    note: on the chip face status is now color-borne; textual carriers
    remain (aria-label `${stage}: ${status}`, tooltip, popover) — flagged
    for awareness, accepted by the user's direction.

## 3. T6 — preview card (weekly-report)

- [x] 3.1 `product-accordion.tsx`: tokenize blocked literals
      (`#fee2e2` ×6 → `--color-status-blocked-bg`), `#faf6ee` →
      `--color-priority-row-bg`, `#fff` badge text →
      `--color-primary-foreground`, `rgba(0,117,74,0.16)` →
      `--color-highlight-shadow`.
  - Evidence: done; grep over the component finds no status hex literals.
- [x] 3.2 Neutral section labels with weight hierarchy: NEEDS ATTENTION +
      RISKS & BLOCKERS (drop red), DECISIONS (drop green), TOP PRIORITIES
      (drop gold).
  - Evidence: all four labels → `--color-muted-foreground`, weight
    unchanged (font-bold).
- [x] 3.3 At-risk surfaces: header pill → `--color-muted` bg + foreground
      text; non-blocked needsAttention box and risks rows →
      `--color-surface-muted` body + 3px amber left stripe; non-blocked
      risks badge → neutral; drop `#fef3c7` / `#fffcf5` / `#8a6d1b` /
      `rgba(212,160,23,0.15)` / `rgba(212,160,23,0.18)` literals.
  - Evidence: done, including the avatar circle (same neutral treatment as
    the pill).

## 4. Verify + accept

- [x] 4.1 Gates green: `pnpm typecheck && pnpm lint && pnpm test`
      (+ `pnpm build`); refresh only pure class/color snapshots, behavioral
      assertions untouched; grep confirms no leftover hardcoded status hex in
      the three components.
  - Evidence (2026-06-10): typecheck ✓, lint ✓, test ✓ 898/898, build ✓.
    1 snapshot refreshed (`product-accordion` priorities ol — color strings
    only). 4 assertions in `stage-chip.test.tsx` updated to the new
    contract: status exposure checked via aria-label + per-status
    background token instead of the removed face glyph (F2 intent — locked
    chips show real status — preserved). Literal grep: no status fill/text
    hex left; the three subtle ring alphas the memo explicitly retained
    (`rgba(200,32,20,0.15)`, `rgba(212,160,23,0.15/0.35)`) remain, plus the
    pre-existing risk-pulse pill tint (`rgba(200,32,20,0.08)`) outside memo
    scope.
- [x] 4.2 AFTER screenshots of the same surfaces at the same viewport;
      side-by-side check against `status-color-semantics` (red only blocked,
      labels neutral, stripes mark at-risk).
  - Evidence: `palette-after-stage-pipeline.png`,
    `palette-after-preview-card{,-risks}.png` in
    `/tmp/apply-status-palette-evidence/`. Checked: red appears only on
    blocked rows/chips; section labels neutral; at-risk carried by amber
    stripes; product cards uniform.
- [ ] 4.3 USER GATE: present before/after to the user; on «да» — archive the
      change; on rejection — revert the landing commit and record the
      objection.
  - Status: screenshots delivered 2026-06-10; two rounds of live feedback
    already folded in (no face glyph + corner lock; uniform card bodies).
    Awaiting final «да» on the result as shipped.

## 5. Live feedback round 2 (user, 2026-06-10, during 4.3 review)

- [x] 5.1 Remove the TOP PRIORITIES section from `product-accordion.tsx` —
      it duplicated current-week items 1:1. Prioritized items now sort first
      in Current Week (rank asc, unranked keep order) and carry an inline
      gold `PriorityRankBadge`; rank-1 rows keep the warm
      `--color-priority-row-bg` tint. `priorityRank` plumbed through
      `WeeklyReportItem` / `ReportItem` and the grouper. Print page keeps its
      own priorities list (different surface, untouched).
- [x] 5.2 Fix the "Dev everywhere" bug: `weekly-report-groupers.ts`
      hardcoded `Dev ·` into every item badge and `· Dev` into every risk
      badge. Badges now show the item's/risk's REAL stage tags from
      `stageIds` (joined with `+`), falling back to initials/product-name
      when no stages are set. Mapper test updated to assert real stages
      (`Dev+Testing · Т1`). - Found while verifying: risk/decision badges can resolve the product
      name as "Unknown" (`projectNames.get(...) ?? "Unknown"` misses when
      the risk's projectId is not among the author's section projects).
      PRE-EXISTING (visible in the before-screenshots as "Unknown · Dev");
      out of this change's scope — flagged for a follow-up.
- [x] 5.3 Make the unbacked-risk advisory visually distinct from product
      cards (it had become the same white-card-plus-stripe idiom): muted
      amber band (`--color-chip-at-risk-bg`), text in
      `--color-chip-at-risk-text`, pills on a white body, and — follow-up
      user feedback — NO left stripe (the stripe idiom belongs to the
      product-card status language). Product cards stay white; the warning
      reads as a warning.
- [x] 5.4 Re-verify: gates green (typecheck / lint / test 900 / build);
      accordion priority tests rewritten to the new inline-rank contract
      (duplicate ranks keyed by item.id — no React key warning); AFTER
      screenshots in `/tmp/apply-status-palette-evidence/`
      (`feedback-after-*.png`).
