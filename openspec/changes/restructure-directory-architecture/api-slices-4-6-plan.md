# API restructure — slices 4-6 implementation plan (council-vetted 2026-07-06)

> Source: multi-agent design workflow (recon 6/6 + synthesizer over primary sources,
> advisor stress-test). 2 design lenses stalled + the Codex slot returned empty, so
> the synthesis is primary-source-grounded rather than a 3-way merge. Governs
> restructure-directory-architecture tasks 4.1 / 5.1 / 6.1.

## Summary

Consolidated api slices 4-6 plan, built from primary sources (design.md, TARGET-STRUCTURE-2026-07-02, and verified reads of the actual transaction/guard code) — the forwarded Codex plan was an empty forwarding stub (scored 1/10) and contributed nothing. Central finding: the "withTransaction/UnitOfWork seam" design.md asks to design before slice 6 ALREADY EXISTS in the codebase as a repeatable pattern — a pure function taking a structurally-typed minimal Prisma slice (not Prisma.TransactionClient, not a facade method). publishCompareAndSet (src/lib/publish-compare-and-set.ts, param PublishCasClient = Pick<PrismaClient["report"],"updateMany"|"findUnique">) and applyRevokeTransition (report-sections/revoke-transition.ts, param Pick<Prisma.TransactionClient,"reportSection">) are the two live instances. No new UnitOfWork abstraction is warranted for this MVP — introducing one would be exactly the over-engineering the scorer flagged. Both invariant guards exist and are load-bearing: infrastructure/trpc/**tests**/role-coverage.test.ts (invariant 2, runtime middleware-chain identity walk over 9 base procedures) and modules/period/**tests**/lifecycle-write-gate.test.ts (invariant 1, static AST scan for hand-assembled Report lifecycle writes). The single most likely thing to turn slice 4 red is the lifecycle-write-gate's hardcoded EXEMPT_SUFFIXES + relative SRC_ROOT — both must be handled in lockstep with any file move.

## Slice 4 — internal hexagon (period, report-sections, review, publication)

SLICE 4 — complete the internal hexagon in {period, report-sections, review, publication}; internal-only, zero cross-module rewiring, behavior-neutral.

Per module, lift files into domain/ (pure, framework-free) + application/ (service + port interface it owns) + infrastructure/ (prisma-repository, schedulers), inject the repository by Symbol token in \*.module.ts (mirror the existing factory-provide style in publication.module.ts / weekly-report.module.ts to keep DI parameter-decorator-free — see the PrismaModule TS1206 note).

- period (already closest to target): domain/ ← period-transition.ts, period-factory.ts, period-transition.apply.ts is the applicator that takes the caller's tx (keep it callable by publishPeriod's in-tx path). application/ ← period.service.ts + PeriodRepository port. infrastructure/ ← period.prisma-repository.ts, the three schedulers. Reuse period.contract.test.ts as the port-contract suite.
- report-sections: domain/ ← report-section-merge.ts, published-record-guard.ts, published-lineage.ts, revoke-transition.ts (stays IN report-sections this slice; its cross-module reroute is slice 6). application/ ← lead-form.service.ts, report-sections.service.ts + LeadFormRepository/ReportSectionsRepository ports. infrastructure/ ← the two prisma-repositories. Reuse report-sections.contract.test.ts / lead-form.contract.test.ts.
- review: NEW split this slice — introduce ReviewActionsRepository/ReviewRepository ports (interfaces already declared inline in review-actions.service.ts) + a contract suite it lacks. domain/ ← review-authz.ts (pure). application/ ← review.service.ts, review-actions.service.ts. infrastructure/ ← review.prisma-repository.ts, review-actions.prisma-repository.ts.
- publication: NEW split — introduce PublicationRepository port + contract suite. application/ ← publication.service.ts. infrastructure/ ← publication.prisma-repository.ts. Leave publishCompareAndSet in src/lib.

