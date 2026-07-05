# Design — sweep-auth-comments-exemplar

## Context

This is the code sweep `tighten-comment-policy` deferred (its D7 / tasks 2.1-2.2).
That change locked the policy in `lint-max-strictness-standard` and left the auth
folder as the calibration exemplar for a follow-up with its own security-review
pass. All three of D7's preconditions now hold:

- **Policy owner-confirmed** 2026-07-02 (the 3-line budget + relocation-first rule).
- **`modules/auth` is clean** in `git status` (verified — no parallel-session edits
  in flight on these files).
- **`fix-open-redirect-next-param` D6 ordering** for the open-redirect comment: that
  change IS archived (`openspec/changes/archive/2026-07-02-fix-open-redirect-next-param/`).

But `fix-open-redirect-next-param` D6 has a **second** condition the archived table's
own wording states ("...and the spec verifiably covers the backslash/`@`-bypass
cases; until then the comment stays"): a DURABLE, greppable spec home. That
condition is **NOT met**. The `safe-redirect-validation` delta exists only inside
the archived change directory; it was never synced into `openspec/specs/` (no
`openspec/specs/safe-redirect-validation/`; `openspec spec list` shows none;
`grep -r "same-origin\|WHATWG" openspec/specs/` returns only unrelated hits). A
`// see safe-redirect-validation spec` pointer would dangle for a reader grepping
`openspec/specs/`. This is the one row the sweep cannot close mechanically — it
needs an owner decision (see row DL5).

This change is spec + planning only: **the design stage makes no `src` edits**. The
sweep itself is tasks section 3 of this same change, executed after the section-2
verdicts land — a single comment-only commit. The calibration tables below are the
work-list and the per-line owner veto the sweep applies.

## Goals / Non-Goals

**Goals**

- One security-reviewed, comment-only diff that brings every source file in
  `modules/auth` to the three-line WHY budget with zero behavior change.
- Settle the per-line owner veto here (the "Your verdict" column below).
- Record the open-redirect sync-debt decision explicitly, not silently.

**Non-Goals**

- No runtime/behavior change; no export or signature change.
- No magic-literal or function-size fixes (those land via
  `tighten-code-quality-ratchet` / the standard's size rule — noted, not done here).
- Not re-litigating the policy itself (budget, relocation rule) — that is locked.

## Decisions

**D1 — Frame the ADDED requirement as policy CONFORMANCE, not "zero over-budget
comments."** The folder retains over-budget comments (open-redirect; the
session-deactivation two-tier rationale) pending a durable home. Claiming blanket
"no over-budget comments" would be false on arrival; framing the exemplar as
conformance to the budget **plus** the relocation-before-compression rule makes a
retained comment the rule in action.

**D2 — Whole-folder scope, all 7 source files.** For "exemplar" to be honest the
owner must veto every comment in the folder, and every source file must be
inventoried — including the ones that turn out clean. The tables below cover all
seven non-test source files (`auth.controller.ts`, `dev-login.routes.ts`,
`auth.routes.ts`, `user-session.ts`, `saml.strategy.ts`, `session-deactivation.ts`,
`roles.guard.ts`), not just the two originally flagged.

**D3 — ADDED under `lint-max-strictness-standard`.** Precedented home (D3 of the
archived `tighten-comment-policy`). ADDED headers never collide with in-flight
MODIFIED deltas; no active change touches this capability regardless.

**D4 — Open-redirect: owner picks sync-then-compress vs keep-and-defer.** The
relocation requirement (`lint-max-strictness-standard` → "Over-budget rationale is
relocated before compression", scenario "rationale with no spec home is relocated
first") says a sweep MUST **add the covering requirement when absent, then
compress**. Here the requirement is not absent — it is written, reviewed, and
archived, just unsynced. So the policy-preferred and brief-preferred path is
**sync-then-compress**; keep-and-defer is the scope-minimal alternative. Presented
neutrally in row DL5; default is NOT pre-baked.

**D5 — Resolve the scope mismatch by EXTENDING the inventory, not narrowing the
requirement (arbiter decision, logged per the review's flaw 1).** The Fable review
flagged that the requirement, D2, and the proposal all claim the whole folder while
the original table covered only 2 files — offering either narrowing or extending.
Extend wins on three counts: (a) three of the four in-doc claims are folder-wide
(requirement text "the folder MUST carry no...", D2, proposal "extended to every
comment in the folder"); only the proposal's Impact line named 2 files — the Impact
line is the outlier and is corrected, not the other three gutted. (b) Ground truth:
the five previously-uninventoried files genuinely violate the policy — `auth.routes.ts`
carries `AUTH-08`/`Phase 32-M8` archaeology, `saml.strategy.ts` carries
`AUTH-01`/`AUTH-02`/`Phase 29-04`/`CC-2 staged removal`, `user-session.ts` carries a
`refactor-auth-exemplary-layering:` prefix and `UFB-040 / Phase 46-01`. Narrowing
would leave a folder full of archaeology sitting next to an "exemplar" label. (c)
Extend keeps the already-correct folder-wide requirement text intact and only grows
the tables/tasks/Impact; narrowing would force rewriting the requirement itself.

**D6 — Viewer redirect divergence is recorded as an owner-decision, not enshrined.**
`DEV_LOGIN_REDIRECT_BY_ROLE.viewer` is `/reports?tab=published` (dev-login.routes.ts:49),
but `openspec/specs/viewer-report-navigation` durably mandates `/reports/latest` as
the viewer's stable entry (spec.md:5-6, 26). So the DL4 web-sync guard comment
protects a divergence from a **durable spec position**, not merely from the web map.
Aligning the api value is a `src` behavior change — out of scope for this
comment-only sweep — so it becomes an owner-decision task (2.5): align the api
viewer target to `/reports/latest` in a follow-up, or document why dev-login
intentionally differs. The spec scenario describes the divergence-guard **class**
(state-conditional), so this change does not bake `/reports?tab=published` in as
permanently correct.

## Calibration tables (re-verified line numbers → target → owner verdict)

Line numbers re-verified against the current working tree on 2026-07-05. Row IDs are
prefixed per file (`AC` auth.controller, `DL` dev-login, `AR` auth.routes, `US`
user-session, `SS` saml.strategy, `SD` session-deactivation) so no ID collides with
the `D1-D6` decisions above. "Your verdict" is the per-line owner veto this change
owns — fill it in before the sweep runs.

### `auth.controller.ts`

| #   | Site (current lines)                                         | Today            | Proposed after                                                                                                                 | Relocation home (verified)                                                                                                                                                                                                                  | Your verdict |
| --- | ------------------------------------------------------------ | ---------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| AC1 | `14-24` HS256 pin + coordination note (11-line JSDoc)        | JSDoc block      | `// HS256 pinned + 32-char secret floor — required by jwt-session-integrity.` (≤2 lines); DELETE the coordination note (19-23) | `jwt-session-integrity` durably requires the `["HS256"]` allow-list AND the ≥32-char floor (VERIFIED durable); `refactor-auth-exemplary-layering` is ARCHIVED so its coordination note is pure archaeology (the pin still lives at line 61) | **\_\_**     |
| AC2 | `34-35` "Layered on the generic presence helper…"            | 2-line narration | DELETE — the `requireEnv` call + length check show it                                                                          | code-evident, no home needed                                                                                                                                                                                                                | **\_\_**     |
| AC3 | `72-73` "Logout reuses this with an empty token…"            | 2 lines          | KEEP — non-obvious WHY within budget                                                                                           | n/a (in-budget)                                                                                                                                                                                                                             | **\_\_**     |
| AC4 | `82-83` `secure: NODE_ENV==="production"` / `sameSite:"lax"` | inline literals  | OUT OF SCOPE — magic-literal policy lands via `tighten-code-quality-ratchet`; sweep may name opportunistically                 | n/a                                                                                                                                                                                                                                         | **\_\_**     |

### `dev-login.routes.ts`

| #    | Site (current lines)                                                                                                                 | Today            | Proposed after                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Relocation home (verified)                 | Your verdict |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------ |
| DL1  | `22-32` module header (11-line JSDoc)                                                                                                | JSDoc block      | ≤2 lines: dev-only surface, mounted only under `AUTH_DEV_MODE`. The role-switcher-not-factory sentence (29-31) is DELETABLE — its substance is durable in `auth-module-layering` (dev-login resync rule + create-only SAML rule)                                                                                                                                                                                                                                                                        | `auth-module-layering` (VERIFIED durable)  | **\_\_**     |
| DL2  | `34-35` `Record<Role,…>` exhaustiveness narration                                                                                    | inline note      | DELETE — the `Record<Role, string>` type shows it                                                                                                                                                                                                                                                                                                                                                                                                                                                       | code-evident                               | **\_\_**     |
| DL3  | `56` `/** The dependencies the dev-login handlers close over. */` on `DevLoginDeps`                                                  | JSDoc            | DELETE — JSDoc on an app-internal (non cross-package-public) interface; the field list shows the deps                                                                                                                                                                                                                                                                                                                                                                                                   | code-evident (app-internal)                | **\_\_**     |
| DL4  | `43-44` web-sync note (`UX-16:` prefix)                                                                                              | inline note      | KEEP compressed ≤2 lines; DROP the `UX-16:` prefix; **CORRECT the file ref** to `apps/web/src/app/login-page-roles.ts` (where `DEFAULT_FOR_ROLE` lives — NOT `page.tsx`). Guards a LIVE divergence: api viewer `/reports?tab=published` (line 49) vs web/spec viewer `/reports/latest` — see D6                                                                                                                                                                                                         | n/a — live-divergence guard, stays in code | **\_\_**     |
| DL5  | `67-74` open-redirect one-parse rationale (8-line essay)                                                                             | comment essay    | **DECISION REQUIRED.** (a) KEEP verbatim — scope-minimal, defer compression; the `safe-redirect-validation` delta is archived but NOT synced to `openspec/specs/`, so a pointer dangles. (b) SYNC-THEN-COMPRESS — first `openspec sync-specs` the delta into `openspec/specs/` (attributed to `fix-open-redirect-next-param`), then compress to `// One-parse origin gate — see safe-redirect-validation spec.` — **policy-preferred + brief-preferred** (relocation rule: add the home, then compress) | none durable yet (the whole issue)         | **\_\_**     |
| DL6  | `53` `// The dev SAML-login shortcut signs in as admin…`                                                                             | 1 line           | KEEP — non-obvious WHY (why admin) within budget                                                                                                                                                                                                                                                                                                                                                                                                                                                        | n/a                                        | **\_\_**     |
| DL7  | `91-94` `resolveDevLoginRedirectUrl` header; `104-107` `handleDevSamlLoginRedirect` JSDoc; `127-134` `resolveDevLoginIdentity` JSDoc | JSDoc/blocks     | DELETE or fold to ≤1 WHY line — app-internal helpers (not cross-package public API)                                                                                                                                                                                                                                                                                                                                                                                                                     | code-evident                               | **\_\_**     |
| DL8  | `156-157` "Validate through the canonical role enum…"                                                                                | 2-line narration | DELETE — the `roleSchema.safeParse` call shows it                                                                                                                                                                                                                                                                                                                                                                                                                                                       | code-evident                               | **\_\_**     |
| DL9  | `181-183` "dev-login is the UAT role switcher: re-sync…"                                                                             | 3 lines          | COMPRESS ≤2 lines or DELETE — substance durable in `auth-module-layering` (dev-login resync rule)                                                                                                                                                                                                                                                                                                                                                                                                       | `auth-module-layering` (VERIFIED durable)  | **\_\_**     |
| DL10 | `210-215` `mountDevLoginRoutes` JSDoc ("registered here INSTEAD of the passport handler…")                                           | JSDoc block      | COMPRESS to ≤2-line WHY (mutual-exclusion by first-match) or DELETE if code-evident                                                                                                                                                                                                                                                                                                                                                                                                                     | n/a                                        | **\_\_**     |
| DL11 | `151-208` `createDevLoginHandler` (~57 lines)                                                                                        | one function     | OUT OF SCOPE — function-size rule (standard §hard-standard); noted for a separate refactor                                                                                                                                                                                                                                                                                                                                                                                                              | n/a                                        | **\_\_**     |

### `auth.routes.ts`

| #    | Site (current lines)                                                        | Today              | Proposed after                                                                                                                         | Relocation home (verified)           | Your verdict |
| ---- | --------------------------------------------------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------ |
| AR1  | `31` `// --- Route handlers ---` section banner                             | decorative rule    | DELETE — decorative divider, not WHY                                                                                                   | code-evident                         | **\_\_**     |
| AR2  | `32-34` `AuthRouteDeps` deps narration ("…thin wiring map")                 | 3-line note        | DELETE — app-internal narration; the field list + `mountAuthRoutes` show the wiring                                                    | code-evident                         | **\_\_**     |
| AR3  | `51-53` `AUTH-08:` SAML-callback-without-profile WHY                        | 3 lines w/ ticket  | STRIP `AUTH-08:` prefix; KEEP the WHY (emit login-fail even when role/userId unknown so the audit trail captures the attempt) ≤3 lines | n/a (in-budget after strip)          | **\_\_**     |
| AR4  | `73` `AUTH-08: structured login-success audit event`                        | 1 line w/ ticket   | DELETE — the `emit…` call is code-evident; ticket is archaeology                                                                       | code-evident                         | **\_\_**     |
| AR5  | `84-85` `AUTH-08:` post-passport-failure WHY                                | 2 lines w/ ticket  | STRIP `AUTH-08:` prefix; KEEP the WHY (any post-passport failure is still a failed login) ≤2 lines                                     | n/a (in-budget after strip)          | **\_\_**     |
| AR6  | `102-107` `AUTH-08:` + `Phase 32-M8 (M-08)` logout-audit anonymous-fallback | 6 lines w/ tickets | STRIP both prefixes; COMPRESS to ≤3-line WHY (fall back to userId='anonymous'/role=null so SIEM sees the no-session logout explicitly) | n/a (load-bearing SIEM rationale)    | **\_\_**     |
| AR7  | `115-116` cookie-clear reuse WHY (empty token + maxAge 0)                   | 2 lines            | KEEP — non-obvious WHY within budget                                                                                                   | n/a (in-budget)                      | **\_\_**     |
| AR8  | `134-136` FRONTEND_URL env WHY (no localhost fallback)                      | 3 lines            | KEEP/COMPRESS ≤3 lines — non-obvious (why no hardcoded fallback); already within budget                                                | `env-schema-coverage` (context only) | **\_\_**     |
| AR9  | `147` passport `@types` express@4/5 cast WHY                                | 1 line             | KEEP — non-obvious cast rationale, in budget                                                                                           | n/a                                  | **\_\_**     |
| AR10 | `150-152` SAML route first-match / dev-shortcut ordering WHY                | 3 lines            | KEEP/COMPRESS ≤3 lines — non-obvious Express first-match ordering                                                                      | n/a                                  | **\_\_**     |
| AR11 | `159` `@types/passport` authenticate cast WHY                               | 1 line             | KEEP — non-obvious cast rationale, in budget                                                                                           | n/a                                  | **\_\_**     |

### `user-session.ts`

| #    | Site (current lines)                                            | Today              | Proposed after                                                                                                                      | Relocation home (verified)                    | Your verdict |
| ---- | --------------------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ------------ |
| US1  | `4-11` module JSDoc, `refactor-auth-exemplary-layering:` prefix | 8-line JSDoc       | STRIP the change-name prefix (archaeology — that change is archived); COMPRESS ≤3-line WHY; layering substance is durable           | `auth-module-layering` (VERIFIED durable)     | **\_\_**     |
| US2  | `21-25` JSDoc on `ProvisionLeadWorkspace` seam interface        | 5-line JSDoc       | COMPRESS to ≤2-line WHY or DELETE — app-internal; composition-root wiring is code-evident                                           | `auth-module-layering`                        | **\_\_**     |
| US3  | `33-38` ФИО placeholder WHY (whole displayName→lastName)        | 6 lines            | COMPRESS ≤3 lines — non-obvious name-order decision; keep the placeholder rationale inline (do NOT drop to a bare pointer)          | `structured-user-name` (context, in-code WHY) | **\_\_**     |
| US4  | `42-44` P2002 `meta.target` driver-shape detector WHY           | 3 lines            | KEEP — non-obvious driver-shape WHY, in budget                                                                                      | n/a (in-budget)                               | **\_\_**     |
| US5  | `58-68` JSDoc on `writeProvisionedUser` + concurrency race WHY  | 11-line JSDoc      | FOLD to ≤3-line WHY — drop the JSDoc framing on an app-internal fn; KEEP the unique-collision re-read race rationale (load-bearing) | n/a (in-code WHY after fold)                  | **\_\_**     |
| US6  | `130-132` concurrent-first-login re-read WHY                    | 3 lines            | KEEP — non-obvious race WHY, in budget                                                                                              | n/a (in-budget)                               | **\_\_**     |
| US7  | `147` email-first / samlId-fallback match WHY                   | 1 line             | KEEP — in budget                                                                                                                    | n/a                                           | **\_\_**     |
| US8  | `152-154` SAML create-only vs dev resync WHY                    | 3 lines            | KEEP — load-bearing WHY (why dev resyncs, SAML doesn't), in budget                                                                  | `auth-module-layering` (context)              | **\_\_**     |
| US9  | `167`, `173-175` lead-section provisioning WHY                  | 1 + 3 lines        | KEEP/COMPRESS ≤3 lines — non-obvious injected-seam rationale                                                                        | n/a                                           | **\_\_**     |
| US10 | `187` active-report lookup WHY                                  | 1 line             | KEEP — in budget                                                                                                                    | n/a                                           | **\_\_**     |
| US11 | `200-201` structured-ФИО session WHY                            | 2 lines            | KEEP — in budget                                                                                                                    | n/a                                           | **\_\_**     |
| US12 | `208-211` `UFB-040 / Phase 46-01` groupId-in-JWT WHY            | 4 lines w/ tickets | STRIP the ticket/phase prefix; KEEP the WHY (carry groupId in the JWT so `groupScopeFilter` skips a per-request lookup) ≤3 lines    | n/a (in-budget after strip)                   | **\_\_**     |

### `saml.strategy.ts`

| #   | Site (current lines)                                                    | Today             | Proposed after                                                                                                                                                                                    | Relocation home (verified)    | Your verdict |
| --- | ----------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ------------ |
| SS1 | `14` `/** Verified profile shape downstream consumers expect */`        | 1-line doc        | KEEP — documents an exported type consumed across the module; in budget                                                                                                                           | n/a                           | **\_\_**     |
| SS2 | `15` eslint-disable with type-alias justification                       | 1 line            | KEEP — required inline suppression justification                                                                                                                                                  | n/a                           | **\_\_**     |
| SS3 | `33-36` `AUTH-01 (Phase 29-04):` devMode-narrow WHY                     | 4 lines w/ ticket | STRIP `AUTH-01 (Phase 29-04):`; KEEP the WHY (production ignores `AUTH_DEV_MODE`; boot fence refuses to start) ≤3 lines                                                                           | n/a (in-budget after strip)   | **\_\_**     |
| SS4 | `76-84` `AUTH-02 (Phase 29-02)` + `Phase 26/28` + `CC-2 staged removal` | 9-line JSDoc      | STRIP all ticket/phase archaeology; COMPRESS to ≤3-line WHY (Zod-parse fails closed on missing/unknown role; devMode retains the permissive fallback). DELETE the `CC-2 staged removal` narration | `saml-provisioning` (context) | **\_\_**     |
| SS5 | `95-96` no-base-to-string first-string-candidate WHY                    | 2 lines           | KEEP — non-obvious WHY, in budget                                                                                                                                                                 | n/a (in-budget)               | **\_\_**     |
| SS6 | `105-106` viewer-default WHY (`structured-user-name change`)            | 2 lines           | STRIP the `(structured-user-name change)` archaeology aside; KEEP the WHY (default SAML users to viewer)                                                                                          | `saml-provisioning` (context) | **\_\_**     |
| SS7 | `126-127` duplicate viewer-default WHY                                  | 2 lines           | DEDUP with SS6 / KEEP compressed ≤2 lines                                                                                                                                                         | n/a                           | **\_\_**     |

### `session-deactivation.ts`

| #   | Site (current lines)                                           | Today         | Proposed after                                                                                                                                                                                                                            | Relocation home (verified) | Your verdict |
| --- | -------------------------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ------------ |
| SD1 | `4-16` module JSDoc — two-tier fail-open/fail-closed rationale | 13-line JSDoc | **RETAIN verbatim (relocation-first).** Load-bearing security WHY (Redis fail-OPEN → Prisma fail-CLOSED; hard-deleted-user gap) with NO durable spec home yet — same class as DL5. Compression is a tracked task, gated on a durable home | none durable yet           | **\_\_**     |
| SD2 | `31-36` `isActive === false` (not `!isActive`) comparison WHY  | 6 lines       | COMPRESS ≤3 lines — non-obvious explicit-false vs falsy check; load-bearing (only an explicit deactivation bars)                                                                                                                          | n/a (in-code WHY)          | **\_\_**     |

### `roles.guard.ts`

Inventoried, **CONFIRMED CLEAN** — zero comments (21 lines). No sweep action. Listed
so the folder-wide exemplar claim is earned by every file, not only the swept ones.

## Retained-over-budget rows (relocation-first, tracked — not violations)

Two comments are over budget with no durable `openspec/specs/` home and are RETAINED
verbatim per the requirement's carve-out, each a tracked task:

- **DL5** open-redirect one-parse rationale → `safe-redirect-validation` (archived,
  unsynced). Blocked on the D4 owner decision.
- **SD1** session-deactivation two-tier fail-open/fail-closed rationale → no spec
  captures the revocation-tier invariant yet.

These are the concrete instances behind the spec's "rationale with no durable spec
home is retained" scenario, which is written state-conditionally (naming no file) so
a later sync closes the row without rotting the durable spec.

## Risks / Trade-offs

- **[Compression drops a nuance the spec lacks]** → each relocation-to-pointer row
  (only AC1 and, if D4=(b), DL5) cites a VERIFIED durable home; every other row is
  strip-and-keep or delete, needing no home. The security-review gate double-checks
  the security paths (HS256, redirect, cookie, revocation, SAML fail-closed).
- **[Open-redirect / session-deactivation pointer dangles]** → DL5 and SD1: do not
  compress until a durable home exists; the retained comments are the relocation-first
  rule in action, tracked as tasks, not silent gaps.
- **[Parallel session re-dirties auth mid-sweep]** → re-check `git status` on the
  folder immediately before the commit; a comment-only diff keeps any conflict
  trivial.
- **[Exemplar claim rots on a later PR]** → enforcement is review, not lint
  (`lint-max-strictness-standard` "Comment policy is enforced by review, not lint");
  standing PR review applies the policy to every later diff.

## Migration Plan

Comment-only. No deploy, no migration. The sweep is a single revert-in-isolation
commit. Rollback = revert that commit and this change directory. If D4 verdict is
(b), the `safe-redirect-validation` sync is a separate, independently-revertable
spec commit that MUST precede the compression.

## Open Questions

- **D4 open-redirect (blocking row DL5 only):** sync-then-compress
  (policy/brief-preferred) or keep-and-defer? Everything else in the tables can
  proceed on the per-row verdicts above regardless of this answer.
- **D6 viewer redirect (task 2.5):** align `DEV_LOGIN_REDIRECT_BY_ROLE.viewer` to
  `/reports/latest` per `viewer-report-navigation` in a follow-up `src` change, or
  document the intentional dev-login exception? Does not block this comment-only sweep.
