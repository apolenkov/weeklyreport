# Design: demo-seed-datasets

## Structure (surgical — revised 2026-06-16)

The spec's normative contract is only "three independently-runnable tiers
(`small`/`middle`/`huge`, `small` default) + the small-tier behaviors + an
untouched `seed.ts`". It does NOT mandate a single writer. Folding the whole
2005-line `seed-simple.ts` into a data-driven `middle` was design prose, and on
inspection it is high-risk revert-bait: `seed-simple.ts` is the byte-stable
fixture the CI visual-regression job seeds, and `prisma/reset-hard.ts` (the
manual-UAT baseline + `db:reset:hard:docker`) hard-codes it. There is also no
`db:seed:simple` script to "retire" — it never existed (only `db:fresh:simple`).

So the surgical structure, confirmed with the user 2026-06-16:

- `prisma/seed-demo.ts` exposes `seedDemo(tier: "small" | "huge")` over ONE
  shared writer + per-tier plain-data datasets (products, leads, stage
  ownership, items, risks, decisions). Tier is read from `process.argv`.
- `middle` reuses the proven `seed-simple.ts` AS-IS via delegation
  (`db:seed:middle` → `tsx prisma/seed-simple.ts`). This keeps the visual
  baseline + reset-hard untouched and avoids a behavior-preserving refactor.
- `package.json`: add `db:seed:small|middle|huge`. `small` is the demo default.
- `prisma/reset-hard.ts` is NOT changed (still seeds via `seed-simple.ts`).
- `seed.ts` (canonical test fixture) and `prisma.config.ts`'s `migrations.seed`
  pointer are untouched.

## Canonical-ID reuse (load-bearing)

The dev session context (`apps/api/src/infrastructure/trpc/trpc.context.ts`) and
the demo URL pin specific IDs from `seed-constants.ts`: `HEAD_USER_ID`, the lead
IDs, `ACTIVE_REPORT_ID`, `DEFAULT_REPORTING_GROUP_ID`, the stage IDs. Every tier
MUST seed those exact rows or dev-login and `/head/report/<ACTIVE_REPORT_ID>`
break. New small-tier-only rows use fresh UUIDs outside the existing ranges.

## Small-tier composition (concrete)

3 products, 2–3 leads, explicit `(lead × product × stage)` ownership:

- Product A → lead Василий И., stage Development (single stage).
- Product B → lead Мария К., stage Design (single stage).
- Product C → lead Игорь В., stages Development + Testing (one item spans both).

Each owning lead authors one `ReportSection` for the active period with: a
`StageStatus` per owned stage, current-week items (one per owned stage), one
risk, one decision. One product's section carries a BLOCKED item; the
"Needs Attention" banner derives from it (`buildEscalationsFromReadSections`),
which is how the demo shows the banner. The banner cannot be seeded as its own
text — its de-duplication against the blocked item lives in `report-card-clarity`.

## Ownership modeling

There is no first-class `(lead × product × stage)` ownership entity; ownership is
implied by which lead's `ReportSection` writes the `StageStatus` / items for a
`(product, stage)`. The small tier models clean ownership by having exactly one
lead author each `(product, stage)` it owns — no overlapping authors on the same
product — which is what makes the by-lead slice and the card partition read
cleanly.

## Determinism

Identifiers and text are literal constants. Only period dates are week-relative
(reuse the existing `seed-constants.ts` date helpers) so the active period covers
the current week. This keeps `seed-determinism` satisfied for IDs/content while
avoiding the "active period drifted into the past" failure.

## Out of scope

- No schema migration (`stageNames` stays `String[]`).
- The card-rendering fixes (chip semantics, needs-attention dedup guard, by-lead
  slice) live in `report-card-clarity`; this change only supplies clean data.
