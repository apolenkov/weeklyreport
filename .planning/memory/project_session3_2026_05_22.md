---
name: project-session3-2026-05-22
description: Session 3 closeout — deriveEffectiveStageStatus, lead↔head parity, history redirect, agent slots, specs
metadata:
  type: project
---

Session 3 landed on `fix/PRJ-2/shiny-eagle` (2026-05-22, 10 commits, b014a42).

**Why:** UAT live sweep revealed StageChip colour bug (grey on blocked chip), head missing
period toolbar, duplicate Priorities block in slides, and 5 other UX gaps vs. lead.

**Changes:** `deriveEffectiveStageStatus` 3-source helper (explicit TrafficLight, risk severity,
blocked KanbanItem); cross-author chip fix in lead-form.tsx; `HeadReportShell` gains period
navigator + archive toggle; `LeadSlidesPreview` deleted (form now full-width); Priorities block
removed from both `LeadUnifiedSlide` and `HeadSlideArticle`; `/head/history` 307→`/reports?tab=published`;
`AgentReviewComingSoon` inert badge on all 4 surfaces; dashboard skeleton height reservations for CLS.

**Remaining open (user-driven):** item-1 live verify (submit lead sections first); LSC-05/06
mine-path gap (stageIds↔stageName, backend change needed); #322 priorityRank+Revoke live;
CLS re-trace after skeleton fix; next/font migration.

**How to apply:** `enrichedCrossAuthors` drops stageName at ~:376-398 in lead-form.tsx —
cross-author chip fix MUST use RAW `crossAuthorSectionsQ.data`. LSC-05/06 self-skip at runtime
if mine-path not wired. Push still blocked by SSL on ghe.example.org.
