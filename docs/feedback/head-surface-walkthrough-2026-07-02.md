# Head-surface live walkthrough + a11y/design audit — 2026-07-02

Two sources: (A) a live agentation walkthrough of `/head/dashboard` + `/head/report`,
(B) an adversarially-verified code audit (22 confirmed findings; full detail in the
workflow output `tasks/wl6zt7h8h.output`). agentation server was down → items captured inline.

## A. Head feedback (user direction)

- **HF1 — Move the review-acknowledge button into publish-and-lock.** `review-acknowledge-bar.tsx:87`.
- **HF2 — Activities are missing from the head report; show them like products.** Products and
  activities are the SAME "positions" model with the same records/risks/blockers; the only
  differences: an activity has NO SDLC stage, and it links to product(s) (M:N) rather than
  stages. `weekly-report-page.tsx:799`, `activity-status-strip.tsx:47`. (HF2/HF4/HF5)
- **HF3 — Move the Section-reviews strip to the dashboard; merge it there.** `section-review-strip.tsx:26`.
- **HF6 — AlertBar (reopen banner) and ReopenRequestsCard say the same thing → merge.**
  `alert-bar.tsx:93`, `reopen-requests-card.tsx:47`.
- **HF7 — Add an Agent-review button to the section-review strip too.** `section-review-strip.tsx:26`.
- **HF8 — Agent review must be human-confirmed before it affects any action** (reopen periods,
  etc.). Agent judges → a human always confirms.
- **HF9 — Split the report into a "review mode" and a normal mode.** Review mode shows the
  detailed review affordances (comments/verdicts); normal mode as before. `record-comments.tsx`.
- **HF10 — Auto-copy unfinished on period creation → the carry-over banner is redundant.**
  Always carry forward on new-period create; drop the "Copy forward unfinished" banner.
  `carry-over-banner.tsx:29`.

This is the same theme as the lead walkthrough (see `lead-surface-annotations-2026-07-02.md`):
**activity as a first-class reporting unit beside product.** Cross-surface (lead form + lead
slides + head report). Schema: `ProjectActivity.projectId` is 1:N today; user wants M:N.

## B. Audit findings (22 confirmed, most-severe first)

HIGH (WCAG / must-fix):

- **kpi-cards.tsx:68** — Deadline label gold `#cba258` on white card = 2.35:1. WCAG 1.4.3 fail.
- **kpi-cards.tsx:98** — "at risk" numeral, same gold at 18px bold, 2.35:1 (needs 4.5:1). WCAG fail.

MEDIUM/LOW (design-consistency + a11y, verified real; severities partly overstated):

- **lead-summary-table.tsx:119** (+ dashboard-page.tsx:359, dashboard-skeleton.tsx:49) —
  `rounded-[var(--radius-card)]` is an UNDEFINED token → square corners on empty/skeleton
  vs 12px populated. Fix → `var(--radius)`; regenerate the skeleton snapshot.
- **slide-activity-pills.tsx:39 / slide-product-chips.tsx:40,90** — status by DOT COLOR only
  (aria-hidden, no text) → WCAG 1.4.1/1.1.1. Add sr-only status label.
- **slide-product-chips.tsx:63-75** — declares `role=tablist/tab` + `aria-controls` to a
  non-existent tabpanel, no roving tabindex; arrow keys hijacked by the deck. It's a toggle
  filter → use `role=group` + `aria-pressed`, drop the dangling aria-controls.
- **Off-token status hex** (`#8a6d1b`/`#fef3c7`/`#d4a017`) duplicated across kpi-cards:49,
  lead-summary-table:43, activity-live-panel:219, blocked-at-risk-table:269, etc. — some fail
  4.5:1. Tokenize to `--color-status-at-risk-*`.
- **remind/revoke-lead-button** — no touch floor; add `max-md:min-h-[var(--touch-target-min)]`.
- **reopen-requests-card.tsx:90** — card elevation outlier vs sibling dashboard cards.
- **reopen-requests-card.tsx:97 vs kpi-cards.tsx:49** — same "N pending" pill rendered two
  ways (size/weight/color-source) → extract one primitive.
- **activity-live-panel.tsx:45** — "Submission Activity" heading text-lg vs peers text-base.

Quick, safe, high-value first pass: kpi contrast (2 lines), `--radius-card` token (3 files +
snapshot), blocked-at-risk hardcoded hex, activity-heading size. The rest = a tokenization +
slide-a11y sweep.
