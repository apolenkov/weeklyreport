# Code-style council verdict — 2026-07-13

Two independent assessors, same brief, blind to each other: the Fable advisor
seat and Codex (GPT-5.6). Both sampled real code across layers. Every claim
cited below was re-verified against source by the orchestrator before
inclusion.

## Consolidated grade

- Advisor: **A-** — function-level code and boundary mechanics are genuinely
  exemplary; the web type foundation and the honesty of a few "permanent"
  exemption labels are the gap.
- Codex: **B** — strong lint discipline, contracts, and concurrency testing,
  but central paths remain exemption-protected monoliths with porous
  boundaries and comment archaeology.
- Synthesis: **A- mechanics, B+ headline.** The ratchet, the boundary zones,
  the CAS/race integration tests, and the env no-fallback regime are
  reference-grade. The "repo others copy" claim holds everywhere EXCEPT three
  documented monolith seams (trpc.router, weekly-report-page, the record
  dialogs) and one ungated defect class (hand-maintained type duplicates).

## Agreed defects (both assessors independently)

1. `trpc.router.ts` inline Prisma (24 call sites) bypasses the module layer
   the hexagon zones protect; its "permanent" exemption comment concedes the
   real fix ("service-layer extraction"). Size is not the defect; inline
   persistence is.
2. Web slice grandfathering is pair-wide (any file → any file within an
   allowed pair), asymmetric with the api facade-barrel rule.
3. Comment/test archaeology survived the sweep in places the gate does not
   look: THROWN user-visible message `"…as of Phase 44 (UFB-036)…"`
   (`trpc.router.ts:1267` — strings, not comments), slug-prefixed router
   docstrings, `Phase 22`/driver-sweep labels in `weekly-report-page.test.tsx`.

## Advisor-only findings (verified)

- The web read model lives in `report-sections/model/mock-data.ts`
  ("fixture data, no logic" — no longer true; ~100 importers) and is
  hand-mirrored in `lead-form.ts:44-47`. This is the only defect class no
  gate can catch — silent divergence of duplicates.
- Repository ports typed `string` where `packages/shared` exports the exact
  union (e.g. `periodStatus`), losing compile-time exhaustiveness at the
  seams the modules exist to protect.
- Three record dialogs (item/risk/decision-edit) repeat the same
  label+textarea+error blocks; the repetition is why their max-lines +
  complexity exemptions exist.

## Codex-only findings (verified)

- `WeeklyReportPage` is an orchestration god-component (390-line main
  component; queries, 3 mutations, cache, routing, role logic, view-model,
  render in one file).
- `docs/exemplary-code-standard.md` is stale against reality: says "PREP /
  nothing enforced on main yet" while the config enforces most of it; admits
  fn≤50 and cognitive<10 are unenforced targets.
- Publication unit vs contract test suites duplicate scenarios; the
  integration race tests are the keepers.
- `report.schema.ts` response-`.default()`s are wire/backward-compat, not
  config fallbacks — NOT a violation (adjudicated: Codex's read wins over
  the advisor's concern; keep, watch).

## Prioritized plan (council-merged)

1. **[S/M] Kill the ungated duplicate class.** Extract the web read model to
   `report-sections/model/types.ts` (mock-data keeps fixtures), delete the
   lead-form mirror; type repository ports with the shared unions (the
   Zone-4b inventory in eslint.config.ts is the file list).
2. **[M] Record-dialog dedup.** One shared validated-field component +
   severity row in shared/ui; deletes 4-6 exemption entries. Strictly the
   repeated blocks — no Radix migration.
3. **[L, incremental] Drain the god-router.** Namespace-by-namespace: move
   inline Prisma into owning module services, end-shape = namespace factories
   with narrow dependency records composed in `createAppRouter`. Never a
   one-shot shell split.
4. **[L] Split WeeklyReportPage** into a controller hook (queries, mutations,
   view-model) + presentational shell, preserving the 1,474-line test suite
   as the safety net.
5. **[M] Bounded hygiene sweep + honesty pass.** String-archaeology (extend
   `find-archaeology.mjs` to string literals and test titles), JSDoc blocks
   over the 3-line budget in flagship services, publication test-suite
   consolidation, and update `exemplary-code-standard.md` to match what is
   actually enforced. Web boundary: require sibling-slice imports through a
   slice index barrel, then shrink `webSliceGrandfatheredExcept` pair-by-pair.

## Rejected (both assessors, do not reopen without new evidence)

- Mechanical 17-file split of trpc.router.ts that keeps RouterDeps + inline
  Prisma.
- Global `functional/immutable-data` / cyclomatic-10 ratchets over React and
  adapters.
- Migrating the hand-rolled dialogs to Radix/shadcn primitives.
- Resharding `report.schema.ts` or fixture catalogues for numeric purity.

## Deciding risk

The "permanent" exemption tail is a safe harbor: a green lint gate conceals
rising change-coupling in exactly the three files that accrete the most
features, while hand-maintained type duplicates drift with no gate at all.
Items 1-2 are small and close the ungated class; 3-4 are the honest end-state
for the two largest exemptions.
