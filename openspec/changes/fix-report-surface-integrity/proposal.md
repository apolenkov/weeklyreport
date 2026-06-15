# Fix Report Surface Integrity — header, period markers, data + completeness (2026-06-15)

## Why

Manual-UAT walk 2026-06-15 (`FEEDBACK-LOG.md`) surfaced one cluster of report-surface
problems. Verified in source + the live DB (`customreport_dev`):

1. **Stage completeness lies (the "6/7" report).** Clicking a chip opens the risk dialog;
   selecting several stages creates a risk that floors those chips' COLOR while their raw
   status stays null. The X/7 counter reads raw → excludes them. DB-confirmed: CRM-Customer 360
   Support = null yet rendered red (risk floor); CRM-Data Lake Analysis/Dev/Support = null, no
   risk → beige. A risk-colored chip is indistinguishable from a status-set chip. Real defect.
2. **Head report header is overloaded** vs the lean lead layout; four overlapping
   present/export controls (Present, Slides, Print, Export-PDF).
3. **Blocked & At Risk panel drops data:** stage column hardcoded `null` → always `· —`; some
   products show "Unknown".
4. **Two divergent period navigators** + inconsistent period label styles app-wide.
5. **No per-period state in the lead navigator** (current / my-submitted / archived).
6. **Floor renders inconsistently:** live lead form colors an empty-but-covered stage; head
   review + PDF leave it empty — a `status-risk-unification` violation.

## What Changes

W1 head header → lean lead shape. W2 consolidate to one real Export-PDF (head/admin/viewer)

- Slides-only presentation; `/present` 308→`?mode=slides`; lead PDF = ComingSoon + FORBIDDEN.
  W3 lead navigator markers (current/own-submitted/archived). W4 one combobox navigator + one
  label format. W5 ScopeToggle restyle. W6 floor display consistency (head/PDF match live).
  W7 escalation carries its stage (live + snapshot), "No stage set" fallback. W8 "Unknown"
  resolves report-wide but scoped. W9 KPI label clarity (telemetry-keying discovery-gated).
  **W11 a risk-covered stage (OWN risk) counts toward X/7** — reverses `lead-pipeline-card`;
  chip distinguishes risk-covered vs status-set (visual + aria); risk dialog stops defaulting all
  stages; stage-less legacy risk counts zero ("No stage set").

This proposal + `design.md` + `tasks.md` are the locked brief; the 7-round adversarial Codex
review is in `PLAN-REVIEW-LOG.md` (this dir). Glossary added to `CONTEXT.md` (period / lead
submission / archived).

## Non-goals

Seed/example rework + Small-vs-Full-MVP seed scaling; director runtime; dark-mode/theme;
versions/snapshots; the "d311"/"Risk" UAT-entered strings (reseed, not code).

## Status

Plan locked + Codex-APPROVED (round 7). User signed off 2026-06-15. Implementation runs in a
fresh session via Workflow. The status-pill wrap fix (`lead-summary-table.tsx`) already landed.
