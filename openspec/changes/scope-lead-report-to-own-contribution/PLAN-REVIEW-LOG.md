# Plan Review Log: scope-lead-report-to-own-contribution

Act 1 (grill-with-docs) complete — change locked, CONTEXT.md updated. MAX_ROUNDS=5.

## Round 1 — Codex

**Findings**

- **Blocking:** The proposal’s baseline is false: it says no foreign content reaches the lead page, but `crossAuthorSectionsQ` is always loaded and mapped into `mergedCurrentItems`, `mergedNextItems`, `mergedRisks`, and `mergedDecisions` ([lead-form.tsx](/home/user/work/customreport/apps/web/src/components/lead/lead-form.tsx:358), [lead-form.tsx](/home/user/work/customreport/apps/web/src/components/lead/lead-form.tsx:679)); the mappers copy foreign text/impact/mitigation verbatim ([lead-cross-author.ts](/home/user/work/customreport/apps/web/src/lib/mappers/lead-cross-author.ts:207), [lead-cross-author.ts](/home/user/work/customreport/apps/web/src/lib/mappers/lead-cross-author.ts:235), [lead-cross-author.ts](/home/user/work/customreport/apps/web/src/lib/mappers/lead-cross-author.ts:262)). Fix: remove or replace `crossAuthorSections` on the lead page with a minimal per-stage health read model, and add tests that foreign item/risk/decision text is absent.

- **Blocking:** Privacy scope only trims `getCrossAuthors` counts, but `getCrossAuthorSections` still returns full foreign items/risks/decisions from the API ([lead-form.prisma-repository.ts](/home/user/work/customreport/apps/api/src/modules/report-sections/lead-form.prisma-repository.ts:401)); that directly contradicts the spec’s “MUST NOT render any other author’s text” ([spec.md](/home/user/work/customreport/openspec/changes/scope-lead-report-to-own-contribution/specs/lead-pipeline-card/spec.md:7)). Fix: include `getCrossAuthorSections` deprecation/removal or split it into a non-content status-only endpoint.

- **Blocking:** “No full names” is not implemented by the planned shape: backend still selects `user.name`, `applyCrossAuthorStageOverrides` stores it as `assignee`, and `StageChip` renders `Locked — owned by ${assignee}` ([lead-form.prisma-repository.ts](/home/user/work/customreport/apps/api/src/modules/report-sections/lead-form.prisma-repository.ts:258), [lead-cross-author.ts](/home/user/work/customreport/apps/web/src/lib/mappers/lead-cross-author.ts:167), [stage-chip.tsx](/home/user/work/customreport/apps/web/src/components/lead/stage-chip.tsx:179)). Fix: return/render initials only for Product context and never pass full foreign names into the lead surface.

- **Major:** D3 says foreign stage status derives from risks only, but current cross-author derivation still feeds blocked items into `deriveEffectiveStageStatus` ([lead-cross-author.ts](/home/user/work/customreport/apps/web/src/lib/mappers/lead-cross-author.ts:157)); this conflicts with `status-risk-unification` where risks are the single source of truth ([spec.md](/home/user/work/customreport/openspec/specs/status-risk-unification/spec.md:11)). Fix: remove blocked-item status derivation for foreign context and pin a regression test.

- **Major:** Authorization is under-specified: both cross-author endpoints accept arbitrary `reportId` and only bind shared products via global assignments, with no explicit “caller has a section/access to this report period” scenario ([lead-form.prisma-repository.ts](/home/user/work/customreport/apps/api/src/modules/report-sections/lead-form.prisma-repository.ts:243), [lead-form.prisma-repository.ts](/home/user/work/customreport/apps/api/src/modules/report-sections/lead-form.prisma-repository.ts:359)). Fix: require a caller-owned section or report membership check before returning Product context, and add a negative scenario for an unrelated reportId.

- **Major:** The design asserts “Slides mode → same own-content rule as the form” but there is no spec scenario or task touching the `LeadSlidesClient` path ([design.md](/home/user/work/customreport/openspec/changes/scope-lead-report-to-own-contribution/design.md:78)). Fix: add a slides-mode requirement/task proving lead slides do not show foreign records while preserving Product context health.

- **Major:** The change touches request paths/shared contracts but the design lacks before/after data flow and rollout/consumer analysis required by `openspec/config.yaml` ([config.yaml](/home/user/work/customreport/openspec/config.yaml:98)); tasks also skip shared contract/schema ordering ([tasks.md](/home/user/work/customreport/openspec/changes/scope-lead-report-to-own-contribution/tasks.md:3)). Fix: add a shared/API contract section first, listing changed TypeScript/Zod/tRPC shapes and downstream consumers.

- **Minor:** “Foreign stages” risks colliding with the canonical “Stage chip is identity label, not status signal” wording from `report-card-clarity` ([spec.md](/home/user/work/customreport/openspec/specs/report-card-clarity/spec.md:42)). Fix: explicitly scope this to the SDLC pipeline Product context chip, not item-row stage chips.

- **Minor:** Task 4.3 says archive once verified, but OpenSpec lifecycle says archive only after PR merge to main ([tasks.md](/home/user/work/customreport/openspec/changes/scope-lead-report-to-own-contribution/tasks.md:39), [config.yaml](/home/user/work/customreport/openspec/config.yaml:123)). Fix: move archive to a post-merge follow-up task or remove it.

VERDICT: REVISE

### Claude's response

- Baseline corrected: lead page DOES merge foreign content via crossAuthorSections (W5/W6) — proposal/design rewritten to remove foreign records, not just counts.
- Privacy/names/risk-only-derivation/authz/slides/shared-contract/wording/archive findings all folded into the rewritten artifacts.

## Round 2 — Codex

Round-1 findings are addressed in the proposal/spec/tasks: foreign records are now in scope for removal, Product context is status-only, names become initials, foreign status is risk-derived, authz has a negative scenario, slides mode is covered, shared/API contract work is first, chip wording is scoped to the SDLC pipeline, and archive moved post-merge. `openspec validate scope-lead-report-to-own-contribution --strict` passes.

One new nit: the impact/tasks say to drop the `user.name` select while returning initials ([proposal.md](/home/user/work/customreport/openspec/changes/scope-lead-report-to-own-contribution/proposal.md:56), [tasks.md](/home/user/work/customreport/openspec/changes/scope-lead-report-to-own-contribution/tasks.md:9)), but `User` has no initials field, only `name` ([schema.prisma](/home/user/work/customreport/prisma/schema.prisma:9)). Fix: clarify that backend may read `user.name` internally to derive initials, but the API response and frontend props must never expose full names.

VERDICT: APPROVED

### Claude's response

- APPROVED. Applied the one nit: backend derives initials from user.name server-side; full name never crosses the API boundary (design D6 + task 2.1).
