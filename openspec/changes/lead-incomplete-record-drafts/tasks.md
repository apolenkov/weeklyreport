# Durable incomplete records implementation plan — TASK-836

**Goal:** Save honest minimal risk/decision drafts without losing private text or contaminating reports.

**Architecture:** Existing rows plus nullable details; locked explicit-deletion reconciliation; complete-only projection plus scoped omission metadata; independent private recovery. **Stack:** repository TypeScript, shared schemas, Prisma/PostgreSQL, API and web. **Spec:** `specs/` and `design.md` in this change, coordinated with `../lead-week-grid-quick-entry/`.

Implementation has not started under this change. Boxes below describe future work, not checks performed by the specification author. Use test-first execution: add each named regression, observe failure on the current implementation, implement, rerun the owning suite and record exact command/result before handing off a commit-sized unit.

## Global constraints and ownership

Preserve lifecycle tuple, canonical middleware builders, stable identity/comments, existing complete-row behavior and all unrelated scenario bodies. No new retention, permissions, automatic carry or fabricated details. No preview/shared database mutation. Gate assigns one writer per file, resolving overlaps with TASK-836 receipt, comments and quick-entry packages before implementation.

Ownership prefixes below are exact repository roots. Colocated tests belong to the same owner. New file names are proposed and must not overwrite a concurrent file. Tasks within an owner run serially; cross-owner integration occurs after interface handoff, not by multiple writers editing a barrel/router.

| Owner                    | Exclusive write allocation                                                                                                                                                                                                       |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S: shared contracts      | `packages/shared/src/schemas/`, its public exports and tests; this includes search, analytics, omission and draft schemas                                                                                                        |
| D: persistence/migration | `prisma/schema.prisma`, selected migration and migration contract tests; `packages/report-persistence/src/` and tests                                                                                                            |
| A: section API           | `apps/api/src/modules/report-sections/`, plus `apps/api/src/infrastructure/trpc/routers/lead-form.router.ts` and `reports.router.ts`; owns recovery, Fill From and all own-read authorization wiring                             |
| R: review writes         | `apps/api/src/modules/review/` and its tests; gate integrates the sibling item-comment owner first, then assigns these files exclusively to R                                                                                    |
| P: publication           | `apps/api/src/modules/period/infrastructure/period.prisma-repository.ts`, `apps/api/src/modules/publication/infrastructure/publication.prisma-repository.ts`, their tests; shared lock owner only if a proven change is required |
| C: consumers             | `apps/api/src/modules/search/`, `analytics/`, `weekly-report/`, `carry-over/`, `pdf-export/` and their tests; owns snapshot freeze/index replacement in search                                                                   |
| W: web                   | `apps/web/src/features/report-sections/`, `report-pages/`, search/analytics/PDF clients and `apps/web/src/app/print/[reportId]/`; gate integrates current quick-entry/receipt owners first, then assigns these files to W        |
| G: integration           | `e2e/lead-form/` new incomplete-draft journey; this change's planning artifacts and TASK-836 evidence; no simultaneous source writer                                                                                             |

### Review focus

1. Automatic publication waiting on a save cannot retain a pre-lock RepeatableRead child snapshot (P tests).
2. Old-client replacement, fill-from and cancellation cannot erase an incomplete identity or its comments (A/W tests).
3. Subject-filtered and zero-hit disclosure cannot expose foreign count/existence (C tests).
4. P1 queued PDF and P2 republish cannot mix content/counts; restored legacy data stays unknown (C tests).
5. Noncurrent/archived own recovery remains reachable without provisioning or expanding entitlements; copied rows get new identity (A/W tests).
6. F1/F3: sole published decision witness survives P1/reopen/rejected degradation/P2/reopen/delete, including rebuilt projections and cold lineage cache; complete never-published rows remain deletable (A/C).
7. F2: incomplete Fill From sources are excluded independently of target protection; complete resolution/context semantics survive (A/W).
8. F4/F5: locked nonauthor reviewer create/delete rejection and current private-read entitlement on every named route, with demoted cached sessions and unchanged complete-history access (R/A/W).

