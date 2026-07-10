# Tasks — unify-web-status-color-tokens

## 1. Token layer (`packages/ui/src/styles/globals.css`)

- [x] 1.1 Add `--color-border-subtle` at `rgba(0,0,0,0.08)` to the token block, with a comment on its role; adopt it ONLY on in-scope surfaces that already draw an exact `rgba(0,0,0,0.08)` hairline (zero-delta swap). Defer the `rgba(0,0,0,0.07)` and `rgba(0,0,0,0.10)` hairline variants — do not fold them onto the token here
  - Adopted on the 3 in-scope surfaces drawing an exact `border-[rgba(0,0,0,0.08)]` hairline: `lead-history-list` (TrafficDot), `lead-history-sidebar` (SidebarCard), `blocked-at-risk-product-card` (card frame). Token defined theme-blind (no dark variant) to keep the swap zero-delta. `shadow-[…0.08…]` occurrences are box-shadows, not borders — left untouched.
- [x] 1.2 Confirm the status token set is complete for the in-scope surfaces (at-risk bg/fg, blocked bg + `--color-destructive`, on-track fill/fg, `--color-status-dot-at-risk`); add a named token only if one is genuinely missing
  - Set complete; no new token added. DRIFT/DECISION: the at-risk severity **border** (`#d4a017`, in `risk-edit-dialog` + the yellow traffic dots) maps to the existing `--color-status-dot-at-risk` (exact `#d4a017`), NOT to `--color-status-at-risk-border` (`#a07c30` — a different shade that would be an UNSIGNED pixel shift). The dot token's stated purpose (globals.css) is to name the `#d4a017` gold accent, so reuse is consistent, not abuse.

## 2. Fallback removal

