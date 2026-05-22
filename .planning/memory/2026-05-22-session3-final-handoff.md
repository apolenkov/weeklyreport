# Session 3 Final Handoff — 2026-05-22

Branch: `fix/PRJ-2/shiny-eagle`

## Done (all session 3 deliverables committed)

### Session 3 commits (9 total)

| SHA       | What                                                              |
| --------- | ----------------------------------------------------------------- |
| `c97f6dc` | fix(stage-chip): extract deriveEffectiveStageStatus helper        |
| `018d8c4` | fix(lead): wire helper into cross-author + mine SDLC chips        |
| `391ac63` | fix(slides): remove duplicate Priorities block (lead + head deck) |
| `40a6d22` | feat(head): redirect /head/history → /reports                     |
| `9718e25` | fix(lead): delete LeadSlidesPreview (form now full-width)         |
| `eab98df` | feat(agent-review): AgentReviewComingSoon + TODO(AGENT-REVIEW-\*) |
| `95c4e00` | feat(head): period navigator + archive toggle parity              |
| `3f4cb01` | perf(dashboard): reserve skeleton heights — reduces CLS           |
| `712d9c8` | test: LSC-01..06 + SC-160/165 ready; seed supplies risk+item data |

### Gates (final)

```
pnpm typecheck   → 0 errors
pnpm lint        → 4/4 tasks clean
pnpm test        → 508/508 pass (67 test files)
pnpm lint:md     → 677 files, 0 errors
```

### Cumulative (sessions 1+2+3)

| SHA                                            | What                                                          |
| ---------------------------------------------- | ------------------------------------------------------------- |
| `dcd1523`                                      | perf(dashboard): ProductKpiCard height + CLS                  |
| `8d6e97f`                                      | feat(head): action-row parity — Export PDF + Presentation     |
| `a79dc02`                                      | feat(head): product-scope slide deck transposition            |
| `0c72e48`                                      | (scope prop + ScopeToggle in slides mode wired)               |
| `3a3280f`                                      | docs(uat): head parity + viewer verified + next/font deferred |
| + 9 session 3 commits above (c97f6dc..712d9c8) | see table above                                               |

## Open (user-driven / deferred)

### item-1: Blocked chip live verify

Toggle Blocked in `RiskEditDialog` → Save → reload → chip turns red AND severity
persists in DB. Requires submitted lead sections.
Spec `LSC-01` (e2e/regression/lead-locked-stage-color.spec.ts) will catch regression.

### LSC-05/06 mine-path

`buildStageGrid` in `apps/web/src/lib/mappers/lead-form.ts` has extended
signature but `mapLeadProducts` not wired (`section.risks` exposes `stageIds[]`
not `stageName`). Backend change or a stageId→stageName lookup needed.
`TODO(STAGE-COLOR-SNAPSHOT)` on the snapshotStageMap path.
LSC-05/06 self-skip at runtime until wired.

### #322 Verify priorityRank + Revoke P6/P7 live

Submit lead sections first → verify Revoke / Revoke All in head dashboard.
Also unblocks live visual confirm of product-scope slide deck.

### next/font migration

`TODO(VERCEL-FONT)` in `apps/web/src/app/layout.tsx`. Needs visual sign-off.
Current `preconnect` + `display=swap` is acceptable interim.

### CLS live re-trace

Dashboard skeleton geometry fix committed (`3f4cb01`). Baseline 0.0817.
Live re-trace needed to confirm improvement after restart.

## Architecture decisions (do not re-litigate)

- `deriveEffectiveStageStatus`: pure function in `apps/web/src/lib/stage-status.ts`.
  Cross-author path uses RAW `crossAuthorSectionsQ.data` (NOT `enrichedCrossAuthors`
  which drops stageName at :376-398). Mine-path: signature ready, wiring deferred.
- `AgentReviewComingSoon`: inert badge following `LanguageComingSoonControl` pattern.
  Mounted in 4 surfaces. AI/RAG implementation remains frozen.
- Head history: `/head/history` → 307 redirect to `/reports?tab=published`.
  `HeadHistoryClient` deleted. Period navigation for head moved to `HeadReportShell`
  via `compiledHistory` query (same as before for head, now in the shell not a page).
- LeadSlidesPreview: deleted. Lead form is single-column. Slides still work via
  `?mode=slides` URL.
- Priorities block: removed from both `LeadUnifiedSlide` and `HeadSlideArticle`
  independently (decks share no code).

## Files touched session 3

- `apps/web/src/lib/stage-status.ts` (NEW)
- `apps/web/src/lib/stage-status.test.ts` (NEW)
- `apps/web/src/components/report-shell/agent-review-coming-soon.tsx` (NEW)
- `apps/web/src/lib/mappers/lead-form.ts` (buildStageGrid extended)
- `apps/web/src/components/lead/lead-form.tsx` (cross-author fix, aside removed, AgentReview slot)
- `apps/web/src/components/slides/lead-unified-slide.tsx` (Priorities removed, AgentReview slot)
- `apps/web/src/components/slides/status-slide-deck.tsx` (Priorities removed, AgentReview slot)
- `apps/web/src/components/head/head-report-shell.tsx` (period toolbar, AgentReview slot)
- `apps/web/src/app/(app)/head/history/page.tsx` (redirect)
- `apps/web/src/components/navigation/nav-bar.tsx` (History link updated)
- `apps/web/src/components/navigation/nav-bar.test.tsx` (updated)
- `apps/web/src/components/dashboard/dashboard-skeleton.tsx` (CLS hardening)
- `apps/api/src/modules/ai/ai-summary.service.ts` (TODO(AGENT-REVIEW-02))
- `prisma/seed.ts` (risk+item data for LSC)
- `apps/web/e2e/regression/lead-locked-stage-color.spec.ts` (LSC-05/06 added)
- `apps/web/e2e/publish-revoke.spec.ts` (SC-160/165 unfixme)
- `apps/web/e2e/11-head-history.spec.ts` (redirect verify)
- DELETED: `head-history-client.tsx`, `lead-slides-preview.tsx`, `lead-slides-preview.test.tsx`
