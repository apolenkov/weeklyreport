# Tasks

> Status: NOT STARTED — captured 2026-06-10. Capture-only OpenSpec change;
> no implementation has begun.

## 1. Resolve the design open questions (no code yet)

- [ ] 1.1 Read `mapLeadProducts` (`apps/web/src/lib/mappers/lead-form.ts:386-407`)
      and the product-card render; decide whether a referenced-but-not-owned
      project, if added to `section.projects`, would leak a stray product
      card or empty SDLC stage grid. Record the answer in design.md Open
      Question 1.
- [ ] 1.2 Decide whether a referenced-only _archived_ project resolves its
      name or stays a placeholder (design.md Open Question 2); confirm with
      the user.
- [ ] 1.3 Confirm Option C (widen the read-model name source) over A/B with
      the user, or pivot per their call; if the answer to 1.1 is "leaks a
      card", switch to a name-only `Map` passed to the four mappers.

## 2. Reproduce the bug first (seed + failing test)

- [ ] 2.1 Add a seed fixture that exercises the miss: a risk (and a
      decision) on a project the section author owns no `StageAssignment`
      on, so the project is absent from `section.projects`
      (`prisma/seed-simple.ts`). Today no seed row reproduces it — boris
      owns a stage on every project he references
      (`seed-simple.ts:708-713,753-758`).
- [ ] 2.2 Write a mapper regression test that fails before the fix: a
      cross-stage risk/decision/item/priority renders "Unknown"/"Group"
      against a section whose `projects` omits the referenced id.

## 3. API read model (only if Option C / A is chosen)

- [ ] 3.1 In `report-sections.prisma-repository.ts`, collect the distinct
      `projectId`s referenced by the section's items, risks, and decisions
      (`:205-235`) that are absent from the stage-owned set built at
      `:153-164`.
- [ ] 3.2 Batch-load their names via `project.findMany({ where: { id: { in } } })`
      and feed them into the name source the mappers read; stage-owned
      entries win on conflict (design Decision 3). Skip the query when the
      referenced set is empty.
- [ ] 3.3 If a name-only `Map` is the chosen shape (Open Question 1 = leaks
      a card), update `packages/shared` section schema to carry it and
      Zod-parse at the boundary; otherwise leave the schema unchanged.

## 4. Web mappers

- [ ] 4.1 Switch `mapLeadRisks` (`:466`), `mapLeadDecisions` (`:486`),
      `mapLeadItems` (`:433`), and `mapLeadPriorities` (`:513`) to resolve
      from the widened name source.
- [ ] 4.2 Keep `"Unknown"` / `"Group"` / empty as the genuine-miss fallback
      only (design Decision 2). Remove no placeholder.
- [ ] 4.3 Confirm `mapLeadProducts` and the product list are unchanged
      (spec scenario "name resolution does not add a stray product card").

## 5. Gates, live screenshots, user acceptance

- [ ] 5.1 Run `pnpm typecheck && pnpm lint && pnpm test && pnpm build`;
      paste the pass/fail result.
- [ ] 5.2 Reseed the dev DB (`pnpm db:wipe:manual-uat` or
      `prisma migrate reset` per repo rules) so the new fixture is present.
- [ ] 5.3 Live screenshots on `/lead/report`: the seeded cross-stage
      risk/decision/item card now names its product (no "Unknown"/"Group");
      attach before/after.
- [ ] 5.4 User acceptance: confirm the resolved names and the Open-Question
      decisions (1.1, 1.2) match intent before archiving.
