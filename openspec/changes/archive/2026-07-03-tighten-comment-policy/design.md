# Design — tighten-comment-policy

## Context

The owner reviewed the two flagship auth files line-by-line and flagged nearly
every comment block as noise, while the locked standard
(`docs/exemplary-code-standard.md` §1.3) tells sweeps to KEEP load-bearing WHY.
Both are half right: the rationale is load-bearing, but its home is wrong —
the HS256/secret-floor rationale already exists durably in
`jwt-session-integrity`, and the redirect rationale is specced in-flight
(`safe-redirect-validation`, durable when `fix-open-redirect-next-param`
archives — see D6), so the in-code copies are duplication that costs
scanability. The policy fix is relocation-first compression, not preservation
and not deletion.

Constraints: ~40 folders still await the exemplary rollout, so the policy must
land in the standard before sweeps replay the old target. A parallel session
edits the working tree (incl. `auth` files) — the exemplar sweep must schedule
around it. Comment noise is not lint-detectable, so the done-signal cannot be
"lint green" alone.

## Goals / Non-Goals

**Goals**

- One unambiguous comment rule every future sweep applies mechanically.
- Zero loss of protective (security/coordination) rationale — it survives in
  specs/ADRs instead of code.
- The flagged auth files become the calibration exemplar — via a FOLLOW-UP
  sweep change, so this policy change archives independently.

**Non-Goals**

- No lint-rule implementation (impossible for "is this comment noise").
- No product/`src` code edits in THIS change (docs + the rollout workflow
  script only): the auth exemplar sweep is split into a follow-up change
  (`sweep-auth-comments-exemplar`) because the auth folder is currently dirty
  under a parallel session and needs its own security-review pass.
- Not the per-file audit program or backlog sequencing — process concerns,
  documented in `docs/handoff/`, not specced.

## Decisions

**D1 — Budget = 3 lines, WHY-only.** Calibrated on the owner's feedback: the
2-line `auth.controller.ts:68-69` note (logout must mirror the set-cookie
attributes) he read without complaint fits; the 11-line HS256 block he flagged
does not. Alternative "keep load-bearing regardless of size" (status quo)
rejected — it produced exactly the blocks he flagged. Consequence: the
standard's own §1.3 rate-limit `ipKeyGenerator` exemplar (currently 5 lines)
must be compressed to its ≤3-line form in the same doc edit, or the standard
contradicts itself.

**D2 — Relocation-before-compression, spec-first.** The durable WHY belongs in
`openspec/specs/` (behavioral) or an ADR (decision). Alternatives rejected:
plain deletion (Chesterton's fence — re-opens algorithm-confusion /
open-redirect regressions the comments currently guard), and doc-comments
moved to README (no review gate binds READMEs to code changes).

**D3 — ADDED requirements only, under `lint-max-strictness-standard`.** That
capability already owns the JSDoc/public-API comment rule, so it is the
precedented home. ADDED (not MODIFIED) headers avoid archive-time collision
with the in-flight `tighten-code-quality-ratchet`, which MODIFIES the
thresholds requirement in the same capability.

**D4 — Security review gates security-path sweeps.** A comment-only diff looks
harmless in review; routing auth/jwt/cookie/redirect/rate-limit/CSP sweeps
through a security pass is the cheap insurance that relocation actually
happened.

**D5 — Pointer comments are allowed but not required.** A ≤2-line compressed
comment may name the covering spec. Ticket/phase archaeology stays banned; a
live spec name is a navigable pointer, not archaeology.

