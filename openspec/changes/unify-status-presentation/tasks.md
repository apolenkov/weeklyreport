# Tasks

> Ordered after `unify-web-status-color-tokens` lands. Web-only; no shared/api
> changes. Each task is one commit-sized step. Scope is the 8 enumerated
> surfaces only.

> DRIFT (implemented 2026-07-05, after slide redesign 083d058a). Two of the 8
> named surfaces were DELETED by the redesign and their status vocabulary MOVED:
> `lead-slide-hero.tsx` (`toneConfig`) → `slide-article-header.tsx` `WORST_PILL`;
> `lead-product-grid.tsx` (inline badge) → the same header pill + the product
> card in `slide-article-grid.tsx`. `status-slide-deck.tsx` was rewritten and
> already dropped its `toneClass`/`toneLabel` — task 3.1 is moot. The map was
> derived from CURRENT HEAD; the moved homes are folded in place of the deleted
> files. `SlideEmptyState` is moot (see 2.2). Gates green; the raw `#8a6d1b`
> at-risk fg is already consolidated to `--color-status-at-risk-fg` (line 37 of
> the card), so 3.6's gate is satisfied.

## 1. Canonical map + helpers (`apps/web/src/lib`)

- [x] 1.1 Inventory (current HEAD). Variants that survive: screen sentence-case
      (`On track`/`At risk`/`Blocked`/`No status`, pill+chip sr-only, identical);
      print Title-case (`On Track`/`At Risk`/`Blocked`, weekly-report +
      groupers + dashboard badge); worst-pill (`Blockers` for blocked, else
      sentence). The deck section-readiness `Ready`/`Review` vocabulary is GONE
      (deck rewritten) — not carried. DOT is identical across pills, chips, and
      the new `slide-article-grid` `STATUS_DOT_BG`. TONE is single-use per
      surface post-redesign (WORST_PILL chip className; SEVERITY_BADGE bg/fg;
      STATUS_STRIPE border) — NOT collapsed (R1). WORST_PILL quirk preserved:
      blocked pill TEXT is `--color-destructive`, not `--color-chip-blocked-text`.
- [x] 1.2 Added `apps/web/src/lib/status-presentation.ts`: `CanonicalStatus →
{ icon, dotClassName, toneClassName, labels }` keyed blocked/at-risk/
      on-track/empty on the existing tokens (no new token). `labels` carries the
      3 surviving variants.
- [x] 1.3 Helpers `statusLabel(status, variant)` / `statusDotClassName` /
      `statusToneClassName` / `statusIcon`; `status-presentation.test.ts` freezes
      each status+variant to its pre-change value.
- [x] 1.4 Kept every enum→key normalizer (`toPillStatus` + new `pillToStatus`,
      `mapTrafficLightToStatus`, `worstToStatus`, `trafficDotStatus`,
      `groupSeverity`) per-surface (D6).

## 2. Shared components (`apps/web/src/components/slides`)

- [x] 2.1 Added `slide-status-badge.tsx` — canonical status + label variant in,
      label/icon/tone resolved via the map; no pre-formatted prop (D3). Consumed
      by `SlideGridHeader` (the merged descendant of the deleted hero +
      lead-product-grid badges).
- [x] 2.2 `SlideEmptyState` — DONE via dedup (adversarial review round 1
      overturned the initial "moot" call): two byte-identical live components
      existed (`lead-slides-deck-model` exported + `head-slides-client` private
      clone). Extracted the one shared `slides/slide-empty-state.tsx`; both deck
      surfaces import it. Spec Req3's empty-state clause is SATISFIED, not
      unsatisfiable — the old tone-variant sub-clause alone is moot (deck was
      de-toned by the redesign).
- [x] 2.3 `slide-status-badge.test.tsx` asserts the badge renders label + alert
      glyph + tone chip from the map per status/variant.

## 3. Re-point the surfaces (`apps/web/src/components/{slides,dashboard}`, `apps/web/src/lib/mappers`)

- [~] 3.1 `status-slide-deck.tsx` — MOOT. The redesign already removed
  `toneClass`/`toneLabel`; the deck now delegates to `SlideArticle`. No
  section-readiness `Ready`/`Review` vocabulary survives to fold.
