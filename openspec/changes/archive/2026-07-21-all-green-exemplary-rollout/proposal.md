## Why

Campaign order (2026-07-18): bring the WHOLE repo to the Exemplary Code
Standard (`docs/exemplary-code-standard.md`) — not merely "no blockers".
The 2026-07-17 mass review left 973 files below "exemplary" on the current
tree (860 good, 111 needs-attention, 2 defect) and 597 live non-rejected
minor findings. Phase-0 inventory (2026-07-18, main @ 261a255d) measured the
mechanical debt: 86 files >= 240 lines, 102 functions > 50 lines,
32 mutation hotspots, 38 slice-covering eslint exemptions (part PERM).

Campaign artifacts: `~/work/customreport-archive/2026-07-18-all-green-campaign/`
(PLAN.md, SCOREBOARD.md, phase0-inventory.json, inventory-seed.json).

## What Changes

Behavior-preserving quality rollout, wave by wave (one wave = one slice
group, one commit), per the ratified manual-per-folder pattern:

- Split oversize files (< 250 lines) and long functions (<= 50 lines) into
  single-purpose units; complexity < 10 via pure derive\* helpers.
- Remove `let`/reassign/in-place mutation from product code.
- Fix live minor findings from the mass-review seed (test-coverage gaps,
  small correctness nits) — excluding VERDICT.md rejected classes.
- Fix the 2 defect-grade tests: bullmq pdf-export.processor terminal-attempt
  contract; role-coverage gate's reference-identity enforcement.
- Tear down eslint.config.ts exemptions that the rollout makes obsolete.
  JUSTIFIED PERMANENT blocks stay.

## Non-Goals / Guard-rails

- No behavior changes; no schema/API changes; no new features.
- VERDICT.md reject-list stands: no `&&`->ternary churn, no TODO purge, no
  `.js` import "consistency", no empty-catch logging, no mass magic-string
  extraction, no blanket explicit-return-types.
- Lint complexity budget stays 15 repo-wide; < 10 is achieved per-file by
  refactoring, never by config tightening mid-campaign.
- Load-bearing invariants (period dual-state, role-coverage middleware
  builders) must keep their exact semantics; their specs are the reference.

## Impact

- Affected: all product source slices per SCOREBOARD wave grid; tests
  refactored only where their source moves or seed minors demand pins.
- Verification per wave: full `pnpm typecheck && pnpm lint && pnpm test`
  re-run by the orchestrator (exit codes, not agent reports); live-verify
  for runtime-visible surfaces; adversarial review of each wave's diff.
