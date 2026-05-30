# Design

## Context

`@types/node` describes the Node.js standard library. Its major version tracks
a Node major. The repo's declared dep is `^24.9.1` (root + `apps/web`),
resolving to 24.12.4, while the runtime has already advanced to Node 25:

- `.nvmrc` = `25`
- `.github/workflows/ci.yml` sets `NODE_VERSION: "25"` (used by every job).
- `engines.node` = `>=24.0.0` (a _floor_, not the major actually run).

So the types lag the runtime by one major. The canonical `@types/node` hazard
is the reverse direction — types _ahead_ of the runtime surface APIs that fail
at execution. Here the bump moves types **up to** the runtime already in use,
which is the safe direction.

`apps/api` does not declare `@types/node`; only root and `apps/web` do, and they
share the same declared range, so they must move together to stay on one major.

## Decision

Bump `@types/node` to `^25.9.1` in root `package.json` and `apps/web/package.json`
together, refresh the lockfile, and validate on Node 25.

Do **not** modify `engines.node`, `.nvmrc`, or CI `NODE_VERSION` in this change.

Rationale:

- The runtime decision is already made (`.nvmrc` 25, CI 25). This change only
  catches the _types_ up to it — it is alignment, not a runtime change.
- `engines.node = ">=24.0.0"` is a deliberate lower bound that permits Node 24
  consumers. Tightening it to `>=25` is a separate guardrail decision about
  which runtimes the project supports, beyond a types bump, and the merge
  decision for this batch is the user's. If the user wants the floor raised to
  match `.nvmrc`/CI, that is a follow-up change. This change leaves `>=24` as-is
  and notes the (benign) mismatch rather than silently editing a guardrail.
- Isolating this single major upgrade means a type-level breaking change cannot
  block unrelated Wave-3 bumps; it can be merged or reverted on its own.

## Alternatives considered

- **Also raise `engines.node` to `>=25`.** Rejected for this change: it changes
  the supported-runtime contract, which is out of scope for a types upgrade and
  is the user's call. Left for a dedicated follow-up if desired.
- **Pin to an exact `25.9.1` (drop the caret).** Rejected: the repo convention
  for `@types/*` is caret ranges; pinning would diverge from the existing style
  and block routine patch pickups. Lockfile already gives reproducibility.
- **Stay on `@types/node` 24 to match `engines` floor.** Rejected: it keeps the
  types a major behind the runtime that `.nvmrc` and CI actually execute, which
  is the very gap this change exists to close.
- **Batch with other Wave-3 majors.** Rejected per the locked ISOLATED scope: a
  single breaking dep must not sink the batch.
