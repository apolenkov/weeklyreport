# Tasks

- [x] 1. In `prisma/seed-demo.ts` `SMALL_DATASET`, on Василий's Платформа
      интеграций section: remove the `risk` (the at-risk partner-API risk on
      Development). Keep `productLight: green`, the current/next items, and the
      decision.
- [x] 2. Confirm no dangling reference: the removed risk is not referenced by
      any item/decision stageNames or test fixture; co-owners (Мария/Игорь) carry
      no risk on Integrations, so foreign severity stays green.
- [x] 3. Reseed (`pnpm db:seed:small`) and verify Платформа интеграций reads
      green (no risk pill, no at-risk/blocked stage), while Portal stays
      blocked and BI stays red. Confirm determinism (reseed-diff identical).
- [x] 4. Confirm durable `demo-seed-datasets` invariants still hold: BI still
      carries the multi-stage `[Development, Testing]` item; Portal still carries
      the blocked item.
- [x] 5. Gates green (typecheck incl. `lint:prisma:typecheck`, lint, test).
