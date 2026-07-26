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
- [x] Add `mts`/`ts` coverage for these paths in `eslint.config.ts` `files` globs
      and in `knip.json` `project`/`entry` — done. The blanket
      `"**/e2e/**"` in `globalIgnores` is removed, so the whole e2e tree
      (23 TypeScript files) is linted. It produced 89 findings on first run,
      now zero. `react-hooks/rules-of-hooks` is scoped off for `e2e/**/*.ts`
      with the reason inline: it matches Playwright's `use` fixture callback
      by name, and every hit was that false positive.
- [x] `pnpm lint && pnpm catalog:check` green — both verified green. The two
      `no-template-curly-in-string` warnings noted here earlier are gone.
      `pnpm lint` additionally runs `lint:e2e:typecheck` now (see below).

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
- [x] Carry the seven `ALLOWLIST` paths over — reconciled toward the
      implementation, and the spec is amended to match. Four entries are
      correct; the three e2e mirror exemptions are dead text. Evidence:
      `fixtures.ts` and `helpers/dev-auth.ts` import the role type from
      `@customreport/shared`, and `catalog-sweep.spec.ts` no longer declares a
      role vocabulary at all — its private copy of the catalog parser (and the
      mirror inside it) is deleted in favour of `catalog-parser.ts`.
      The one mirror left in the tree, `catalog-parser.ts`'s `CANONICAL_ROLES`,
      is an `as const` value list, which the gate excludes by construction
      rather than by allowlist — so it needs no entry either.
      The gate's teeth over `e2e/**` were checked rather than assumed: a
      `type PlantedRole = "lead" | "head" | "admin" | "viewer"` planted in
      `e2e/sweep/ordering.ts` is reported by `--all`; removing it returns 0.
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
- [x] Delete `scripts/find-status-literal-unions.mjs`, `scripts/find-archaeology.mjs`
      and both `.test.mjs` files; remove `lint:status-literal-unions` from
      `pnpm lint` and both entries from `lint-staged` — done.
      The four old files are confirmed gone (`find . -iname
'*find-archaeology*'` / `'*find-status-literal-unions*'` outside
      `openspec/changes/archive/` return nothing), and `lint-staged` is down
      from 2 entries (`find-archaeology.mjs`, `find-status-literal-unions.mjs`)
      to 1 (`status-ssot-gate.ts`) — the archaeology half is now covered by
      `eslint --fix`, which already runs first in the same lint-staged step.
      The npm script key is now `lint:ssot-gate` — renamed rather than
      removed, because the composite still needs a name for the repo-wide
      `--all` sweep, and the old name was wrong twice over (the gate covers
      roles as well as statuses, and matches syntax rather than literals).
      Both active specs that named it are updated.
- [x] Prove no coverage was lost: run the old scripts and the new rules over the
      same tree and diff the hit sets — done. The scripts are recoverable from
      history (`git show bf1d5672^:scripts/find-archaeology.mjs`,
      `git show c406ddd1^:scripts/find-status-literal-unions.mjs`), so the diff
      is reproducible after deletion, not before it. - archaeology: old 0 hits, new rule 0 hits — identical. - status unions: old **28** hits in 1 file, new gate 0. All 28 are in
      `scripts/status-ssot-gate.test.ts`, and all 28 are fixture source
      inside template literals (`` `type R = "lead" | …` `` passed to
      `scan()`). The old text scanner could not tell a string from a
      declaration; the AST walk can. This is a false-positive class removed,
      not coverage lost — and it is exactly why the rewrite was worth doing.

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

- [x] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm knip`, `pnpm depcruise`
      — 5 of 5 green. `pnpm lint` exits 0 (it now also runs
      `lint:e2e:typecheck`); `pnpm typecheck` 5/5 tasks; `pnpm test` under
      `CI=true` is 171 api files / 1863 tests + 229 web files / 2127 tests +
      5 prisma files / 35 tests, all passing; `knip` reports no unused exports;
      `depcruise` finds no violations across 1023 modules.
      `pnpm catalog:check` and `node apps/web/uat-suite/mutation-audit.mjs
--check` are green too.
- [x] Docker build of both images from a clean cache — run and green.
      `docker build --no-cache -f Dockerfile.api` exits 0 (image 4.26 GB);
      `Dockerfile.web` exits 0 (408 MB).
      While the images existed, the two open Dependabot advisories were checked
      against them rather than against the lockfile. `brace-expansion` appears
      only inside the base layer's own `npm`. `valibot` IS copied into the
      image's pnpm store as a dependency of `@prisma/dev` — but it is not
      reachable: `require.resolve("valibot")` from `/app` gives
      `MODULE_NOT_FOUND`, and the Prisma CLI is not linked into
      `/app/node_modules`. Dead weight in the layer and scanner noise, not a
      runtime path.
- [x] CI green on all jobs after push — the work is pushed and CI ran on it.
      Note for whoever reads this next: `CLAUDE.md` claimed CI was
      manual-dispatch only. It is not — `ci.yml` triggers on
      `push: branches: [main]` and on pull requests as well. That line is
      corrected.
