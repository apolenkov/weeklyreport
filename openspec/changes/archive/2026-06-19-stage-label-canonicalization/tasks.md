# Tasks — stage label canonicalization

## 1. Canonical stored identifier

- [x] 1.1 Drop the local `"Dev"` `STAGE_NAMES` literal in `lead-form.ts`; import
      the shared canonical `STAGE_NAMES` (`@customreport/shared`) instead — one
      source of truth (also added named `STAGE.*` constants there per review).
- [x] 1.2 Grep confirmed: the only true stage-logic literals left in prod are the
      three `mock-data.ts` files (deferred to the stage-name-constant sweep).
- [x] 1.3 Left `canonicalStageName`, `normalizeStageName`, `stageNamesMatch`,
      `riskCoversStage` unchanged; legacy `Dev` still matches `Development`
      (alias tests green).

## 2. Per-surface display

- [x] 2.1 Canonicalize the record stage label at render in `item-card.tsx` via
      `canonicalStageName`.
- [x] 2.2 Audited siblings: `risks-section.tsx` already canonicalized;
      `decisions-section.tsx` now does too. Pipeline chip exempt.
- [x] 2.3 Added `stageShortLabel` (keyed by `STAGE.DEVELOPMENT`) in `stage-tags.ts`;
      the pipeline chip renders it. Stored/matched value stays canonical. The
      `stage-chip-config.ts` icon map keeps both `Dev` and `Development` keys.

## 3. Tests & gates

- [x] 3.1 Updated tests asserting a stored/card/aria value of `Dev` →
      `Development` (card snapshot, decisions snapshot, lead-form aria queries,
      `ownedStagesForProject` results); kept alias-helper tests on both spellings.
- [x] 3.2 `decisions-section.snapshot` now feeds a legacy `Dev` and asserts the
      row renders `Development` (the render heal).
- [x] 3.3 Mappers + lead component suites green; alias matching intact.
- [~] 3.4 `pnpm typecheck` + lint green; component/mapper tests green. Live-verify
  after reseed still pending (run alongside change 4's reseed). NOTE: 2 stale
  `packages/shared/dist/*.test.js` failures are pre-existing (gitignored build
  artifact, unrelated to stages — never rebuilt this session).
