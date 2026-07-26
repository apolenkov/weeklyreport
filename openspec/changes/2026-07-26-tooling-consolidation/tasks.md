# Tasks

## 1. Root module type and typed scripts

- [ ] Add `"type": "module"` to the root `package.json`
- [ ] Confirm the blast radius is still one archive `.js` file:
      `git ls-files '*.js' | grep -v node_modules`
- [ ] Add `tsconfig.scripts.json` extending `tsconfig.base.json`, covering
      `scripts/**/*.ts` and `e2e/sweep/**/*.ts`, with `erasableSyntaxOnly: true`
      and `noEmit: true`
- [ ] Wire it into `pnpm lint` next to `lint:prisma:typecheck`
- [ ] Rename `scripts/check-runtime-node-sync.mjs` and `e2e/sweep/*.mjs` to `.ts`,
      annotate the previously implicit types, update every call site in
      `package.json` and `.husky/**`
- [ ] Add `mts`/`ts` coverage for these paths in `eslint.config.ts` `files` globs
      and in `knip.json` `project`/`entry`
- [ ] `pnpm lint && pnpm catalog:check` green

## 2. Two scripts become ESLint rules

- [ ] Rewrite the gate as `scripts/status-ssot-gate.ts` driving ESLint's `Linter`
      API with `linterOptions: { noInlineConfig: true }` and four selectors, over
      a tree walk it owns — NOT as entries in `eslint.config.ts`. The config
      placement fails four ways: it would freeze the eight live `let`-hatch
      suppressions of `no-restricted-syntax`; `no-restricted-disable` is escapable
      by disabling the guard itself; `noInlineConfig` is per-file and the tree has
      591 inline disables; and `eslint.config.ts` globally ignores `e2e/**` plus
      three Prisma seed entrypoints, which a `files` override cannot re-include
- [ ] Each selector must cover BOTH `TSUnionType` and
      `CallExpression[callee.object.name="z"][callee.property.name=/^(enum|union)$/]`
      — the real declarations are mostly `z.enum`, not TS unions
- [ ] Report status needs exact set equality, not containment: add
      `:not(:has(Literal:not([value="draft"]):not([value="published"])))`. Fixture
      must prove the legal superset `"draft" | "published" | "archived"` does NOT
      fire — the spec makes supersets a review judgment
- [ ] Cover backtick literal unions (`` `green` | `yellow` | `red` ``), which the
      current test suite asserts and `Literal[value=…]` does not match
- [ ] Carry the seven `ALLOWLIST` paths over unchanged — three SSOT declarations
      plus four mirrors that `status-type-ssot-gate` and `role-type` document as
      deliberate (isolated tsconfigs in `prisma/` and `e2e/`)
- [ ] Prove the no-escape property survives: plant `eslint-disable-next-line`, a
      bare `/* eslint-disable */`, and a rule-specific disable over a violation;
      all three must stay red
- [ ] Amend `openspec/specs/status-type-ssot-gate/spec.md`: it names
      `scripts/find-status-literal-unions.mjs` explicitly. Also fix the drift Codex
      found — the spec calls `apps/web/src/lib/status-presentation.ts` the
      canonical SSOT, but that file only imports the type; the declaration lives in
      `packages/shared`, which is what the scanner actually allowlists
- [ ] Add the local archaeology rule over `sourceCode.getAllComments()`; cover it
      with `RuleTester` under vitest, including the `RFC-5322`-in-a-URL case that
      motivated the 27-entry standards list
- [ ] Delete `scripts/find-status-literal-unions.mjs`, `scripts/find-archaeology.mjs`
      and both `.test.mjs` files; remove `lint:status-literal-unions` from
      `pnpm lint` and both entries from `lint-staged`
- [ ] Prove no coverage was lost: run the old scripts and the new rules over the
      same tree and diff the hit sets before deleting

## 3. One declaration per dependency

- [ ] Add `catalog:` to `pnpm-workspace.yaml` for the thirteen dependencies
      declared in more than one manifest
- [ ] Resolve `recharts`: `apps/web` pins `3.8.1`, `packages/ui` allows `^3.10.0`
      — pick one range, verify the chart primitive renders against it
- [ ] Replace the literal ranges with `catalog:` in every workspace manifest
- [ ] Drop the `@types/node` cross-manifest check from
      `check-runtime-node-sync.ts` — pnpm now guarantees it at install
- [ ] `pnpm install --frozen-lockfile` clean, `pnpm build` green

## 4. Close the image-rot cause

- [ ] Add the `docker` ecosystem to `.github/dependabot.yml` for `Dockerfile.api`
      and `Dockerfile.web`, grouped so both move together
- [ ] Confirm the runtime-sync gate fails when only one image is bumped — plant a
      mismatch, expect exit 1, revert

## 5. Verification

- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm knip`, `pnpm depcruise`
- [ ] Docker build of both images from a clean cache
- [ ] CI green on all jobs after push