## 1. Shared contracts and pure policy (S)

- [x] 1.1 In `packages/shared/src/schemas/report-sections/section-record.schema.ts`, `section.schema.ts` and `published-section-record.schema.ts`, separate nullable draft write/read from strict submit/published types; add shared completeness helpers. Verify null round-trip, each missing submit detail rejected, stored-text compatibility retained, unsafe/nonblank/invisible/overlong input denied, parent XOR, stages, explicit severity and dates unchanged in colocated schema tests. Export exact types before D/A/W start.
- [x] 1.2 Add `record-omission.schema.ts` beside section schemas with versioned subject/stage-set buckets, known/unknown summary and scope/union helpers described in design. Test known zero, missing legacy metadata, malformed present metadata, mixed unknown, zero authorized scope, Product/Activity separation and once-per-row multi-stage union. Document public versus internal bucket shapes in the owning file.
- [x] 1.3 Extend draft/submit inputs with `deletedIncompleteRecords` kind/stableId intents; add tests for empty legacy default, duplicate entries, conflicting include/delete and strict submit content. Add private retained-read input/output schema keyed by report and section, excluding mutation/reopen rights; verify no authorId authority in input. Coordinate response types with A before routing work.
- [ ] 1.4 Extend search response to `{hits, omissions}`, assistant coverage output, weekly/read snapshot metadata and analytics period/side disclosure. Keep legacy **snapshot** absence compatible, but reject stale **cache** response shapes. Test empty hits with notices, absent comparison side, unknown legacy and malformed metadata; update shared schema documentation and exports in the same commit.
- [x] 1.5 Ensure shared status/coverage/escalation inputs use complete risks only, including own form helpers. Test incomplete blocked risk floors nothing, becomes floor after completion, complete foreign attribution and all existing item progress/Activity exclusions remain. Do not alter severity precedence or workflow vocabulary.

## 2. Schema, migration and mapping (D; after S)

- [ ] 2.1 Update `prisma/schema.prisma` and a forward migration for the three nullable details and nullable frozen `PublishedSectionScope` omission totals. Keep parent/stage/severity, lineage indexes and generated search columns. Extend migration contract tests; prove existing complete rows unchanged and incomplete round-trip on a separately allocated guard-approved DB. Rebaseline only under the repository's verified preproduction policy, never automatically.
- [ ] 2.2 In `packages/report-persistence/src/report-sections.mappers.ts` and focused new projection helper, preserve nullable own reads but partition before all Product/Activity floors, referenced membership and aggregation. Verify mixed complete/incomplete rows, Activity, referenced-only Product, complete unsubmitted content and own incomplete visibility with colocated mapper tests. Provide a typed complete-projection seam to A/C.
- [ ] 2.3 In `packages/report-persistence/src/published-report-snapshot.ts`, freeze complete content and omission buckets from the same raw graph; published parsing remains strict with optional legacy metadata. Test all-section freeze, null rejection in frozen records, unknown legacy, no mutation of input and exact counts. Regenerate Prisma with `pnpm --filter @weeklyreport/api db:generate` after schema changes; record its result.

## 3. Section transaction, private read and recovery (A; after S/D)