**D6 — A relocation home must be a DURABLE spec.** `openspec/specs/` (or an
ADR) counts; a delta inside an unarchived change does NOT — a pointer at it
dangles for grep-of-specs readers. Where the covering requirement is still
in-flight (the open-redirect rationale lives in
`fix-open-redirect-next-param`'s `safe-redirect-validation` delta), the sweep
is ORDERED AFTER that change archives. Alternative (bless in-flight deltas as
interim homes + re-point later) rejected: two-step pointer churn for no gain.

**D7 — Policy and exemplar are separate changes.** This change is spec+doc
only and archives on its own; the first code sweep lands as the follow-up
`sweep-auth-comments-exemplar` once (a) the owner's veto pass approves the
calibration table, (b) `modules/auth` is clean in `git status`, and (c) D6's
ordering holds for the open-redirect comment.

## Calibration table (the owner's exact flags → target state)

Status: EVIDENCE for D1's budget choice, and the seed work-list for the
follow-up `sweep-auth-comments-exemplar`, which re-hosts it and owns the
per-line owner veto. THIS change's own verification gates only on the
budget-and-policy confirm (task 3.1), not on per-line approvals.

| Site                                                                        | Today            | After                                                                                                                                                                                                                                                                                                                              |
| --------------------------------------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth.controller.ts:10-20` (HS256 pin + refactor coordination, 11 lines)    | JSDoc block      | `// HS256 pinned + 32-char secret floor — required by jwt-session-integrity spec.` (1–2 lines); the coordination note (15–19) is archaeology of the ARCHIVED `refactor-auth-exemplary-layering` change and its substance survives in `jwt-session-integrity` — deletable per the relocation rule, not silently                     |
| `auth.controller.ts:30-31` (layering narration)                             | 2-line narration | delete — code shows it                                                                                                                                                                                                                                                                                                             |
| `auth.controller.ts:68-69` (logout reuses cookie attrs)                     | 2 lines          | keep — non-obvious WHY within budget                                                                                                                                                                                                                                                                                               |
| `auth.controller.ts:75` `"production"` / `:76` `sameSite: "lax"`            | inline literals  | out of scope here — magic-literal policy already lands via `tighten-code-quality-ratchet`; the sweep may name them opportunistically                                                                                                                                                                                               |
| `dev-login.routes.ts:19-29` (module header, 11 lines)                       | JSDoc block      | 2 lines: dev-only surface, mounted only under `AUTH_DEV_MODE`; role-switcher-not-factory sentence moves to the auth module spec if unspecced                                                                                                                                                                                       |
| `dev-login.routes.ts:31-32`, `40-41` (Record exhaustiveness, web-sync note) | inline notes     | delete exhaustiveness narration (the `Record<Role, …>` type shows it); the web-sync note is KEPT compressed to ≤2 lines (corrected to name the real file) until the map actually dedups into `packages/shared` — the maps ALREADY diverge for viewer, a live bug the note guards (dedup tracked in `code-health-and-test-cleanup`) |
| `dev-login.routes.ts:64-71` (open-redirect one-parse rationale, 8 lines)    | comment essay    | `// One-parse origin gate — see safe-redirect-validation spec.` ONLY AFTER `fix-open-redirect-next-param` archives (D6) and the spec verifiably covers the backslash/`@`-bypass cases; until then the comment stays                                                                                                                |
| `dev-login.routes.ts:88-91`, `101-104`, `124-131` (helper JSDoc)            | JSDoc blocks     | delete or fold to ≤1 WHY line — app-internal helpers                                                                                                                                                                                                                                                                               |
| `dev-login.routes.ts:148-205` `createDevLoginHandler` (~57 lines)           | one function     | out of scope here — function-size rule already in the standard; noted for the auth follow-up sweep                                                                                                                                                                                                                                 |

## Risks / Trade-offs

- [Compression drops a nuance the spec lacks] → the relocation step REQUIRES a
  spec cross-check per file; the security gate double-checks security paths.
- [Parallel session edits auth while the exemplar sweep runs] → sweep waits for
  a clean `git status` on the folder; comment-only diff keeps conflicts trivial.
- [Review-gate rules erode without a lint backstop] → enforcement is TWO
  gates: the exemplary-rollout recon dimension at sweep time AND the standing
  PR-review dimension afterwards — a later PR that re-comments a "done" folder
  is caught in its own review, not left until the next sweep. NB: "standing PR
  review" here means reviewer/agent diligence (CI is manual-dispatch and MVP
  commits ride main) — no automated PR gate is implied or required.
- [Relocation target still in an unarchived change] → D6 ordering: the sweep
  compresses such a comment only after the owning change archives.
- [Future reader misses relocated context] → pointer comments name the spec;
  specs are greppable by the same terms (HS256, redirect).

## Migration Plan

Docs+spec change; no deploy. Rollback = revert the change directory and the
doc edit. The auth exemplar sweep lives in the follow-up change
(`sweep-auth-comments-exemplar`) as a single comment-only commit, revertable
in isolation.

## Open Questions

- Owner confirm pending on the POLICY only: the 3-line budget (D1) and
  relocation-first rule (D2/D6) — presented as a confirm, not an interview.
  The per-line calibration-table veto (esp. HS256/open-redirect compressions)
  belongs to the follow-up `sweep-auth-comments-exemplar` and does not gate
  this change.
