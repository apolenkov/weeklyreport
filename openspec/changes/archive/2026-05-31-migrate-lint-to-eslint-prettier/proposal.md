# Migrate the Lint Toolchain off Biome to ESLint + Prettier (+ stylelint)

## Why

The repo currently runs a three-tool Biome trio (Biome owns format +
`recommended` lint for the code surface; residual ESLint owns the type-aware
`no-floating-promises` + react-compiler + react-hooks; Prettier owns YAML/MD).
See the `lint-toolchain-ownership` spec.

The decision is to move **off Biome** back onto the standard JS-ecosystem stack
(ESLint for logic, Prettier for format, stylelint for CSS). The governing
reason is **not** "regain type-aware rules" — that is already solved by the
residual ESLint. The reason is twofold:

1. **Consolidate onto one mainstream ecosystem** so every needed plugin
   (a11y, react, import-sort, jsdoc, sonarjs, unicorn, import-boundaries) is
   available in one place, instead of the split Biome/ESLint ownership the
   `lint-toolchain-ownership` spec has to police.
2. **Enable a durable maximum-strictness regime** (declared in Phase 2,
   achieved by ratchet in Phase 3) that Biome cannot express — full
   `strictTypeChecked`, `max-lines`, JSDoc on public API, sonarjs/unicorn,
   import boundaries.

This change is **Phase 1 only**: a behavior-preserving 1:1 port. It supersedes
the `lint-toolchain-ownership` spec's "Biome owns…" requirements with
equivalent ESLint/Prettier/stylelint ownership. It deliberately **adds no new
lint rules** beyond what Biome already enforced today — the strictness ramp is
Phases 2–3, sequenced separately so failure is attributable and reviewable.

## Strategy (the whole arc — for context; only Phase 1 is in this change)

| Phase          | What                                                                                                  | Cost                                 | Models                           | OpenSpec            |
| -------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------ | -------------------------------- | ------------------- |
| **1. Swap**    | Biome → ESLint+Prettier+stylelint, port 1:1, behavior-preserving, green gate                          | Cheap, mostly mechanical             | Haiku impl + Opus concept/review | **this change**     |
| **2. Declare** | Pin max-strictness as the durable standard in spec + config (rules present, mostly `warn`/staged-off) | Cheap                                | Opus                             | follow-up change    |
| **3. Ratchet** | Turn each strict rule to `error` one at a time, fixup wave per rule, land green                       | Expensive, judgment-heavy, NOT cheap | Opus/Sonnet                      | follow-up change(s) |

The split exists because **"максимальная экономия" and "максимальная строгость"
are in direct opposition for the fixup work**: enabling rules is cheap, but
fixing `max-lines` (file splitting), JSDoc (authoring docs), and
`strictTypeChecked` is not a Haiku mechanical job. Declaring the standard is
decoupled from achieving compliance.

