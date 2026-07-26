# Tasks

## 1. Root module type and typed scripts

- [x] Add `"type": "module"` to the root `package.json`
- [x] Confirm the blast radius is still one archive `.js` file:
      `git ls-files '*.js' | grep -v node_modules`
      (verified: only `openspec/changes/archive/2026-07-21-all-green-exemplary-rollout/harness-template.js`)
- [x] Add `tsconfig.scripts.json` extending `tsconfig.base.json`, covering
      `scripts/**/*.ts` and `e2e/sweep/**/*.ts`, with `erasableSyntaxOnly: true`
      and `noEmit: true`
- [x] Wire it into `pnpm lint` next to `lint:prisma:typecheck`
      (`lint:scripts:typecheck` runs `tsc --project tsconfig.scripts.json`)
- [x] Rename `scripts/check-runtime-node-sync.mjs` and `e2e/sweep/*.mjs` to `.ts`,
      annotate the previously implicit types, update every call site in
      `package.json` and `.husky/**` (verified: zero `.mjs` files remain under
      `scripts/` or `e2e/sweep/`, and `package.json`'s `catalog:check` /
      `lint:runtime-node` scripts point at the renamed `.ts` files)
- [ ] Add `mts`/`ts` coverage for these paths in `eslint.config.ts` `files` globs
      and in `knip.json` `project`/`entry` — **only half done**. `knip.json`
      correctly covers both (`"e2e/**/*.{ts,mjs}"`, `"scripts/**/*.{ts,mjs}"`).
      `eslint.config.ts` adds a `scripts/**/*.ts` override (lines 611-615) but
      `e2e/sweep/*.ts` gets **zero** ESLint coverage: `globalIgnores` still
      carries a blanket `"**/e2e/**"` (line 196, predates this change by ~2
      months, untouched by it). Verified live: `eslint e2e` exits 2 with "all
      files matching the glob pattern are ignored." Not a regression this
      change caused, but the task as written implies e2e/sweep should gain
      lint coverage, and it did not.
