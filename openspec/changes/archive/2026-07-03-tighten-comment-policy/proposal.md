# Tighten the Comment Policy: Terse WHY, Relocation-First

## Why

The owner's line-level calibration pass over the already-exemplary `auth`
module showed the current comment policy over-preserves: 10–20-line JSDoc/WHY
blocks read as noise and defeat the "instantly scannable file" goal, while
much of that rationale already has a spec home: `jwt-session-integrity`
durably pins the HS256 allow-list and the 32-char secret floor TODAY, and the
one-parse redirect gate is specced in-flight (`safe-redirect-validation`,
durable once `fix-open-redirect-next-param` archives). The
standard's "keep load-bearing WHY" has no size bound, so every future
per-folder exemplary sweep would replay the same over-commenting. This must be
fixed in the standard BEFORE the repo-wide rollout, or ~40 folders get swept to
the wrong target.

## What Changes

- **Comment budget.** Default is no comment. A `src` comment is justified only
  for a non-obvious WHY the code cannot express, within a 3-line budget.
  Narration, change-log archaeology, and JSDoc blocks on app-internal
  functions are noise (extends the existing "JSDoc is public-API-only"
  requirement from "not required" to "removed during sweeps").
- **Relocation-before-compression.** Rationale that exceeds the budget is not
  deleted: it moves to the owning `openspec/specs/` requirement (or ADR) —
  verified present or added there first — then the code comment compresses to
  ≤2 lines, optionally pointing at the spec. Deleting unrelocated load-bearing
  rationale is a violation.
- **Security gate for comment sweeps.** A sweep that strips comments in
  security-sensitive paths (auth, JWT, cookies, redirects, rate-limit, CSP)
  passes a security review before merge.
- **Enforcement is a review gate, not lint.** No lint rule can judge comment
  noise; the audit/PR-review dimension enforces this policy, and lint-green
  explicitly does NOT imply comment-clean.
- Update `docs/exemplary-code-standard.md` §1.3 to the new wording (including
  compressing its own 5-line rate-limit exemplar to budget); extend the
  `exemplary-rollout` workflow recon dimensions to audit against it.
- **Calibration exemplar sweep moves to a FOLLOW-UP change**
  (`sweep-auth-comments-exemplar`): the auth folder is dirty under a parallel
  session and the open-redirect relocation target archives with
  `fix-open-redirect-next-param` — this change stays policy-only and archives
  independently.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `lint-max-strictness-standard`: adds comment-budget, relocation-first, and
  review-gate-enforcement requirements; extends the JSDoc public-API-only
  requirement's sweep posture. No existing requirement header is modified
  (collision-safe with the in-flight `tighten-code-quality-ratchet`).

## Impact

- `docs/exemplary-code-standard.md` (§1.3 comment hygiene rewritten).
- `.claude/workflows/exemplary-rollout.js` (recon prompt gains the
  comment-policy dimension).
- First code sweep: deferred to `sweep-auth-comments-exemplar` — comment-only
  diff; requires spec cross-check against `jwt-session-integrity` and, AFTER
  `fix-open-redirect-next-param` archives, `safe-redirect-validation`.
- All subsequent per-folder exemplary sweeps inherit the policy.
- No runtime behavior, API, or schema change. Not breaking.
