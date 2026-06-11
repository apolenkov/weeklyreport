# Tasks

> Status: IN PROGRESS — implementation started 2026-06-11 (overnight run).

## 1. Resolve the design open questions (no code yet)

- [x] 1.1 Read `mapLeadProducts` (`apps/web/src/lib/mappers/lead-form.ts:386-407`)
      and the product-card render; decide whether a referenced-but-not-owned
      project, if added to `section.projects`, would leak a stray product
      card or empty SDLC stage grid. Record the answer in design.md Open
      Question 1. — ANSWER: yes, leaks (card + `saveSection` ProjectStatus
      writes + `validateSubmitInput` submit block); see design.md OQ1.
- [x] 1.2 Decide whether a referenced-only _archived_ project resolves its
      name or stays a placeholder (design.md Open Question 2); confirm with
      the user. — Took the design lean: resolve. Non-interactive run; left
      for user confirmation at acceptance (5.4).
- [x] 1.3 Confirm Option C (widen the read-model name source) over A/B with
      the user, or pivot per their call; if the answer to 1.1 is "leaks a
      card", switch to a name-only `Map` passed to the four mappers.
      — Option C kept, name-only shape per 1.1; names ride the existing
      Prisma `project` relation (no second query). User sign-off at 5.4.

## 2. Reproduce the bug first (seed + failing test)

- [x] 2.1 Add a seed fixture that exercises the miss: a risk (and a
      decision) on a project the section author owns no `StageAssignment`
      on, so the project is absent from `section.projects`
      (`prisma/seed-simple.ts`). Today no seed row reproduces it — boris
      owns a stage on every project he references
      (`seed-simple.ts:708-713,753-758`). — Boris (section 407) now carries
      a risk + decision on PROD_PAYMENTS («Платёжный шлюз»), a project he
      owns no stage on.
- [x] 2.2 Write a mapper regression test that fails before the fix: a
      cross-stage risk/decision/item/priority renders "Unknown"/"Group"
      against a section whose `projects` omits the referenced id.
      — `lead-form.test.ts` "report-wide name resolution"; verified red
      (Unknown/Group) before the `buildProjectIndex` fix, green after.

## 3. API read model (only if Option C / A is chosen)

- [x] 3.1 In `report-sections.prisma-repository.ts`, collect the distinct
      `projectId`s referenced by the section's items, risks, and decisions
      (`:205-235`) that are absent from the stage-owned set built at
      `:153-164`.
- [x] 3.2 Batch-load their names via `project.findMany({ where: { id: { in } } })`
      and feed them into the name source the mappers read; stage-owned
      entries win on conflict (design Decision 3). Skip the query when the
      referenced set is empty. — Refined: instead of a second `findMany`,
      names ride the rows' existing Prisma `project` relation inside
      `reportSectionFullInclude` (zero extra queries; the pure mapper stays
      sync). Same server-owned outcome; recorded in design.md OQ1.
- [x] 3.3 If a name-only `Map` is the chosen shape (Open Question 1 = leaks
      a card), update `packages/shared` section schema to carry it and
      Zod-parse at the boundary; otherwise leave the schema unchanged.
      — `referencedProjects` (optional array of `{projectId, projectName}`)
      on `reportSectionReadModelSchema`; parsed at the existing
      `mapPrismaToReportSection` boundary. Unit-tested
      (`report-sections.prisma-repository.test.ts`, 5 tests incl. archived
      posture).

## 4. Web mappers

- [x] 4.1 Switch `mapLeadRisks` (`:466`), `mapLeadDecisions` (`:486`),
      `mapLeadItems` (`:433`), and `mapLeadPriorities` (`:513`) to resolve
      from the widened name source. — One change in their shared
      `buildProjectIndex`: referenced entries seeded first, stage-owned
      overwrite (Decision 3).
- [x] 4.2 Keep `"Unknown"` / `"Group"` / empty as the genuine-miss fallback
      only (design Decision 2). Remove no placeholder. — Placeholders
      untouched; pinned by the "truly foreign id" test.
- [x] 4.3 Confirm `mapLeadProducts` and the product list are unchanged
      (spec scenario "name resolution does not add a stray product card").
      — Pinned by the "does not add a stray product card" test.

## 5. Gates, live screenshots, user acceptance

- [x] 5.1 Run `pnpm typecheck && pnpm lint && pnpm test && pnpm build`;
      paste the pass/fail result. — All four PASS (2026-06-11): typecheck
      5/5 tasks; ESLint no issues; tests 107 files / 964 web + api + shared
      all green; build 5/5 tasks.
- [x] 5.2 Reseed the dev DB (`pnpm db:wipe:manual-uat` or
      `prisma migrate reset` per repo rules) so the new fixture is present.
      — `pnpm db:fresh:simple` against `customreport_dev`; seed reports
      risks:8 decisions:19 incl. the new cross-stage pair.
- [x] 5.3 Live screenshots on `/lead/report`: the seeded cross-stage
      risk/decision/item card now names its product (no "Unknown"/"Group");
      attach before/after. — "After" verified live as boris: risk and
      decision cards show «Платёжный шлюз»; Product Status unchanged at
      3 assigned products (no stray card). Screenshots:
      `/tmp/fix-lead-surface-name-resolution/`. "Before" exists as the
      recorded red run of the regression tests (Unknown/Group), not as a
      screenshot — the pre-fix code + fixture combination was never
      deployed together.
- [ ] 5.4 User acceptance: confirm the resolved names and the Open-Question
      decisions (1.1, 1.2) match intent before archiving. — PENDING USER
      (overnight run): confirm (a) name-only `referencedProjects` shape,
      (b) archived referenced-only projects resolve their name.
