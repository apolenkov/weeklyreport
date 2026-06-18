# Enrich the small demo seed with cross-author co-ownership

## Why

In the small/default demo tier (`prisma/seed-demo.ts` `SMALL_DATASET`) the single
lead "Василий" owns every product and every stage, and no other author has
content. Two consequences a demo viewer hits immediately:

- The lead report's **Mine ↔ Everyone** visibility toggle shows no difference —
  "everyone" has nothing foreign to merge, so the control looks inert.
- The SDLC pipeline reads unrealistically: one person owns all seven stages of
  every product, so co-ownership and the "locked, owned by someone else"
  treatment are never exercised.

The merge machinery already works (the larger `seed-simple` tier proves it).
The gap is purely the small tier's data. The user asked (demo feedback
2026-06-18) to enrich the _current_ small seed — an addition, not a tier swap —
so the pipeline is believable and the toggle has a visible effect.

## What Changes

- Add a small supporting cast of co-owner leads to `SMALL_DATASET` (2–3 people
  besides Василий) and split stage ownership on Василий's products so that:
  - the **same colleague owns the same stage(s) across the three products**
    (consistent ownership, not random), and
  - on one product (the internal "eBay"-style project) **Василий owns exactly
    two stages** and the **Testing stage is left unowned** ("tester not hired
    yet"), so an unfilled role is visible.
- Seed each co-owner a minimal report-section contribution on the shared
  products (a current-week item, a risk or decision) so that switching the lead
  report to **Everyone** surfaces real foreign, read-only rows and foreign
  locked stage chips, while **Mine** stays Василий-only.
- Keep determinism: fixed UUIDs/dates, no `Date.now()`/random, idempotent under
  `prisma migrate reset` + reseed (per `seed-determinism`).

## Out of scope

- The `seed-simple` (middle) and `huge` tiers — unchanged.
- Any change to the merge/visibility _code_; this is data only. The Mine-mode
  stage-hiding behavior is a separate change
  (`lead-mine-hide-unowned-stages`).
- Adding new products beyond the existing three.

## Impact

- Affected specs: MODIFIED `demo-seed-datasets` (the small tier gains
  cross-author co-ownership + foreign content).
- Affected code: `prisma/seed-demo.ts` (`SMALL_DATASET` definition and its
  stage-assignment / section-content seeding). Possibly the shared lead-id
  constants. No schema change.
