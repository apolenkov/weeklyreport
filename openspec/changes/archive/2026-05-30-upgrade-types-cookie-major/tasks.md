# Tasks

Gates after every step: `pnpm typecheck && pnpm lint && pnpm test`.

## Pre-flight

- [x] Record the baseline: `pnpm typecheck && pnpm lint && pnpm test` all green
      on the unchanged tree, so any post-removal failure is attributable to this
      change.
- [x] Re-confirm the removal precondition holds: resolved `cookie` ships its own
      types (`pnpm why cookie`, then check the resolved package's `package.json`
      has a `"types"` field and the `.d.ts` exists), and the only `cookie`
      references are runtime imports — `apps/api/src/modules/auth/auth.controller.ts`
      and `apps/web/src/server/auth/session.ts`
      (`grep -rn 'from "cookie"' apps/api/src apps/web/src`).
- [x] Confirm no `tsconfig` `compilerOptions.types` allowlist names `cookie`
      (`grep -rn '"types"' apps/api/tsconfig*.json apps/web/tsconfig*.json
tsconfig*.json`); if one does, stop and report — removal would break the
      ambient include.
- [x] Confirm `@types/cookie-parser` does not depend on `@types/cookie`
      (resolved package `dependencies` is empty and its `index.d.ts` does not
      import from `cookie`); record this so the `apps/api` removal is justified.

## Removal

- [x] In `apps/api/package.json` `devDependencies`, delete the `@types/cookie`
      entry (`^1.0.0`). Leave `cookie` and `@types/cookie-parser` untouched.
- [x] In `apps/web/package.json` `devDependencies`, delete the `@types/cookie`
      entry (`^1.0.0`). Leave `cookie` untouched.
- [x] Run `pnpm install` to refresh `pnpm-lock.yaml`; verify `@types/cookie` is
      no longer resolved as a direct dependency (`pnpm why @types/cookie` shows
      no direct workspace consumer, only any incidental transitive entry).

## Breaking-change migration

- [x] Run `pnpm typecheck` and confirm the `cookie` imports in
      `auth.controller.ts` and `session.ts` resolve against the package's
      bundled `dist/index.d.ts` with no new errors.
- [x] Confirm `apps/api` still typechecks `cookie-parser` usage
      (`apps/api/src/main.ts`) after the stub is gone.
- [x] If any unexpected type error surfaces (e.g. a transitive consumer that
      actually needed the stub), fix it at the call site or re-add a documented,
      pinned last-published stub with a `// TODO` justification — do NOT silence
      with `any`. Record the finding for the merge decision.

## Full gate run

- [x] `pnpm typecheck` passes across all workspaces.
- [x] `pnpm lint` passes with `--max-warnings=0` discipline intact.
- [x] `pnpm test` passes (unit + component suites).
- [x] `pnpm build` passes for `apps/api` and `apps/web`.
- [x] `pnpm lint:md` passes for the planning docs.
- [x] Confirm the diff touches only `apps/api/package.json`,
      `apps/web/package.json`, and `pnpm-lock.yaml` (no unrelated dependency
      moved, no source change); report the result for the user's merge decision.