- [x] 2.1 `report-shell/save-now-button.tsx`: point the checkmark stroke at `--color-success-foreground` (#006241) and drop the `#16a34a` fallback (semantic fix — not a bare strip to `var(--color-success)`; `--color-primary` is the rejected alternative, see design D4)
- [x] 2.2 Grep `apps/web/src` for `var(--color-…, #hex)` on status colors; confirm zero remain — verified zero `var(--color-…, #hex)` fallbacks remain.

## 3. Report-workflow status surfaces → named tokens

- [x] 3.1 `lead/risk-card.tsx`: severity pill bg/fg → at-risk/blocked tokens (also the F4 needsStage `text-[#8a6d1b]` warning → `--color-status-at-risk-fg`). DRIFT: the card FRAME tints (`#fdf8f8`/`#fffcf5`, `rgba(212,160,23,0.15)`, `rgba(200,32,20,0.15)`) are NOT the severity pill's fill/fg — out of the spec scenario's scope, deferred like the 0.07/0.10 hairlines.
- [x] 3.2 `lead/risk-edit-dialog.tsx`: severity option bg/border/text → tokens (at-risk bg→`at-risk-bg`, text→`at-risk-fg`, border→`dot-at-risk` per §1.2 decision)
- [x] 3.3 `weekly-report/portfolio-overview-table.tsx`: at-risk/blocked cell colors → tokens (STATUS_BG, STATUS_TEXT, STATUS_ICON_TEXT; the border derives from STATUS_TEXT so it follows)
- [x] 3.4 `lead/lead-form.tsx`: blocked accent (#fee2e2) → `--color-status-blocked-bg`
- [x] 3.5 `lead/lead-history-list.tsx` + `lead/lead-history-sidebar.tsx`: severity chip + dot → tokens (Draft chip + `warn` stat fg → `at-risk-fg`; yellow traffic dot → `dot-at-risk`; the exact-0.08 borders → `border-subtle` per §1.1)
- [x] 3.6 `report-shell/meta-row.tsx` + `lead/item-card-stage-tags.tsx`: stage-hint amber → at-risk tokens (comments rewritten). RESOLVED by the §4.2 sign-off: the stage-hint stays on the at-risk tokens (no dedicated warning token); current mapping matches pixels.
- [x] 3.7 `weekly-report/product-accordion.tsx`: "At Risk" pill fg (#8a6d1b) → `--color-status-at-risk-fg` (added `statusAtRiskFg` to the file's CSS const)
- [x] 3.8 `dashboard/blocked-at-risk-product-card.tsx`: SEVERITY_BADGE at-risk fg (#8a6d1b) → `--color-status-at-risk-fg` (consumer of #3 — must be consolidated before #3 lands, per design D1)

## 4. Foreground consolidation (palette gate)

- [x] 4.1 Consolidate the near-duplicate at-risk foreground `#8a6d1b` on the in-scope report-workflow surfaces (incl. `product-accordion`, `blocked-at-risk-product-card`) onto `--color-status-at-risk-fg`. No blocked-foreground consolidation: the report surfaces already resolve `--color-destructive`; the `#92400e` / `#991b1b` literals are admin-domain (out of scope, guarded by §5). Final grep: the ONLY remaining `#8a6d1b` in web src are the two OUT-domain callsites (`publish-lock-button:137`, `decision-card:97`).
- [x] 4.2 Cite the recorded user sign-off authorizing the palette direction (per `status-color-semantics`) — RECORDED 2026-07-10: Александр Платанов approved in-session ("Подтверждаю") the `#8a6d1b` → `--color-status-at-risk-fg` consolidation against the §4.3 before/after screenshot evidence, and resolved the §3.6 open question as "keep the stage-hint on at-risk tokens" (no dedicated warning token).
- [x] 4.3 Capture same-viewport before/after screenshots of every consolidated surface for user acceptance before archive
  - Captured from source builds (not Docker): before = baseline source checkout at `70c8cccc` on `localhost:3200`, after = current source checkout on `localhost:3100`, both against the source API on `localhost:3102`.
  - Durable evidence lives under `openspec/changes/unify-web-status-color-tokens/screenshots/`: lead report form, risk edit dialog, lead history, head report, and head dashboard each have matching `before-*` / `after-*` PNGs plus `manifest.json`.
  - Viewports match per pair: page screenshots are 1440×1100; the risk edit dialog crops are 768×554. Lead history rendered no visible at-risk/blocked chips in the current seed, but the route and its border-subtle history surfaces were captured; sign-off remains tracked by 4.2.

## 5. Out-of-scope guard

- [x] 5.1 Verify no edit touched the OUT domains: `users-tab` role badge, `periods-tab-*` / `periods-delete-confirm-dialog` reds, `publish-lock-button` pending-leads warning (#8a6d1b), `decision-card` "Due" deadline chip (#8a6d1b), `print-report-template` inline hex — confirmed untouched (git diff scoped to the 11 status files + globals.css + 2 snapshots).

## 6. Verify

- [x] 6.1 `pnpm --filter @customreport/web typecheck` green
- [x] 6.2 `pnpm lint` green (no new eslint exemption for any touched file) — FOCUSED: `eslint --max-warnings 0` clean on all 11 changed web files + `stylelint` clean on `globals.css`; no new exempt entry added. Full repo-wide `pnpm lint` deferred to the combined post-batch gate (parallel ComingSoon agent shares the tree).
- [x] 6.3 Live-verify the status surfaces from source (docker image is stale); confirm no hue regression
  - Source live-verify evidence recorded in `screenshots/manifest.json`: current source exposes `--color-border-subtle` as `rgba(0, 0, 0, 0.08)` on every captured target; the baseline source had no `--color-border-subtle` value. Current source grep confirms the in-scope status surfaces resolve through `--color-status-at-risk-fg` / `--color-border-subtle`; the only remaining web `#8a6d1b` callsites are the out-of-scope period warning surfaces (`publish-lock-button`, `decision-card`).
  - No extra hue drift was observed beyond the intentional/sign-off-gated `#8a6d1b` → `--color-status-at-risk-fg` consolidation already isolated in 4.1/4.2.
- [x] 6.4 `openspec validate "unify-web-status-color-tokens" --strict` still valid