CRITICAL COUPLING (must be same commit as the move): modules/period/**tests**/lifecycle-write-gate.test.ts hardcodes EXEMPT_SUFFIXES = [join("modules","period","period-transition.ts"), join("modules","period","period-transition.apply.ts")]. If those two files move into period/domain|infrastructure, update EXEMPT_SUFFIXES to the new suffixes in the SAME commit or the transition module flags itself → red. Do NOT relocate the gate test file itself: its SRC_ROOT = resolve(**dirname,"../../../") anchors on modules/period/**tests**/; moving it breaks the anchor. Keep both guard tests (this one and trpc/**tests\_\_/role-coverage.test.ts) in place.

Gate: full unit suite + both guard tests. Because port reshaping touches the transaction sites, also run at slice-4 close the integration tests whose subject files moved: period.publish-atomicity.integration.test.ts, review-actions.integration.test.ts, publication.integration.test.ts.

## Slice 5 — infra ports (Email/Queue/Cache)

SLICE 5 — wrap infrastructure/ as ports (EmailPort over infrastructure/email, QueuePort over infrastructure/bullmq, CachePort over redis); bind port→adapter at each consuming module's boundary via Symbol token. Ports are DEFINED BY THEIR CONSUMERS (reminders, pdf-export, analytics services own the interface) and IMPLEMENTED by thin adapters over the existing infrastructure/email and infrastructure/bullmq — do not move the infra dirs.

Scope guard: this slice touches NONE of the three invariant-bearing transaction paths (period dual-state, publish CAS, section un-submit are all DB-only, no email/queue/cache in the atomic write). So invariants 1/3 are untouched by construction; invariant 2 untouched (no trpc/ change).

Payoff and its own proof: reminders/analytics/pdf-export become unit-testable with in-memory fakes — add at least one in-memory-fake unit test per new port to demonstrate the seam (that IS the deliverable's verification). period.service.ts already models the pattern with AnalyticsCacheInvalidator/ReopenPolicyReader/IngestionPublishHook lambdas — extend that lambda-port style rather than inventing a new abstraction.

Gate: unit suite only (in-memory fakes are the whole point — no live broker/DB needed). test:integration NOT required here.

## Slice 6 — cross-module facades + tx-seam + zone flip

SLICE 6 — reroute cross-module deep imports to facade barrels + flip the import-x/no-restricted-paths cross-module zone allowlist→error. Highest risk. The tx-seam is designed BEFORE this slice (below), and it is NOT a new UnitOfWork.

THE SEAM (concrete): the only cross-module deep imports carrying logic/tx that slice 6 must reroute (verified by grep, non-test):

1.  review/infrastructure/review-actions.prisma-repository.ts → ../report-sections/revoke-transition.js (THE CRUX: passes review's own tx into a report-sections-owned write)
2.  publication/infrastructure/publication.prisma-repository.ts → ../period/period-transition.js (imports buildTransition, PURE)
3.  period/infrastructure/period.prisma-repository.ts → ../weekly-report/weekly-report.prisma-repository.js (repo→repo resolver delegation) and → ../admin/admin-shared.js
4.  modules/published-report-snapshot.ts (module-root shared helper) → report-sections mappers (reportSectionFullInclude, mapPrismaToReportSection, deriveEffectiveProductStatus); consumed by publication.
    (The many period.module.ts → ../X/_.module.js|_.service.js imports are Nest DI wiring — reroute them to the sibling index.ts barrel; mechanical, no tx.)

Placement rule (determinism knob, settles every case identically): a single-domain-owned pure/tx-composing function → re-export from that domain's index.ts barrel; an owner-less shared write → src/lib.

- applyRevokeTransition: report-sections owns the submitted→draft transition (review only triggers it) → re-export from report-sections/index.ts. review imports it from "../report-sections" (barrel), calls it with review's own tx. Parity with buildTransition.
- buildTransition: period owns the lifecycle field set (publication only triggers it) → re-export from period/index.ts. publication imports from "../period" (barrel).
- published-report-snapshot.ts helpers: report-sections owns the section read-model mappers → re-export the needed helpers from report-sections/index.ts (or move the shared snapshot builder there). Second instance of the same rule.
- publishCompareAndSet: "publish" has no single owner (period + publication both publish) → already correctly in src/lib, unchanged.

WHY THIS DOES NOT LEAK Prisma.TransactionClient across a module boundary (the discriminator the scorer will re-check): the ONLY place module A hands its own tx to a function owned by module B is review.postVerdict → applyRevokeTransition. That is not a facade-method leak because (a) it is a PURE FUNCTION, not a service method with module-owned state; (b) the crossing type is Pick<Prisma.TransactionClient,"reportSection"> — a STRUCTURAL slice sourced from @prisma/client, which review already imports directly, never report-sections' internal type; (c) src/lib/publish-compare-and-set.ts already blesses this exact shape (PublishCasClient). Facade SERVICES (@Module.exports, imported from the barrel) never take a tx parameter. Period contributes NO cross-boundary tx: publication imports only buildTransition (pure, no tx) from period; period's tx-taking applyTransition is called only inside period.

Publish atomicity preserved: publishAssembledReport has NO surrounding transaction by design — it rides its snapshot in the single guarded updateMany data (publishCompareAndSet), so single-statement execution IS its atomicity; period.publishPeriod builds+writes snapshot inside one $transaction via applyTransition. Neither is touched by facade rerouting.

Barrel discipline (protects invariant 2): each module's new index.ts is EXPORT-ONLY, zero side effects — it re-exports the module class + facade service (+ the sanctioned pure helpers above). role-coverage.test.ts builds createAppRouter({}) at module load and never invokes resolvers, so only a module-load-time break (a circular or side-effecting barrel import) could fail it. Keep barrels pure.

Gate: pnpm test:integration MANDATORY (single-thread, postgres+redis up) — the CAS/race behavior (publish-atomicity, review-actions un-submit race, published-lock) only exercises on a real DB. Plus full unit suite + both guard tests. Flip the zone to error LAST, as a one-line config change reversible if integration goes red.

## Commit order

Each commit leaves the tree green (unit + both guard tests); slice 6 commits additionally require pnpm test:integration.

SLICE 4 (one commit per module, order low→high risk):
C1. review internal split + NEW ReviewRepository/ReviewActionsRepository ports + contract suite. Gate: unit + review-actions.integration.
C2. publication internal split + NEW PublicationRepository port + contract suite. Gate: unit + publication.integration.
C3. report-sections internal split (domain/application/infrastructure), reuse existing contract suites. Gate: unit + report-sections integration tests.
C4. period internal split — ATOMIC with EXEMPT_SUFFIXES update in lifecycle-write-gate.test.ts (moving period-transition.ts / period-transition.apply.ts and editing the exempt suffixes MUST be one commit). Gate: unit + lifecycle-write-gate + period.publish-atomicity.integration + period-transition.integration.

SLICE 5 (independently revertable, after slice 4):
C5. EmailPort + adapter + in-memory-fake unit test. Gate: unit.
C6. QueuePort + adapter + fake test. Gate: unit.
C7. CachePort + adapter + fake test. Gate: unit.

SLICE 6 (order: seam first, barrels next, flip last):
C8. Relocate/re-export the shared writes to their settled homes: re-export applyRevokeTransition from report-sections/index.ts, buildTransition from period/index.ts, snapshot helpers from report-sections/index.ts; update the 4 deep-import consumers to import from the sibling barrel. NO lint flip yet. Gate: unit + test:integration.
C9. Add index.ts facade barrels to the remaining invariant modules + reroute period.module.ts DI wiring (.module.js/.service.js → sibling barrel) and the repo→repo delegations (weekly-report, admin-shared). Gate: unit + role-coverage + test:integration.
C10. Flip import-x/no-restricted-paths cross-module zone allowlist→error (one-line config). Gate: unit + full test:integration. One-line revert if red.

Slices are independently revertable; within slice 6, C10 is the only irreversible-feeling step and it is a one-line config revert. Slice 1 (enforcement baseline) is the sole dependency of later slices and is additive.

## Invariant guards (the proof tests)

- Invariant 1 (period dual-state) — GUARD: modules/period/**tests**/lifecycle-write-gate.test.ts (static AST scan; every Report lifecycle write must spread buildTransition, only period-transition.ts/.apply.ts may name governed fields). PRESERVED BY: buildTransition remains the single pure writer of the complete governed field set; applyTransition composes it inside the caller's tx. SLICE-4 ACTION (non-negotiable, same commit as any move): update EXEMPT_SUFFIXES to the new domain/infrastructure paths; do NOT move the gate test file (SRC_ROOT anchors relatively on modules/period/**tests**/). PROOF: lifecycle-write-gate.test.ts + period.publish-atomicity.integration.test.ts green.
- Invariant 2 (role-coverage, 9 canonical middleware builders) — GUARD: infrastructure/trpc/**tests**/role-coverage.test.ts (walks createAppRouter.\_def.procedures, asserts every leaf's middleware-chain PREFIX matches one of 9 base-procedure identities by reference: public/protected/head/admin/lead/viewer/anyRole/leadership/leadHeadAdmin). PRESERVED BY: slices 4-6 never touch infrastructure/trpc/{trpc.middleware.ts,trpc.router.ts}; the gate uses stub deps ({}) and never invokes resolvers, so only a module-LOAD-time break can fail it. GUARD ACTION: new index.ts barrels are export-only with zero side effects and no circular imports. PROOF: role-coverage.test.ts green after every slice, especially C9.
- Invariant 3 (publish atomicity + no Prisma.TransactionClient leak across a module boundary) — PRESERVED BY the existing structural-slice pattern, NOT a new UnitOfWork. The single cross-boundary tx pass (review.postVerdict → applyRevokeTransition) crosses as Pick<Prisma.TransactionClient,'reportSection'> (structural, from @prisma/client which review already imports), on a PURE function, not a facade service method — identical shape to the already-blessed publishCompareAndSet(PublishCasClient) in src/lib. publishAssembledReport rides its snapshot in one guarded updateMany (single-statement atomicity, no surrounding tx by design). Facade services never take a tx param. PROOF: review-actions.integration.test.ts + publication.integration.test.ts + report-sections.published-lock.test.ts + period.publish-atomicity.integration.test.ts green under pnpm test:integration (mandatory at slice 6).
- Meta-guard: pnpm test:integration (single-thread, postgres+redis up) is REQUIRED for every slice-6 commit and for slice-4 commits that moved a transaction-site file; slice 5 needs unit only. A folder-scoped vitest run is insufficient — run the full suite.

## Decisions for the owner

- None. Slices 4-6 are behavior-neutral relocations + import-fixes; nothing changes user-facing behavior or scope. The one non-trivial design choice — where the shared cross-module writes live once deep imports are banned — is council-settled by a single determinism rule, not a product decision: single-domain-owned pure/tx-composing helper re-exports from that domain's barrel (applyRevokeTransition→report-sections, buildTransition→period, snapshot helpers→report-sections); owner-less shared write stays in src/lib (publishCompareAndSet, already there). Council recommendation: barrel re-export (defensible against a rule-of-3 attack and parity-consistent with the existing buildTransition/publication precedent). Escalate to Sasha only if he wants the alternative — moving applyRevokeTransition to src/lib — which is also lint-legal and non-leaking but breaks parity with buildTransition.

## Provenance

This synthesis is built from PRIMARY SOURCES, not from the forwarded plan. The single input plan (lens: codex) was an empty forwarding stub — every substantive field read "Not yet available — pending Codex's background run" (task-mr9hjgof-2wclqe was fire-and-forget and never retrieved); its adversarial score was 1/10 ("Fatal: there is no plan"). I therefore did the recon directly: read openspec/changes/restructure-directory-architecture/design.md and docs/architecture/TARGET-STRUCTURE-2026-07-02.md, and verified the actual code via codegraph + Read — applyRevokeTransition (report-sections/revoke-transition.ts), postVerdict (review-actions.prisma-repository.ts:183), publishCompareAndSet (src/lib/publish-compare-and-set.ts), applyTransition/buildTransition (period/period-transition.apply.ts, period-transition.ts), publishAssembledReport (publication.prisma-repository.ts), and both invariant guard tests (role-coverage.test.ts, lifecycle-write-gate.test.ts). Cross-module import surface enumerated by grep (confirmed publication imports only buildTransition, never applyTransition, from period). The plan was stress-tested via advisor, which confirmed the no-UnitOfWork thesis, the EXEMPT_SUFFIXES slice-4 landmine, the empty-fork honesty, and the invariant-2/test:integration boundaries. The design.md slice numbering (4/5/6) and the withTransaction/UnitOfWork framing are quoted from the governing doc; the finding that the seam already exists as structural-slice pure functions is my own, evidence-grounded, and directly answers the scorer's unaddressed-invariant-3 and over-engineering complaints."
