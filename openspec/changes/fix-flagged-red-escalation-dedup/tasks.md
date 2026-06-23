# Tasks — fix-flagged-red-escalation-dedup

## 1. Dedupe the flagged-red escalation in the builder

- [ ] 1.1 In `buildEscalationsFromReadSections`
      (`apps/api/src/modules/published-report-snapshot.ts`, ~lines 224-274),
      add a builder-wide `Set<string>` of seen `projectId`s, accumulated across
      the whole section loop.
- [ ] 1.2 Gate the project-level flagged-red push (the `section.projects` loop,
      ~lines 247-260) on that set: when a product first resolves red, push one
      escalation and record its `projectId`; on subsequent sections for the same
      red product, skip the push. Retain the first contributing lead's
      `leadName` on the surviving escalation (deterministic by loop order).
- [ ] 1.3 Leave the `blocked` item loop and the `unresolved_risk` risk loop
      untouched — they are genuinely per-record and must not be deduped.
- [ ] 1.4 Do NOT change `effectiveProjectStatus` or the dashboard mapper
      (`apps/web/src/lib/mappers/dashboard.ts`); the fix lives only in the
      builder so both the live and published paths get the single emission.

## 2. Regression test (required)

- [ ] 2.1 Add a unit test asserting on `buildEscalationsFromReadSections`
      output directly: build read-model sections where the same product is
      flagged red and co-owned by N (>= 2) leads, and assert exactly one
      `at_risk` flagged-red escalation is emitted for that product, carrying a
      non-empty `leadName`.
- [ ] 2.2 In the same test (or a sibling), include `blocked` items and
      unresolved risks across the sections and assert the `blocked` escalation
      count/content and `unresolved_risk` escalation count/content are
      unchanged by the dedupe (only the duplicate flagged-red rows collapse).
- [ ] 2.3 Assert the builder yields the SAME single flagged-red escalation per
      red product when called on inputs representing both the live path and the
      published-snapshot path (parity), so neither surface duplicates.

## 3. Gates

- [ ] 3.1 `pnpm typecheck && pnpm lint && pnpm test && openspec validate fix-flagged-red-escalation-dedup --strict`
      — all green.
