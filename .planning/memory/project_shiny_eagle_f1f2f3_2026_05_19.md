---
name: shiny-eagle F1/F2/F3 closure 2026-05-19
description: Cross-author always-on rows, sdlc-pipeline risk chips, no dashed-frame embeds — committed on fix/PRJ-2/shiny-eagle
type: project
---

F1/F2/F3 from page-feedback-lead-report shiny-eagle plan committed on 2026-05-19.

**What changed:**

- `CrossAuthorEntry` extended: `risks: {severity, text}[] | null` + `isEmpty: boolean`
- `SdlcPipeline` Other contributors row: per-risk chips (⛔/⚠), no "readonly ↗" text, icon-only link
- All 5 sections (CW/NW/Risks/Decisions/Priorities): dashed-frame removed, foreign rows always-on inline with 🔒 label + opacity-70
- `CrossAuthorHint`: toggle props removed (`expandable`/`expanded`/`onToggleExpand` gone)
- `crossAuthorSectionsQ` now loads eagerly (not gated on showCA\* state)
- `prisma/seed.ts`: added Igor (Testing) + Maria (DevOps) StageAssignments on product 201 (Маркетинговый портал) so ≥2 contributors appear in LEAD_1 demo

**Why:** User feedback: foreign items must be always visible, no toggle; risk chip detail better than aggregate count.

**How to apply:** F4 (slide redesign) already done in prior session (commit f031c43). Branch fix/PRJ-2/shiny-eagle has all 4 workstreams; needs `pnpm db:seed` to see demo 2-contributor layout.
