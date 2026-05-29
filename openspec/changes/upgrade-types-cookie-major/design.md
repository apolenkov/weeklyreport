# Design — Remove @types/cookie (deprecated stub)

## Context

`@types/cookie` is a DefinitelyTyped stub package declared at `^1.0.0` in
`apps/api` and `apps/web` `devDependencies`. The dependency audit reports its
latest registry state as **Deprecated** — there is no successor major to bump
to. DefinitelyTyped deprecates a `@types/*` package when the underlying runtime
package starts shipping its own first-party type definitions, which makes the
stub redundant.

Verified facts for this repo:

- Runtime `cookie` is declared `^1.0.2` in both workspaces and resolves to
  `cookie@1.1.1`, whose `package.json` declares `"types": "dist/index.d.ts"`,
  with that file present in the installed package.
- The only `cookie` references are runtime imports:
  `apps/api/src/modules/auth/auth.controller.ts` (`serialize`) and
  `apps/web/src/server/auth/session.ts` (`parse`). Both resolve through the
  package's bundled types once the stub is gone.
- `@types/cookie-parser@1.4.10` (also in `apps/api`) has empty `dependencies`
  and does not import from `cookie`; it is independent of the stub.
- No `tsconfig` `compilerOptions.types` allowlist names `cookie`, so there is no
  ambient include relying on the stub.

This is a Wave-3 ISOLATED work-item: classified "major" because a Deprecated
state needs investigation rather than a routine bump. It ships alone so a single
breaking dependency cannot sink a batch; the merge decision is the user's.

## Decision

**Remove `@types/cookie` from both workspaces' `devDependencies` and refresh the
lockfile. Do not replace it.**

The runtime `cookie` package supplies first-party types that already cover every
call site, and no other dependency (notably `@types/cookie-parser`) needs the
stub. Keeping it would retain a deprecated, redundant package and a duplicate,
potentially divergent source of `cookie` typings. The typecheck and build gates
are the safety net: if removal broke any type resolution, `pnpm typecheck` fails
immediately and the change is rejected rather than merged.

Removal is preferred over a "version bump" because there is no non-deprecated
version to move to — the correct end state for a superseded stub is deletion.

## Alternatives considered

- **Pin the last-published `@types/cookie` and keep it.** Rejected: it preserves
  a deprecated package that duplicates the runtime package's own types, inviting
  future divergence (two definitions of `serialize`/`parse` options) with no
  benefit. Only justified as a fallback if typecheck were to reveal a genuine
  consumer that still needs the stub — which the pre-flight checks show does not
  exist. The tasks keep this as a documented, `// TODO`-tagged escape hatch, not
  the default.

- **Leave the dependency untouched (defer).** Rejected: it knowingly retains a
  deprecated stub flagged by the audit, and the Wave-3 plan exists to clear
  exactly these items. Removal is low-risk and gate-verified.

- **Bundle this with the other type-package or minor upgrades.** Rejected by the
  Wave-3 ISOLATED rule: a single breaking dependency must be mergeable or
  rejectable on its own. This change touches only the two `package.json` files
  and the lockfile.
