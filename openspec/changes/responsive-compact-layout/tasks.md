## 1. Contract

- [ ] 1.1 Establish the breakpoint contract (Tailwind `sm/md/lg`, `md` = compact↔full); document the mixed viewport floor (slides/dashboard ≥768; lead form + review ≥360).
- [ ] 1.2 Compact-tier touch floor: every interactive control ≥ `--touch-target-min` (44px); desktop density unchanged.
- [ ] 1.3 No-horizontal-overflow below `md` except the report toolbar's scrollable strip.

## 2. C1 review surface (R6)

- [ ] 2.1 Per-record comments stack beneath their anchor record at every width; no side rail, no duplicated record content.

## 3. Codify shipped collapses + dense fixes

- [ ] 3.1 Dashboard count rails reflow to a wrapped labeled-value below `md` (preserve no-scroll).
- [ ] 3.2 Record dialogs `md:grid-cols-2` → single column below `md`, classification stacked beneath primary fields.
- [ ] 3.3 Report toolbar keeps `overflow-x-auto`; icon buttons floor at the touch target.
- [ ] 3.4 Compact density baseline: trim non-signal chrome/padding at all tiers, drop no status signal.

## 4. Spec follow-ups (MODIFIED — exact headers)

- [ ] 4.1 Author MODIFIED deltas to `ui-control-density`, `head-slide-density` (keep the fixed-slide-frame header), `lead-slide-quadrants`, `head-dashboard-clarity`, `record-dialog-layout`, `toolbar-polish`.

## 5. Verification

- [ ] 5.1 `pnpm typecheck` + `pnpm lint` until green.
- [ ] 5.2 Manual/responsive check at phone (≥360) and tablet (≥768) for the in-scope surfaces; honor the `head-slide-density` screenshot-sign-off gate for any slide change.
- [ ] 5.3 `openspec validate "responsive-compact-layout" --strict` until it exits 0.