**MEASURED on this repo (2026-05-31):** `strictTypeChecked + stylisticTypeChecked`
alone = **2211 violations / 361 files (~1010 autofixable, ~1200 manual)** —
before sonarjs/unicorn/max-lines/JSDoc. Top manual: require-await 368,
no-confusing-void-expression 272, no-unnecessary-condition 223,
restrict-template-expressions 177, no-unsafe-\* 209. A one-pass "combine
swap+strict" was considered and **rejected** on this evidence: it is the exact
unreviewable big-bang the phasing exists to avoid. (Note: a foreign
`workstream A`/`A0–A5` task set quoting 17/119/98 violations refers to a
DIFFERENT codebase — no `lint:ts`, no strict rules, no installer/confluence
modules exist here — and must not drive this repo's work.)

## What Changes (Phase 1)

- **Remove Biome**: delete `biome.json`, drop `@biomejs/biome`, remove
  `biome check`/`biome format` from `package.json` scripts and the lint-staged
  `*.{ts,tsx,js,jsx,mjs}` / `*.{json,jsonc,css}` entries.
- **ESLint absorbs Biome's `recommended` surface 1:1** via mainstream plugins,
  NOT `strictTypeChecked` (that is Phase 2/3):
  - keep existing residual rules (no-floating-promises, react-compiler,
    react-hooks) and `projectService` type-aware machinery;
  - add `@typescript-eslint` recommended (non-strict) + the repo overrides that
    Biome carried (`no-explicit-any: error`, `no-non-null-assertion: warn`,
    `no-unused-vars: error` w/ ignoreRestSiblings via
    `unused-imports`/tseslint);
  - add `eslint-plugin-jsx-a11y` to preserve Biome's a11y coverage;
  - add `eslint-plugin-react` for the react rules Biome enforced
    (`no-array-index-key` → `react/no-array-index-key`,
    `noDangerouslySetInnerHtml` → `react/no-danger`, etc.);
  - add `eslint-plugin-simple-import-sort` + `eslint-plugin-unused-imports` to
    replace Biome's default import organization.
- **Prettier becomes the formatter of record for the whole code surface**
  (TS/JS/JSON/CSS in addition to the YAML/MD it already does). `.prettierrc`
  mirrors the Biome formatter block: `printWidth: 80`, `tabWidth: 2`,
  `useTabs: false`, `singleQuote: false` (Biome `quoteStyle: "double"`),
  `semi: true`, `trailingComma: "all"`. `.prettierignore` mirrors
  `biome.json` `files.includes` exclusions (node_modules, dist, .next,
  .next-e2e, coverage, .turbo, prisma/generated, prisma/seed\*.ts, e2e).
- **stylelint** owns the 4 CSS files (explicitly a third tool — accepted
  trade-off; Biome's built-in zero-config CSS lint is replaced rather than
  dropped). `stylelint-config-standard` + Tailwind-directive allowance;
  Prettier stays the CSS formatter.
- **Convert all 106 `biome-ignore` comments** to the equivalent
  `eslint-disable-next-line <rule> -- <reason>` (keep reasons). Suppressions
  with no ESLint equivalent are dropped. Reconcile with the 36 existing
  `eslint-disable`.
- **Scripts**: `lint` = `eslint . && stylelint "**/*.css" && pnpm
lint:prisma:typecheck`; `format` = `prettier --write .`; add
  `format:check` = `prettier --check .`.
- **lint-staged / husky**: `*.{ts,tsx,js,jsx,mjs}` → `eslint --fix` then
  `prettier --write`; `*.css` → `stylelint --fix` then `prettier --write`;
  `*.{json,jsonc}` → `prettier --write`; `*.{yml,yaml,md}` → `prettier --write`
  (unchanged).
- **CI** (`.github/workflows/ci.yml`): replace any `biome` step with
  `pnpm lint` + `pnpm format:check`.
- **The prettier reformat is committed alone** as a mechanical, isolated commit
  (Biome ≠ Prettier output even with matched settings → large diff expected).

## Impact

- Supersedes `lint-toolchain-ownership` (Biome-ownership requirements replaced;
  delta spec in `specs/`).
- **Does NOT moot `verify-a11y-recommended-flip`** — that change verifies
  runtime a11y _behavior_ (Escape handlers, keyboard nav), which is
  tool-independent. BUT this change rewrites the ~13 dialog-backdrop
  suppressions its catalog references by name; the catalog's suppression
  references must be updated from `biome-ignore` to `eslint-disable` form.
  **Sequencing risk**: do not run this swap and verify-a11y's runtime sweep
  interleaved on the same files — land the swap green first, then re-point the
  catalog.
- Updates the acceptance gate `final-gates-resweep` pins (the internals of
  `pnpm lint` change; `lint:md` is already dead — markdownlint removed).
- Risk: medium-mechanical. The behavior-preserving guarantee holds only if no
  new rule is enabled (enforced by "1:1 port, no new rules" above).

## Execution model (economy)

- **Concept + boundaries**: Opus (this plan).
- **Mechanical implementation**: Workflow with Haiku agents — config authoring,
  the 106 suppression conversions (per-file, parallelizable), script/hook/CI
  edits, the prettier reformat run.
- **Quality gate**: Opus reviews the assembled diff before commit (catches
  wrong rule-name mappings, dropped suppressions, behavior drift).
- Hard guard for Haiku: **never** add a rule not present in Biome today;
  **never** mass-disable to force green.
