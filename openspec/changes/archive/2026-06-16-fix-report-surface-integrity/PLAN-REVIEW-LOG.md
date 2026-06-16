# Plan Review Log: fix-report-surface-integrity

Act 1 (grill-with-docs) complete — CONTEXT.md gained the period/submission glossary. Act 2 =
adversarial Codex review (read-only), 7 rounds. Codex thread 019ecc02-f888-7b70-a16b-699f5c11c7b2.
Kept here (in the change dir) for provenance; the locked brief is proposal.md + design.md + tasks.md.

## Round 1 — REVISE (13 findings)

present-route fate; Export-PDF-in-pill vs toolbar spec; lead stub shape; W3/W4 isSubmitted
footgun; listbox global IDs; one formatter; W6 = existing-spec impl; broaden W6 tests; W7
items+null+multi-stage; W7 snapshot path; W7 legacy "No stage set"; W8 authz-scope leak; W8 vs
report-badge-resolution; W9 scope creep. → all accepted.

## Round 2 — REVISE (8)

role-coverage viewer authz; `/print` IS the PDF-worker template; missed deferred-feature-pattern

- sweep-runtime-correctness present-route coverage; nav/route-match test updates; `/print`
  direct-human behavior; isSubmitted prop split; W6 PDF-worker regression. → all accepted.

## Round 3 — REVISE (5)

lock export matrix incl. admin; `/present` one behavior; `/print` direct-human; lead-export
backend decision. → locked head+admin+viewer real / lead ComingSoon+FORBIDDEN; `/present`
308→?mode=slides; `/print` worker-vs-human discriminator.

## Round 4 — REVISE (3)

lead "backend-deferred stub" vs "drop authz" incompatible; role-coverage must say
head+admin+viewer-only; `/print` role-specific redirects. → lead reframed UI-deferred+FORBIDDEN;
bullet rewritten; redirect targets by role.

## Round 5 — APPROVED

No blockers; export matrix, lead behavior, route redirects, `/print` worker-vs-human, role
coverage locked.

## Scope addition (W11) — after live-DB verification

User pushback on "6/7 not a bug". Verified vs customreport_dev: CRM-Customer 360 Support=null yet
red (risk floor); CRM-Data Lake Analysis/Dev/Support=null, no risk → beige. Root cause: chip click
→ risk dialog → multi-stage select → risk floors color, raw status stays null → counter excludes.
REAL defect. User decision: risk-covered (OWN risk) counts toward X/7 + chip distinguishes
risk-covered vs status-set + dialog stops defaulting all stages. Reverses lead-pipeline-card → W11.

## Round 6 — REVISE (6, on W11)

count OWN risks only; stage-less legacy risk handling (don't inherit empty=all predicate);
`coveredByOwnRisk` data-shape + reload test; dialog product-switch must not set all stages; chip
distinction needs aria/tooltip; combined W6+W11 reload regression. → all accepted; W11 rewritten.

## Round 7 — APPROVED

W11 covers prior failure modes; no W1–W10 regressions from the addition.

## Resolution — CONVERGED (7 rounds)

APPROVED incl. W11. User signed off 2026-06-15. Implement in a fresh session via Workflow.
KEY correction: the "6/7 stages" report is a REAL UX defect (W11), not working-as-designed.