- [ ] `pnpm lint && pnpm catalog:check` green — **catalog:check is green**
      (`catalog:check OK — 23 code routes (2 excluded), 21 catalog routes, no
drift`), but `pnpm lint` is currently red: `eslint .` reports 2
      `no-template-curly-in-string` warnings in
      `tools/eslint-rules/no-comment-archaeology.test.ts:36-37` (committed at
      `bf1d5672`, part of this change's own archaeology-rule work), which trips
      `--max-warnings 0`. Not concurrent-edit noise — this file is clean in git
      status and was authored by this change.

## 2. Two scripts become ESLint rules

- [x] Rewrite the gate as `scripts/status-ssot-gate.ts` driving ESLint's `Linter`
      API with `linterOptions: { noInlineConfig: true }` and four selectors, over
      a tree walk it owns — NOT as entries in `eslint.config.ts`. Verified by
      reading the file: it is exactly this shape, with the four-way rationale
      preserved in a header comment.
- [x] Each selector must cover BOTH `TSUnionType` and
      `CallExpression[callee.object.name="z"][callee.property.name=/^(enum|union)$/]`
      — confirmed in the `DECLARATION` constant.
- [x] Report status needs exact set equality, not containment — confirmed: the
      `ReportStatus` vocabulary entry sets `exact: true`, applying the
      `nothingBut(...)` selector fragment.
- [x] Cover backtick literal unions — confirmed: `contains`/`isNot` match both
      `Literal` and `TemplateElement` nodes.
- [ ] Carry the seven `ALLOWLIST` paths over unchanged — **not done**. Only 4 of
      7 survive in `scripts/status-ssot-gate.ts:66-74` (the 3 SSOT declarations + `prisma/seed-constants.ts`). The 3 e2e mirror exemptions
      (`e2e/integration/fixtures.ts`, `e2e/sweep/catalog-sweep.spec.ts`,
      `e2e/sweep/helpers/dev-auth.ts`) are missing, even though
      `openspec/specs/status-type-ssot-gate/spec.md:28-34` still names all
      seven as required. Currently harmless (`--all` finds 0 hits today because
      those three files no longer literally re-declare a union — they import
      the type instead), but the gate does walk `e2e/**` (its own `IGNORE`
      regex does not exclude it), so the exemption is load-bearing the moment
      any of those three files needs to redeclare a role/status literal again.
      Spec and implementation have drifted; reconcile one direction or the
      other rather than leaving this silently unticked forever.
- [x] Prove the no-escape property survives — confirmed in
      `scripts/status-ssot-gate.test.ts:195-199`: a bare `/* eslint-disable */`,
      an `eslint-disable-next-line`, and an `eslint-disable-line` are each
      planted over a violation and asserted to still fire.
- [x] Amend `openspec/specs/status-type-ssot-gate/spec.md` — confirmed: it now
      names `scripts/status-ssot-gate.ts` (not the deleted `.mjs`), and the
      canonical-SSOT drift Codex found is fixed (spec now points at
      `packages/shared/src/schemas/canonical-status.ts` / `auth.ts`, not
      `apps/web/src/lib/status-presentation.ts`).
- [x] Add the local archaeology rule over `sourceCode.getAllComments()`; cover it
      with `RuleTester` under vitest, including the RFC-5322-in-a-URL case —
      confirmed: `tools/eslint-rules/no-comment-archaeology.ts` +
      `no-comment-archaeology.test.ts` (`RuleTester`, 21 passing cases including
      the RFC-5322 fixture); `pnpm exec vitest run` on that file is green.
      Note: the same test file also trips 2 `no-template-curly-in-string`
      ESLint warnings against the repo's own `--max-warnings 0` gate — see the
      note under section 1's `pnpm lint` bullet.
- [ ] Delete `scripts/find-status-literal-unions.mjs`, `scripts/find-archaeology.mjs`
      and both `.test.mjs` files; remove `lint:status-literal-unions` from
      `pnpm lint` and both entries from `lint-staged` — **partially done**.
      The four old files are confirmed gone (`find . -iname
'*find-archaeology*'` / `'*find-status-literal-unions*'` outside
      `openspec/changes/archive/` return nothing), and `lint-staged` is down
      from 2 entries (`find-archaeology.mjs`, `find-status-literal-unions.mjs`)
      to 1 (`status-ssot-gate.ts`) — the archaeology half is now covered by
      `eslint --fix`, which already runs first in the same lint-staged step.
      But the npm script key in `pnpm lint` is still literally named
      `lint:status-literal-unions` (its body was repointed at the new gate,
      not renamed) — the task explicitly says "remove" that key, and it is
      still there, so left unticked.
- [ ] Prove no coverage was lost: run the old scripts and the new rules over the
      same tree and diff the hit sets before deleting — **not verifiable
      retrospectively**. This describes an action taken during implementation;
      the old `.mjs` scripts are deleted, so the diff cannot be reproduced now.
      Leaving unticked rather than assuming it happened.

## 3. One declaration per dependency

- [x] Add `catalog:` to `pnpm-workspace.yaml` for the thirteen dependencies
      declared in more than one manifest — confirmed: 13 entries under
      `catalog:` (luxon, @types/luxon, @types/node, @types/react, tsx,
      @trpc/server, react, superjson, zod, lucide-react, react-dom, recharts,
      sonner).
- [x] Resolve `recharts` to one range — confirmed: catalog pins `^3.10.0`; both
      `apps/web/package.json` and `packages/ui/package.json` reference
      `"recharts": "catalog:"`.
- [x] Replace the literal ranges with `catalog:` in every workspace manifest —
      confirmed by grep: none of the 13 catalogued names appear as a literal
      range in any workspace `package.json` any more.
- [x] Drop the `@types/node` cross-manifest check from
      `check-runtime-node-sync.ts` — confirmed: the script now reads a single
      `pnpm-workspace.yaml catalog @types/node` declaration, with a comment
      explaining pnpm now enforces cross-manifest agreement at install.
- [x] `pnpm install --frozen-lockfile` clean, `pnpm build` green — confirmed:
      `pnpm install --frozen-lockfile` → "Already up to date" (exit 0);
      `pnpm build` fails on `apps/web` only because `API_URL`/
      `NEXT_PUBLIC_API_URL` are unset in this shell — the no-silent-default
      house rule working as designed, not a build defect. With those two vars
      set, `pnpm --filter @customreport/web build` completes and emits all 21
      routes.

## 4. Close the image-rot cause

- [x] Add the `docker` ecosystem to `.github/dependabot.yml` for `Dockerfile.api`
      and `Dockerfile.web`, grouped so both move together — confirmed: a
      `docker` ecosystem block with `directories: ["/"]` and a
      `docker-base-images` group covering `"*"`.
- [x] Confirm the runtime-sync gate fails when only one image is bumped — plant
      a mismatch, expect exit 1, revert — reproduced live: dropped
      `Dockerfile.web`'s base image major from 26 to 25, ran
      `node scripts/check-runtime-node-sync.ts`, got the expected "Node major
      drift" report and exit 1; restored the file, gate passed again (exit 0).

## 5. Verification

- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm knip`, `pnpm depcruise`
      — 4 of 5 green: `pnpm typecheck` (turbo, 5/5 tasks), `pnpm test` (turbo,
      229 web test files / 2127 tests + api suite, all passing), `pnpm knip`
      (0 unused-export failures, only informational config hints), and
      `pnpm depcruise` ("no dependency violations found", 1023 modules) all
      pass as of this check. `pnpm lint` does not — see the `no-comment-archaeology.test.ts`
      warning noted under section 1.
- [ ] Docker build of both images from a clean cache — not run in this pass
      (out of scope for a paperwork-reconciliation check; needs an explicit
      docker build invocation to confirm).
- [ ] CI green on all jobs after push — not verifiable without pushing, which
      this pass deliberately did not do (CI here is manual-dispatch only per
      `CLAUDE.md`, and no push was requested).
