# Proposal: demo-seed-datasets

## Why

The live demo needs realistic, scannable data at a scale a presenter controls.
The current demo seed (`seed-simple.ts`, 6 products) is too dense to read on a
single product card, and there is no smaller "show one product, one stage,
one person" fixture to open a demo with. The presenter wants three tiers —
**small**, **middle**, **huge** — and will open with **small** while walking the
different roles.

The seed also drives a report-card defect: the "Needs Attention" banner is
DERIVED from blocked items (`buildEscalationsFromReadSections`), so it structurally
repeats the blocked item it came from. The seed's job is only to provide one
blocked item to demonstrate the banner; the de-duplication itself is owned by
`report-card-clarity`. The seed also models `(lead × product × stage)` ownership
cleanly so a product card does not mix authors.

## What Changes

- Add a **parametrized demo seed** selectable by tier: `pnpm db:seed:small`,
  `db:seed:middle`, `db:seed:huge`. **small** is the demo default.
- **small** = 2 products with a single SDLC stage each + 1 product carrying two
  stages (Development + Testing), to show that an item may span more than one
  stage. 2–3 canonical leads, modeled with explicit `(lead × product × stage)`
  ownership.
- **middle** absorbs today's `seed-simple.ts` content (≈6 products); **huge** is
  the dense many-product fixture for stress/scroll demos.
- **Seed one blocked item** so the derived "Needs Attention" banner has content
  to demonstrate (escalations are computed, not seedable; dedup is in
  `report-card-clarity`).
- Preserve determinism (fixed UUIDs/content) and the canonical IDs the dev
  session and routes depend on (head, leads, `ACTIVE_REPORT_ID`).
- Leave `seed.ts` (the canonical test fixture, 30+ E2E assertions) **untouched**.

## Capabilities

- `demo-seed-datasets` (new) — the tiered demo-seed contract.

## Impact

- `prisma/seed-simple.ts` → folded into the tiered demo seed (becomes `middle`).
- New seed module + `package.json` scripts (`db:seed:small|middle|huge`).
- `prisma/seed-constants.ts` — canonical IDs/names reused; small-tier ownership
  table added.
- No schema change (`Item.stageNames` stays `String[]`).
- `seed.ts` and the E2E fixture surface are unaffected.
- Downstream: gives `report-card-clarity` a realistic, partition-clean dataset to
  design and verify against.
