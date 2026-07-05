## Why

`tighten-comment-policy` (archived 2026-07-03) locked the three-line WHY comment
budget and the relocation-before-compression rule, then deferred the first real
sweep to a follow-up so the flagged auth files could get a dedicated
security-review pass (its D7, tasks 2.1/2.2). This is that follow-up. The owner
line-by-line flagged `apps/api/src/modules/auth` as the calibration exemplar; the
policy is now durable, `refactor-auth-exemplary-layering` is archived, and the
auth folder is clean in `git status` — so the sweep can run and the per-line
owner veto can be settled here.

## What Changes

- Apply the comment-policy calibration sweep across **all seven non-test source
  files** in `apps/api/src/modules/auth` as a single **comment-only,
  zero-behavior-change** diff: compress over-budget WHY to spec-pointers, delete
  narration / archaeology / app-internal JSDoc, strip ticket/phase prefixes
  (`AUTH-08`, `Phase 32-M8`, `AUTH-01`, `AUTH-02`, `refactor-auth-exemplary-layering:`,
  `UFB-040`), keep in-budget non-obvious WHY.
- Re-host the archived change's calibration table as this change's work-list,
  **re-verified against current line numbers** (they drifted: HS256 block is now
  `auth.controller.ts:14-24`, dev-login module header `dev-login.routes.ts:22-32`)
  and **extended to every comment in every file in the folder** — `auth.controller.ts`,
  `dev-login.routes.ts`, `auth.routes.ts`, `user-session.ts`, `saml.strategy.ts`,
  `session-deactivation.ts`, and `roles.guard.ts` (inventoried, confirmed clean) — not
  just the nine originally flagged rows.
- Record the durable finding that gates the open-redirect row: `dev-login.routes.ts:67-74`
  cannot become a `see safe-redirect-validation spec` pointer yet, because that
  delta was archived with `--skip-specs` and never synced into `openspec/specs/`
  — a pointer at it would dangle. Owner picks sync-then-compress (policy/brief
  preferred) or keep-and-defer.
- The diff MUST pass the auth security-review gate mandated by
  `lint-max-strictness-standard` before merge.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `lint-max-strictness-standard`: ADD a requirement establishing
  `apps/api/src/modules/auth` (all source files) as the maintained comment-policy
  calibration exemplar, applied via a security-reviewed comment-only sweep, with
  any retained over-budget comment that lacks a durable spec home treated as the
  relocation-first rule in action (not a violation).

## Impact

- Comment-only edits across all seven source files in `apps/api/src/modules/auth`
  (`auth.controller.ts`, `dev-login.routes.ts`, `auth.routes.ts`, `user-session.ts`,
  `saml.strategy.ts`, `session-deactivation.ts`; `roles.guard.ts` is already clean).
  No runtime behavior, exports, or signatures change.
- No product/`src` logic, no schema, no migration.
- Gate: full unit suite + lint green (unchanged), plus a security-review pass on
  the comment diff covering every security-sensitive file (HS256/cookie, audit,
  SAML fail-closed, session revocation, redirect). Ordering: the open-redirect
  compression (row DL5) is blocked on the `safe-redirect-validation` spec becoming
  durable (owner decision below); the session-deactivation rationale (SD1) is
  retained verbatim for the same reason.
- A separate `src` follow-up (owner decision, task 2.5) may align the api viewer
  redirect to `/reports/latest` per `viewer-report-navigation`; out of scope for
  this comment-only sweep.
