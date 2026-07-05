# Mapping — api-mod-auth (2026-07-02)

Source catalog: `docs/architecture/catalog/api-mod-auth-2026-07-02.md` (7 files).

Grouping-rule application: `auth` is not in the invariant-bearing set called out in
TARGET-STRUCTURE-2026-07-02.md (`period`, `report-sections`/`review`, `publication`) and
it does not exceed the ~6-file flat-module threshold (determinism knob #2) on its own
internal split criteria — it has 6 files at module root already (2 of which are thin
router/controller pairs, not domain logic). So `modules/auth/` stays **flat**: no
`domain/application/infrastructure` subfolders. Every file's current location already
matches its canonical target — this catalog area requires zero moves.

| Current path                                      | Target path                                       | Layer      | Domain | Move? | Note                                                                                                                                               |
| ------------------------------------------------- | ------------------------------------------------- | ---------- | ------ | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| apps/api/src/modules/auth/auth.controller.ts      | apps/api/src/modules/auth/auth.controller.ts      | controller | auth   | no    | Flat thin module (rule: stays flat until invariant or >6 files — auth has neither); JWT sign/verify + cookie build stays module-root controller.   |
| apps/api/src/modules/auth/auth.routes.ts          | apps/api/src/modules/auth/auth.routes.ts          | router     | auth   | no    | Interface layer for a flat module has no separate `infrastructure/trpc` promotion — Express routes stay at module root (auth doesn't front tRPC).  |
| apps/api/src/modules/auth/dev-login.routes.ts     | apps/api/src/modules/auth/dev-login.routes.ts     | router     | auth   | no    | Dev-only router; same flat-module root, no reclassification (not gated behind a real invariant).                                                   |
| apps/api/src/modules/auth/roles.guard.ts          | apps/api/src/modules/auth/roles.guard.ts          | middleware | auth   | no    | Pure guard factory; would be `domain/` in an invariant-split module, but auth has no such split — stays at root.                                   |
| apps/api/src/modules/auth/saml.strategy.ts        | apps/api/src/modules/auth/saml.strategy.ts        | adapter    | auth   | no    | Imports `@node-saml/passport-saml` (rule 5: adapter, never `domain/`); flat module means no `infrastructure/` subfolder to promote it into either. |
| apps/api/src/modules/auth/session-deactivation.ts | apps/api/src/modules/auth/session-deactivation.ts | util       | auth   | no    | Touches PrismaService/SessionRevocationService (rule 5: adapter-shaped), but flat-module root is still its home — no split trigger.                |
| apps/api/src/modules/auth/user-session.ts         | apps/api/src/modules/auth/user-session.ts         | service    | auth   | no    | Core application service for the module; would be `application/` under a full split, but auth doesn't cross the split threshold.                   |

## Rows where Current != Target

None. 0 of 7 rows move.
