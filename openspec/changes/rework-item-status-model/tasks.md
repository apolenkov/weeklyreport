# Tasks: rework-item-status-model

## 1. Schema + shared

- [ ] 1.1 `prisma/schema.prisma`: `ItemWorkflowStatus` → `planned | in_progress | paused | postponed | done`; drop `Item.completed`; hand-edit the init migration with a CHECK constraint on (type, workflowStatus); `migrate reset` per DB; regenerate client (and the hand-written `PrismaReportSectionWithRelations` if it names the column).
- [ ] 1.2 `packages/shared`: item schemas take the new enum + per-type Zod refinement (current ∈ {in_progress, paused, done}; next ∈ {planned, postponed}); contract tests via `pnpm --filter @customreport/shared test`.
- [ ] 1.3 Seeds: seed-demo small carries every status exemplar, type-correct (paused on a CURRENT item, postponed on a NEXT item; planned/in_progress/done + blocker-risk item); stored `blocked`/`completed` usages rewritten; seed-simple + seed.ts swept for the removed column/value.

## 2. API

- [ ] 2.1 Sweep `workflowStatus`/`completed` consumers (repositories, rollups, readiness, analytics, carry-over): explicit arms, paused/postponed = not-done + non-escalating; unit tests per derivation.
- [ ] 2.2 Carry-over: `cloneCarriedItem` (`carry-over-clones.ts`) remaps status on the type flip — `planned` → `in_progress`; the carry filter swaps `completed !== true` for `workflowStatus !== 'done'` and excludes `postponed`; contract test.

## 3. Web

- [ ] 3.1 `item-status.ts` projection collapses to the enum read; `item-alarm.ts` (`AlarmItem.status` + eligibility) and `activity-buckets.ts` (deferred/planned-next split → enum read) get explicit arms; kanban dual `ReportItem` types sync; mapper tests first.
- [ ] 3.2 Item edit dialog: per-type chips (current → In Progress | Paused | Completed; next → Planned | Postponed); remove `MarkBlockedRow`; covered-status lock untouched; jsdom dialog tests.
- [ ] 3.3 Card renderers + weekly-report mappers: explicit mapping per render site.
- [ ] 3.4 Slides: `GridTone`/`buildOwnItemRow` map the new statuses explicitly (no silent default to neutral); paused ‖ / postponed » glyphs + sr-only labels in `slide-article-rows.tsx`; deck tests.
- [ ] 3.5 PDF export template arms (grayscale-safe glyph shapes).

## 4. Docs + verification

- [ ] 4.1 CONTEXT.md glossary: Progress vs Alarm, Planned/Paused/Postponed entries (done during the grill — verify still accurate at land time).
- [ ] 4.2 Full unit suites (shared + api + web), `pnpm typecheck`, repo lint, `pnpm test:integration`.
- [ ] 4.3 Live-verify on :3000 after reseed: dialog vocabularies per type, covered lock, all five statuses on form/card/slide/published; dashboard shows no escalation from paused/postponed.
