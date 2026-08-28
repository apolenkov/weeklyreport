## 1. Stage-row implementation

- [x] 1.1 Reflow `SdlcProductCard` stage composition into a full-width vertical stack, remove the horizontal-only arrow cells, and preserve visible-stage order, Mine/Everyone filtering, the collapsed indicator, and status-change callbacks; verify with the focused pipeline tests.
- [x] 1.2 Update `StageChip` geometry and content for a stretched row: preserve its semantic button, tooltip, lock badge, coverage distinction, fixed minimum height, and assignee label; add the derived status glyph, `min-w-0`, safe label truncation, and visible focus treatment; verify with the focused StageChip tests and the Web Interface Guidelines checklist.

## 2. Contract tests

- [x] 2.1 Replace horizontal-arrow structural assertions with tests that assert one `data-testid="sdlc-stage-row"` per visible stage, full-width row/chip classes, canonical order, status glyph presence, and no horizontal overflow classes; verify with `pnpm --filter @customreport/web exec vitest run src/features/period/ui/sdlc-pipeline.test.tsx src/features/period/ui/sdlc-pipeline.mine-chip.test.tsx src/features/report-sections/ui/stage-chip.test.tsx`.
- [x] 2.2 Add or update long-label, locked-stage, and keyboard-focus cases to prove truncation, visible focus treatment, tooltip/aria preservation, and unchanged Mine/Everyone, hidden-risk, and completeness behavior; verify in the same focused Vitest command.

## 3. Quality and visual acceptance

- [x] 3.1 Run `pnpm --filter @customreport/web typecheck` and `pnpm --filter @customreport/web lint` (or the repository-equivalent targeted gates) and verify no changed-file diagnostics remain.
- [x] 3.2 Review the exact diff against `lead-pipeline-card` and the change artifacts, run `openspec validate reflow-sdlc-pipeline-stage-rows --strict`, and verify no API, database, permission, or data-model files changed.
- [x] 3.3 On the final exact source SHA, use real Chrome to measure the stage-row, product-header, and card bounds before/after a status toggle and tooltip focus/open, and verify scrollY and top-menu visibility remain unchanged; capture fresh desktop before/after screenshots for the seeded Lead surface, record whole-frame review against Web Interface Guidelines plus independent visual review, then obtain Sol's decision-critical review. Do not treat screenshots alone as acceptance or claim CR-001 runtime closure.
