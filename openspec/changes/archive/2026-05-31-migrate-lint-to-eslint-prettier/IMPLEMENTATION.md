# Phase 1 Implementation Spec (validated) — execute on `feat/lint-swap-eslint-prettier`

Behavior-preserving 1:1 swap Biome → ESLint + Prettier + stylelint.
**NO new lint rules.** Validated by an Opus critique pass; configs corrected.

## Source-of-truth artifacts (in this dir)

- `artifacts-eslint.config.ts` → copy to repo root `eslint.config.ts`
  (REPLACES the residual one). import-sort and the no-op `recommended[0]`
  spread already removed per critique.
- `suppression-map.json` → 73 sites, each with `file`, `line`, `biomeRule`,
  `reason`, `eslintReplacement` (full `// eslint-disable-next-line …` line or
  `DROP`), `hasEquivalent`, `isA11yCatalog`.
- `rule-map.json` → the 1:1 Biome→ESLint rule map + `noEquivalent` list.

## Config files to write

**`.prettierrc.json`**

```json
{
  "printWidth": 80,
  "tabWidth": 2,
  "useTabs": false,
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all"
}
```

**`.prettierignore`**

```
node_modules
dist
.next
.next-e2e
coverage
.turbo
prisma/generated
prisma/seed.ts
prisma/seed-simple.ts
prisma/seed-constants.ts
e2e
pnpm-lock.yaml
```

**`.stylelintrc.json`** (critique fixes applied: keep the two Biome-enforced
CSS rules at warning instead of dropping them)

```json
{
  "extends": "stylelint-config-standard",
  "rules": {
    "at-rule-no-unknown": [
      true,
      {
        "ignoreAtRules": [
          "import",
          "apply",
          "layer",
          "config",
          "keyframes",
          "source",
          "tailwind",
          "theme",
          "variants",
          "utility",
          "custom-variant"
        ]
      }
    ],
    "no-descending-specificity": [true, { "severity": "warning" }],
    "declaration-no-important": [true, { "severity": "warning" }]
  }
}
```

**Delete** `biome.json`.

## Deps

```bash
pnpm rm @biomejs/biome
pnpm add -D eslint-plugin-jsx-a11y eslint-plugin-react eslint-plugin-unused-imports stylelint stylelint-config-standard
# NOT eslint-plugin-simple-import-sort (Phase 3). Prettier/ESLint/tseslint already present.
```

## package.json scripts

- `"lint"`: `eslint . && stylelint "**/*.css" --allow-empty-input && pnpm lint:prisma:typecheck`
- `"format"`: `prettier --write .`
- add `"format:check"`: `prettier --check .`
- remove the old `biome format` usage.

## lint-staged (package.json)

```json
"lint-staged": {
  "*.{ts,tsx,js,jsx,mjs}": ["eslint --fix --max-warnings=0 --no-warn-ignored", "prettier --write"],
  "*.css": ["stylelint --fix", "prettier --write"],
  "*.{json,jsonc}": "prettier --write",
  "*.{yml,yaml,md}": "prettier --write"
}
```

## CI `.github/workflows/ci.yml`

Replace any `biome` invocation with `pnpm lint` + `pnpm format:check`.
(Use `rule-map.json`/`inv` for the exact current lines.)

## Suppression conversion (73 sites)

For each site in `suppression-map.json`: replace the `biome-ignore` comment
line with `eslintReplacement`. If `eslintReplacement === "DROP"` (the 6
`useSemanticElements` sites — no jsx-a11y equivalent), delete the suppression
line entirely (the rule no longer exists, nothing to suppress).

The 21 `isA11yCatalog: true` sites are referenced by
`verify-a11y-recommended-flip` — after converting, leave a note so that
change's catalog can be re-pointed from `biome-ignore` to `eslint-disable`.

## Gate-green protocol (the careful part)

1. After writing configs + converting suppressions, run `eslint .`.
2. The jsx-a11y preset is NOT an exact Biome match. For ANY rule that now
   reports a violation that Biome did **not** enforce (i.e. no row in
   `rule-map.json`, e.g. `jsx-a11y/anchor-is-valid`), set that specific rule to
   `"off"` in `eslint.config.ts` — it is a net-new rule, out of 1:1 scope.
   This is targeted parity restoration, **NOT** mass-disabling. Document each.
3. NEVER blanket-disable a rule that Biome DID enforce to force green — those
   must stay and any real violation gets a per-site `eslint-disable` only if it
   already had a `biome-ignore`.
4. `pnpm format` once (whole tree) — commit ALONE.

## Acceptance

`eslint .` → 0 errors (warnings ok), `prettier --check .` → clean,
`pnpm typecheck && pnpm test && pnpm build` → green.

## Commit clusters (no push)

1. `build(tooling): swap Biome → ESLint+Prettier+stylelint (configs, deps, scripts, CI)`
2. `refactor: convert 73 biome-ignore → eslint-disable suppressions`
3. `chore: reformat with prettier` (mechanical, isolated)
4. `fix: resolve residual eslint violations to green` (only if needed; no mass-disable)