- [x] 3.2 `slide-activity-pills.tsx` — dropped `PILL_DOT_CLASS` /
      `PILL_STATUS_LABEL`; reads `statusDotClassName` + `statusLabel(…,"screen")`
      via the new `pillToStatus` normalizer; `toPillStatus` + `GROUP_ORDER` kept.
- [x] 3.3 `slide-product-chips.tsx` — dropped `STATUS_DOT_CLASS` /
      `STATUS_LABEL`; `ProductStatus` IS the canonical key set so it reads the
      map directly; `mapTrafficLightToStatus` normalizer kept.
- [~] 3.4 `lead-slide-hero.tsx` — MOVED. File deleted by the redesign; its
  `toneConfig` role is now `WORST_PILL` in `slide-article-header.tsx`, which
  is replaced by `<SlideStatusBadge variant="worstPill">` (keeps `Blockers`).
- [~] 3.5 `lead-product-grid.tsx` — MOVED. File deleted; the header worst-pill
  (3.4) now carries the badge. Additionally folded the new
  `slide-article-grid.tsx` `STATUS_DOT_BG` (the moved product-card dot) into
  `statusDotClassName`, preserving its `status == null → renders nothing`
  branch. `STATUS_STRIPE` (border-l) left as-is — a stripe, not the dot.
- [x] 3.6 `blocked-at-risk-product-card.tsx` — folded `SEVERITY_BADGE`'s LABEL
      only into `statusLabel(…,"print")`. Its bg/fg pair does NOT fit the map's
      single-token tone shape, so it stays inline exactly as `SEVERITY_TONE` /
      `AVATAR_CONFIG` do (D8 shape rule) — deviates from 3.6's "+ tone" wording
      per that same rationale. Gate satisfied: `#8a6d1b` already on
      `--color-status-at-risk-fg`.
- [x] 3.7 `weekly-report.ts` (`productStatusLabel` + inline lead-group label) /
      `weekly-report-groupers.ts` (`statusLabelFor`) now read
      `statusLabel(status,"print")`.
- [x] 3.8 Grep of the changed surfaces: no private tone/icon/dot or label
      `Record<status, …>` remains for the canonical set. Retained (non-fitting,
      documented): `STATUS_STRIPE` (border), `SEVERITY_TONE` (rail),
      `AVATAR_CONFIG` + `SEVERITY_BADGE` bg/fg (pairs). Normalizers exempt.

## 4. Planning + docs

- [ ] 4.1 Update `openspec/specs` on archive so `status-presentation-model`
      becomes a durable spec. (Deferred to archive step — not run here.)
- [x] 4.2 No `eslint.config.ts` exempt entry needed: the new module and every
      re-pointed file are eslint-clean at `--max-warnings 0` with no exemption.

## 5. Verification

- [x] 5.1 Parity verified NON-circularly against pre-change SOURCE (not the new
      test): `git diff` of every re-pointed file, each removed literal
      (`PILL_STATUS_LABEL` / `PILL_DOT_CLASS` / `STATUS_DOT_CLASS` /
      `STATUS_LABEL` / `WORST_PILL` labels+tone / `SEVERITY_BADGE` labels /
      deleted print strings) confirmed byte-identical in `status-presentation.ts`
      — all 7 labels + 4 dot classes + 4 tone bundles (incl. the blocked-text
      `--color-destructive` quirk) match. Coverage caveat: the three re-pointed
      slide surfaces (pills / chips / article-header worst-pill) have NO render
      test, so the green 1477-suite does not exercise their output — the source
      diff is the parity guard for them. `statusLabelFor` IS covered
      (`weekly-report.test.ts` `·` assertion, passing).
- [~] 5.2 Gate: db:generate ✓, typecheck ✓ (5/5), full web vitest ✓ (1477/0),
  build ✓ (5/5). `pnpm lint` (eslint .) EXITS 1 (RED) — but every one of its
  2330 errors is inside `apps/web/.next-src/`, a live dev-build dir written
  by ANOTHER session's running dev server (hot-update files timestamped
  mid-session, after this session's clean start; `.next-src` is absent from
  the ignore list that already covers `.next`/`.next-e2e`/`.next-sweep`).
  Greening the full gate needs either an out-of-scope `eslint.config.ts`
  ignore-list edit or that session to stop — owner call, NOT done here.
  Scoped eslint over every changed/new file: 0 errors, 0 warnings.
- [x] 5.3 `openspec validate "unify-status-presentation" --strict` → "is valid".
