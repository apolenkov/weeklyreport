# Tasks

## 1. Baseline + tokens

- [ ] 1.1 Capture BEFORE screenshots at 1440×900: lead report Product Status
      pane (chips + at-risk group bg + advisory banner) and a published
      report's preview card (head `/reports` or weekly-report accordion with
      NEEDS ATTENTION / RISKS / PRIORITIES visible).
- [ ] 1.2 Add tokens to `packages/ui/src/styles/globals.css` per memo T5
      Option 3 + memo T6 Option 2 + design decision 1: `--color-chip-*`
      (9 chip tokens), `--color-status-blocked-bg`,
      `--color-status-at-risk-border: #a07c30` (shared stripe token),
      `--color-priority-row-bg`, `--color-highlight-shadow`;
      `--color-success` `#d4e9e2` → `#d8ece4`.

## 2. T5 — stage chips + pipeline (lead)

- [ ] 2.1 `stage-chip.tsx`: switch `STATUS_CONFIG` to the new chip tokens;
      no hardcoded hex remains.
- [ ] 2.2 `sdlc-pipeline.tsx`: replace tinted group fills (`#fffcf5`,
      `#fdf8f8`) with neutral card body + 4px left stripe
      (at-risk = `--color-status-at-risk-border`, blocked = chip blocked
      border token); advisory banner `#fffbeb` → card bg + 3px amber stripe;
      compensate padding so content x-position is unchanged.
- [ ] 2.3 Per-stage lucide icons: `STAGE_ICONS` map keyed by stage name
      (ClipboardList / Search / PenTool / Hammer / FlaskConical / Server /
      Headset), rendered on the chip alongside the existing status logic.

## 3. T6 — preview card (weekly-report)

- [ ] 3.1 `product-accordion.tsx`: tokenize blocked literals
      (`#fee2e2` ×6 → `--color-status-blocked-bg`), `#faf6ee` →
      `--color-priority-row-bg`, `#fff` badge text →
      `--color-primary-foreground`, `rgba(0,117,74,0.16)` →
      `--color-highlight-shadow`.
- [ ] 3.2 Neutral section labels with weight hierarchy: NEEDS ATTENTION +
      RISKS & BLOCKERS (drop red), DECISIONS (drop green), TOP PRIORITIES
      (drop gold).
- [ ] 3.3 At-risk surfaces: header pill → `--color-muted` bg + foreground
      text; non-blocked needsAttention box and risks rows →
      `--color-surface-muted` body + 3px amber left stripe; non-blocked
      risks badge → neutral; drop `#fef3c7` / `#fffcf5` / `#8a6d1b` /
      `rgba(212,160,23,0.15)` / `rgba(212,160,23,0.18)` literals.

## 4. Verify + accept

- [ ] 4.1 Gates green: `pnpm typecheck && pnpm lint && pnpm test`
      (+ `pnpm build`); refresh only pure class/color snapshots, behavioral
      assertions untouched; grep confirms no leftover hardcoded status hex in
      the three components.
- [ ] 4.2 AFTER screenshots of the same surfaces at the same viewport;
      side-by-side check against `status-color-semantics` (red only blocked,
      labels neutral, stripes mark at-risk).
- [ ] 4.3 USER GATE: present before/after to the user; on «да» — archive the
      change; on rejection — revert the landing commit and record the
      objection.
