# Tasks — small seed three colors

## 1. Reshape the green BI product

- [x] 1.1 BI stages: Vasily Planning+Development, added a Maria section owning
      Analysis/Design/Testing, Igor DevOps — all on-track; Support left unowned.
- [x] 1.2 Removed BI's blocked DevOps risk (Igor's BI section is now on-track).
- [x] 1.3 BI stays non-empty (Vasily current+next items + decision; co-owner items).

## 2. Integrations → yellow

- [x] 2.1 Added an at-risk risk on Vasily's Development stage, no blocked stage;
      `productLight` → yellow. Resolves at-risk (yellow).

## 3. Portal → red with the relocated blocker

- [x] 3.1 Igor's Portal DevOps section now carries the blocked item + blocked risk
      (`productLight` red) — a foreign-owned blocked stage. Vasily's own Development
      blocker stays for the Needs Attention demo. Relocation, no net-new risk.

## 4. Determinism & gates

- [x] 4.1 Fixed ids/authors/stage assignments preserved; no random/wall-clock drift.
- [~] 4.2 No unit test imports seed-demo or asserts the small-seed colors (admin
  tests only use product names as fixtures) — nothing to update.
- [x] 4.3 `pnpm lint:prisma:typecheck` clean. Applier verified statically:
      first owned stage = `productLight`, risk floors its stage → the three colors
      resolve as intended (BI green, Integrations yellow, Portal red).
- [~] 4.4 Reseed + live-verify (Portal red / Integrations yellow / BI green + vacant
  Support) — DEFERRED to the live visual pass with the dialog layout + Radix swap.
