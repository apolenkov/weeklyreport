# Remove @types/cookie (deprecated stub) — Wave-3 isolated major

## Why

`@types/cookie` is declared as `^1.0.0` in two workspaces (`apps/api`
`devDependencies` and `apps/web` `devDependencies`). The dependency audit
reports its latest published state as **Deprecated**: there is no newer major to
bump to. The reason is that the runtime `cookie` package now ships its own
first-party type definitions, making the DefinitelyTyped stub strictly
redundant.

This is verified, not assumed:

- The resolved runtime `cookie@1.1.1` (both workspaces declare `cookie@^1.0.2`)
  publishes `"types": "dist/index.d.ts"`, and that declaration file exists in the
  installed package. So the bundled types satisfy `import { serialize } from
"cookie"` (`apps/api/src/modules/auth/auth.controller.ts`) and `import { parse
} from "cookie"` (`apps/web/src/server/auth/session.ts`) without the stub.
- `apps/api` also declares `@types/cookie-parser@1.4.10`. Its installed
  `package.json` has empty `dependencies` and its `index.d.ts` does not import
  from `cookie` (it defines its own `CookieParseOptions`), so it does not rely on
  `@types/cookie` either.
- No `tsconfig` `compilerOptions.types` allowlist in `apps/api`, `apps/web`, or
  root names `cookie`, so removal cannot break an implicit ambient-types include.

The correct action is therefore **removal**, not a version bump. It is
classified as a Wave-3 ISOLATED major work-item only because a "Deprecated"
registry state requires investigation/replacement rather than a routine bump.
Shipping it alone ensures one breaking dependency cannot sink a larger batch;
the merge decision is the user's.

## What Changes

- Remove `@types/cookie` from `apps/api/package.json` `devDependencies`.
- Remove `@types/cookie` from `apps/web/package.json` `devDependencies`.
- Refresh `pnpm-lock.yaml` so the stub is no longer resolved.
- Confirm via `pnpm typecheck` that `cookie`'s bundled types resolve for both
  call sites and that `@types/cookie-parser` still typechecks in `apps/api`.
- Run the full gate suite (`pnpm typecheck`, `pnpm lint`, `pnpm test`,
  `pnpm build`, `pnpm lint:md`) and report the result for the merge decision.

Out of scope: the runtime `cookie` dependency (unchanged at `^1.0.2`),
`@types/cookie-parser`, and every other dependency. No source-code changes are
expected; the `cookie` imports already point at the package that now supplies
the types.

## Impact

- Affected packages: `apps/api` (`@customreport/api`), `apps/web`
  (`@customreport/web`).
- Affected files: `apps/api/package.json`, `apps/web/package.json`,
  `pnpm-lock.yaml`. Source files are expected untouched.
- Capability spec: `dependency-currency` (shared with the other Wave-3 isolated
  upgrades) — adds a removal-of-redundant-stub-types requirement.
- Risk: Low. Removal only drops a redundant, deprecated stub already superseded
  by the runtime package's bundled types; the typecheck gate immediately catches
  any unexpected missing type. No runtime/behavior change.
