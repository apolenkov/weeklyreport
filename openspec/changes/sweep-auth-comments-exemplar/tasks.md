# Tasks

## 1. Preconditions (verify before any edit)

- [x] 1.1 Policy owner-confirmed 2026-07-02 (3-line budget + relocation-first rule),
      locked durably in `lint-max-strictness-standard`.
- [x] 1.2 `apps/api/src/modules/auth` clean in `git status` (no parallel-session
      edits in flight on the seven source files).
- [x] 1.3 `refactor-auth-exemplary-layering` is archived (2026-06-29) → the HS256
      coordination note and the `user-session.ts` change-name prefix are archaeology;
      the layering substance is durable in `jwt-session-integrity` / `auth-module-layering`.
- [x] 1.4 `fix-open-redirect-next-param` is archived (2026-07-02) → its D6 ordering
      (change-archived) is satisfied.
- [x] 1.5 `fix-open-redirect-next-param` D6 SECOND condition CHECKED and FAILING:
      `safe-redirect-validation` was NOT synced to `openspec/specs/` (no such dir;
      `openspec spec list` shows none; `grep -r same-origin\|WHATWG openspec/specs/`
      → only unrelated hits). The open-redirect pointer would dangle → row DL5 is
      blocked pending the owner decision in 2.4.
- [x] 1.6 All seven source files inventoried and their comment line numbers in
      `design.md`'s tables re-verified against the current working tree (2026-07-05);
      `roles.guard.ts` confirmed clean (zero comments).

## 2. Owner veto (fill design.md "Your verdict" before the sweep)

> Rows AC1, DL4, and DL5 are the concrete instances behind the durable spec's
> scenarios (over-budget-homed → pointer; live-divergence guard; no-durable-home
> retain). The scenarios are written state-conditionally and name no row, so a
> per-row veto does NOT contradict the spec — but a veto that changes the POLICY
> CLASS (e.g. refusing the relocation-first carve-out itself) requires amending the
> delta spec first.

- [ ] 2.1 Owner fills every "Your verdict" cell in `design.md` (rows AC1-AC4,
      DL1-DL11, AR1-AR11, US1-US12, SS1-SS7, SD1-SD2).
- [ ] 2.2 Owner confirms the highest-substance relocations: AC1 (HS256 compress +
      coordination-note delete → `jwt-session-integrity`), DL1/DL9 and US1/US2
      (relocation to `auth-module-layering`).
- [ ] 2.3 Owner confirms DL4 keep+correct (web-sync live-divergence guard, file ref
      → `login-page-roles.ts`).
- [ ] 2.4 **DL5 open-redirect decision:** owner picks (a) keep-and-defer or
      (b) sync-then-compress (policy/brief-preferred). If (b), do 3.0 first.
- [ ] 2.5 **D6 viewer-redirect decision (does NOT block this sweep — src follow-up):**
      owner picks (a) align `DEV_LOGIN_REDIRECT_BY_ROLE.viewer` to `/reports/latest`
      per `viewer-report-navigation` in a separate `src` change, or (b) document the
      intentional dev-login exception. DL4's guard comment stays either way.
- [ ] 2.6 Owner confirms SD1 retain (session-deactivation two-tier rationale — no
      durable home yet, relocation-first, same class as DL5).

## 3. Sweep (single comment-only commit, zero behavior change)

- [ ] 3.0 IF DL5 verdict = (b): `openspec sync-specs` the `safe-redirect-validation`
      delta from `fix-open-redirect-next-param` into `openspec/specs/`, attributed to
      that change, as a SEPARATE spec commit that precedes 3.2. IF (a): skip; the
      open-redirect comment stays verbatim and 3.2 leaves `dev-login.routes.ts:67-74`
      untouched.
- [ ] 3.1 `auth.controller.ts`: apply AC1 (compress + delete coordination note),
      AC2 (delete narration), keep AC3; leave AC4 to the magic-literal ratchet.
- [ ] 3.2 `dev-login.routes.ts`: apply DL1, DL2, DL3, DL7, DL8, DL9, DL10; keep DL6;
      keep+correct DL4; leave DL11 to the size rule; DL5 per the 2.4 verdict.
- [ ] 3.3 `auth.routes.ts`: DELETE AR1, AR2, AR4; strip archaeology prefixes on
      AR3, AR5, AR6 (keep the WHY); keep AR7-AR11.
- [ ] 3.4 `user-session.ts`: strip the change-name prefix on US1 and the ticket/phase
      prefix on US12; compress US2, US3, US5, US9; keep US4, US6-US8, US10, US11.
- [ ] 3.5 `saml.strategy.ts`: strip ticket/phase archaeology on SS3, SS4, SS6 (keep
      the WHY); dedup SS7 with SS6; keep SS1, SS2, SS5.
- [ ] 3.6 `session-deactivation.ts`: RETAIN SD1 verbatim (relocation-first, tracked);
      compress SD2 ≤3 lines.
- [ ] 3.7 `roles.guard.ts`: no action (confirmed clean).
- [ ] 3.8 Confirm the diff is comment-only: `git diff` shows no change to any
      identifier, string literal, control flow, export, or signature.
- [ ] 3.9 Re-check `git status` on the folder immediately before commit (guard
      against a parallel session re-dirtying it).

## 4. Gates & acceptance

- [ ] 4.1 `pnpm typecheck && pnpm lint && pnpm test` green (a comment-only diff
      must not move any gate).
- [ ] 4.2 **Security-review pass** on the comment diff (mandated by
      `lint-max-strictness-standard` — "Comment sweeps over security-sensitive paths
      pass security review"): confirm no compressed comment dropped an unspecced
      protective rationale across ALL security-sensitive files — HS256/cookie
      (`auth.controller.ts`), audit/logout (`auth.routes.ts`), SAML fail-closed
      (`saml.strategy.ts`), session revocation (`session-deactivation.ts`), redirect
      (`dev-login.routes.ts`). A finding blocks merge until relocation completes.
- [ ] 4.3 Comment-policy review pass confirms the folder is exemplar-clean under the
      retained-comment carve-out (DL5 open-redirect if verdict = (a); SD1 always).
- [ ] 4.4 `openspec validate sweep-auth-comments-exemplar --strict` passes.