- [ ] 3.1 Update `report-sections/domain/report-section-merge.ts`, `infrastructure/save-section.derive.ts`, `save-section.transaction.ts` and the repository/service contract to preserve nullable fields and explicit deletion intents end to end. Under existing locks/CAS, reject omitted persisted incomplete identities before clearing; strictly validate resulting submission. Test current/stale versions, old clients, include/delete collision, nonexisting/foreign identity, completion and published-lineage deletion denial. Verify rollback leaves version, children and comment identities unchanged.
- [ ] 3.2 Update every section collection replacement, including `infrastructure/fill-from.transaction.ts`, to apply the same omission guard; do not modify additive carry target semantics. Tests must include an omitted incomplete target row, invalid primary-text edit, and unrelated own/foreign/comment survival. Preserve existing fill-from source eligibility and published-lineage checks; document the shared guard's callers.
- [ ] 3.3 Add dedicated `application/retained-incomplete-records.service.ts` and `infrastructure/retained-incomplete-records.query.ts` with the shared report/section contract; wire canonical `leadProcedure` through A-owned router/module. Verify current active role plus exact author ownership, nonauthor Head/admin denial, no provisioning, no source writes and own access after assignment change. Add real authorized API integration tests, not only repository mocks.
- [ ] 3.4 Extend `infrastructure/report-sections.my-history-query.ts` with separate current-retained indicators and recovery discovery without changing frozen history facts. Test noncurrent open, archived unpublished, manually/automatically published, restore without live rows, reopen/republish, removed source and revoked entitlement. Keep frozen omission count distinct from retained count and label unavailable source honestly.
- [ ] 3.5 Apply complete projection before Head/admin byPeriod, co-owner and Everyone serialization in section read owners; scope omission metadata through existing group/shared-product lens. Verify no private text/IDs/comments, no unshared Activity count, and own nullable author form unchanged. Preserve existing canonical cross-author scenarios.
- [ ] 3.6 Extend service and locked transaction published-decision checks before CAS to reject complete-to-incomplete replacement with `PUBLISHED_RECORD_LOCKED` and field-linked Impact guidance. Test D published only in P1 → reopen → rejected impact clearing with unchanged version/comments → P2 retaining complete D → reopen → rejected deletion, including projection rebuild/cache reset. Pair complete never-published decision omission success with incomplete omission rejection and explicit-delete success; preserve item/risk lineage semantics.
- [ ] 3.7 In Fill From source derivation/transaction, exclude incomplete risks/decisions before copying and extend its router/input with the same optional target deletion intent. Test mixed sources, reassigned Product stages, removed Activity, complete resolved decision retaining resolvedAt, incomplete resolved decision excluded, fresh copied stableIds, source immutability, target incomplete rejection and explicit target deletion. Complete-source behavior remains unchanged; recovery-copy validation/reset rules do not silently replace Fill From semantics. Hand off entitled-source notice/link to W.
- [ ] 3.8 Enforce one current active canonical authoring-role plus exact section-author policy on recovery, reports.getActive/getActiveSection, reports.myHistory, leadForm.byPeriod, leadForm.statusOverview and retained Fill From notices. Pass authenticated actor identity to services; do not trust cached role/activeReportSectionId. Test each route with freshly hydrated demotion, cached pre-demotion session, inactive actor, stale foreign pointer, own source, nonauthor Head/admin and still-entitled author after stage reassignment. Mixed reads preserve otherwise authorized complete history and public omission notices but strip private draft IDs/text/comments/counts/links. Test server cache reuse and client-cache clearing; no blanket authoring-role gate on complete history.

## 3R. Reviewer command boundary (R; after S/A contracts)

- [ ] 3R.1 Extend `review-actions.comment-write.ts` and `review-actions.prisma-repository.ts` plus service prechecks to re-resolve current risk/decision completeness and section author under existing User → Report locks. Reject nonauthor creation and deletion on incomplete anchors using established inaccessible-record/comment not-found responses. No reviewer-owned delete exception. Preserve item-only Lead replies, complete-anchor permissions, verdicts and acknowledgements. Tests: save-first and comment-first interleavings, stale/known anchor, nonauthor Head/admin, reviewer-owned deletion, re-completion restoring normal behavior and exact comment IDs/authors/timestamps. Run guarded review integration tests; mocks are insufficient for lock ordering.

## 4–6. Publication, web authoring and rollout

- [ ] 4–6. Complete the packages in [tasks/01-publication-web-rollout.md](tasks/01-publication-web-rollout.md).

## Workflow follow-up

- Gate links this change and the sibling quick-entry change from TASK-836; this worker may not edit Backlog outside its ownership.
- Archive both changes only after acceptance, preserving unrelated canonical requirements and externally retained evidence. The old `lead-section-draft-payload` Purpose still describes filtering; gate must update that canonical Purpose when applying this delta because Purpose changes are not applied by OpenSpec delta archival and this worker does not own canonical files.
- Commits and delivery belong to separately authorized implementation work; this specification attempt performs no commit or push.
