# Seed at least one fully-green example product in the small tier

## Why

After `enrich-small-seed-cross-author`, the small/default demo tier has no
fully-healthy product: Маркетинговый портал reads blocked (Василий's own blocked
IdP risk on Development), Внутренний BI reads red (Игорь's blocked DevOps risk),
and Платформа интеграций reads at-risk (Василий's at-risk partner-API risk on
Development). A demo viewer therefore never sees what a clean, all-green product
looks like — every card carries a warning, so "green" has nothing to anchor it.

User feedback (live demo, 2026-06-18): make one product fully green, so the demo
shows the healthy end of the spectrum alongside the at-risk and blocked ones.

## What Changes

- Make **Платформа интеграций** fully green in `SMALL_DATASET`: drop Василий's
  at-risk risk on its Development stage. Its co-owners (Мария = Testing, Игорь =
  DevOps) already carry no risk on it, so with the at-risk risk gone the product
  health (worst of own + foreign stage severities) resolves to green.
- Keep the product's current/next items and decision so the card is non-empty —
  only the at-risk _risk_ (and the severity it floors) is removed.

## Out of scope

- The other two products: Portal stays blocked, BI stays red — they demonstrate
  the at-risk/blocked ends and the foreign-blocker-in-Mine health honesty.
- The `huge`/`middle` tiers — unchanged.
- Any rendering or query code — this is seed data only.

## Impact

- Affected specs: ADDED requirement under `demo-seed-datasets` (the small tier
  shows at least one fully-green product).
- Affected code: `prisma/seed-demo.ts` (`SMALL_DATASET`, the Платформа
  интеграций section for Василий). No schema change.
- Durable invariants preserved: the multi-stage item still lives on BI, the
  blocked item still lives on Portal (`demo-seed-datasets` "Small tier is
  minimal and stage-realistic" + "A blocked item demonstrates Needs Attention").
