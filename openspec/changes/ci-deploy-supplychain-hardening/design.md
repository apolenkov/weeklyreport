## Context

This change groups four P2 findings from the 2026-06-28 repo-excellence review
that all share one failure mode: a gate or control that is declared but not
actually enforced. They are bundled because they touch the same small set of
infrastructure files (CI workflow, Husky hooks, Dockerfiles, prod compose, Caddy
configs), carry no application-code or schema risk, and are most efficiently
validated together as one infrastructure sweep.

Source findings: `BL-CI-CD-GATES`, `BL-SUPPLY-CHAIN`, `BL-DEPLOY-SEAM-MISC`,
`BL-SECURITY-HEADERS-CSP`.

## Goals

- Make the CI workflow correct (no dangling script references) and the local
  pre-push hook a real pre-merge gate (typecheck + lint + format parity).
- Restore enforceable server-side CI once a runner exists; until then make the
  protection gap explicit, not implied.
- Guarantee reproducible, integrity-checked builds (frozen lockfile everywhere,
  pinned base images and toolchain).
- Align the API container's declared port/healthcheck with its runtime, and put
  the API behind the Caddy edge (expose-only).
- Ship an enforcing CSP at the edge, validated against the bundle first.

## Non-Goals

- Routing `/pdfs` at the Caddy edge — owned by `route-pdfs-and-authz`
  (`BL-PDF-CADDY-404`).
- Removing `/metrics` from the public Caddy `@api` matcher — owned by
  `protect-metrics-endpoint` (`BL-METRICS-PUBLIC`).
- Enabling Express `trust proxy` — owned by `set-express-trust-proxy`; this
  change only removes the host-port that is its prerequisite.
- Any npm dependency version bump (governed by `dependency-currency`).
- Adding incremental alter-table migrations — none needed; no schema change.

## Key Decisions

### 1. Which seed script replaces `db:seed:simple`

The CI **visual-regression** job (`visual-baseline`, not the E2E job — the E2E
job seeds via `pnpm exec tsx prisma/seed.ts`) calls `pnpm db:seed:simple`, which
does not exist. The defined seed scripts are `db:seed:small` (`seed-demo.ts
small`), `db:seed:middle` (`seed-simple.ts`), and `db:seed:huge` (`seed-demo.ts
huge`). The job's step is labelled "deterministic fixture" and its comment says
it "seeds with `seed-simple` for byte-stable fixtures"; `prisma/seed-simple.ts`
is that deterministic fixture, reached via `db:seed:middle`. **Decision: use
`pnpm db:seed:middle`.** `db:seed:small` is the fallback only if the visual suite
turns out to need the smaller demo dataset — the implementer confirms against
what the visual baselines expect before committing.

### 2. Pre-push scope: cheap deterministic jobs only

The dormant CI runs lint, format:check, typecheck, unit tests, mutation audit,
catalog drift, integration/E2E, migrate-reset drift, and docker build. Pushing
all of these into pre-push would make every push slow. **Decision: pre-push adds
only the cheap, deterministic, no-services jobs** — `pnpm turbo typecheck`,
`pnpm lint`, `pnpm format:check` — on top of the existing `catalog:check` and
`pnpm test`. Heavier jobs (E2E, migrate-reset, docker build) stay for the
server-side gate. The `CI=true` / `SKIP_PREPUSH=1` escape hatches are preserved.

### 3. Server-side enforcement is conditional on a runner

`ci.yml` is `workflow_dispatch`-only because the GitHub Enterprise repo had zero
runners assigned (per the existing header comment). Branch protection is
plan-locked. **Decision: split the work** — the script fix, frozen-install, and
digest pins land now (they are correct regardless of runner state and improve
the workflow whenever it does run); restoring `push`/`pull_request` triggers and
required status checks is gated on a runner being provisioned and is tracked as a
follow-up task, not silently dropped. The no-runner state stays documented in the
workflow header so the gap is explicit.

### 4. API port: align to 3001 vs parameterize via PORT

The runtime binds `3001` (compose healthcheck and `API_URL` both use `3001`);
the Dockerfile hardcodes `3002`. **Decision: align `EXPOSE`/`HEALTHCHECK` to
`3001`** as the minimal fix, or parameterize both via `PORT` with `3001` as the
default if the implementer prefers a single source of truth. Either satisfies the
spec; hardcoded `3002` does not.

### 5. API networking: expose-only vs localhost bind

**Decision: `expose: ["3001"]`** (compose-network only), mirroring `web`. A
`127.0.0.1`-bound publish is an acceptable alternative if a documented ops need
requires host access. Plain `0.0.0.0` host-publishing is removed because it lets
callers bypass the Caddy edge and forge `X-Forwarded-For` once trust proxy is on.

### 6. CSP: validate before enforce

The current Report-Only policy is `default-src 'self'; img-src 'self' data:;
style-src 'self' 'unsafe-inline'; connect-src 'self'` with no `script-src`
(scripts fall back to `default-src 'self'`). Next.js may need a script nonce or
specific allowances. **Decision: validate the candidate policy in Report-Only
mode against the production bundle across all role surfaces, add any required
directive (likely a nonce-based `script-src`), then flip both Caddyfiles to the
enforcing `Content-Security-Policy` header.** A report sink is optional and must
not gate enforcement.

## Cross-Change Dependencies

- `set-express-trust-proxy` cites `BL-DEPLOY-SEAM-MISC` (this change's
  `deploy-edge-topology`) as a hard production prerequisite. Making the API
  expose-only here unblocks safely enabling trust proxy there.
- Out-of-scope edge findings (`route-pdfs-and-authz`, `protect-metrics-endpoint`)
  also edit the Caddyfiles; coordinate the edits so the Caddy changes do not
  collide (CSP header block vs `@api` path matcher are different regions).

## Risks

- **Frozen lockfile surfaces real drift** in `Dockerfile.web` — mitigated by
  refreshing and committing `pnpm-lock.yaml` rather than reverting the flag.
- **CSP flip breaks the app** if validation misses a source — mitigated by the
  validate-in-report-mode-first requirement.
- **Digest pins go stale** — acceptable given the repo's manual
  dependency-currency posture; pins are updated deliberately, not floated.

## Repo Conventions Honored

- No incremental migrations (no schema change here).
- No `pnpm lint:md` / markdownlint (removed from the toolchain).
- English-only production UI is unaffected (no UI strings touched).
- MVP posture: infra files only; no application source or schema edits.
