# Head-surface UAT polish (slides fixed frame + dashboard card idiom)

## Why

Live head-surface UAT (2026-06-24, agent-driven walkthrough; user annotated each
surface in the browser). Five items came back (F1–F5). Two are concrete,
already-blessed-by-spec/parity wins implemented here; three are open design
decisions parked for the user with recommendations (see Open Questions).

Re-mapped against current `main` (the annotations were captured on a stale build
— line refs from the old bundle did not match current `main`; each item was
re-verified against current source):

- **F3 — slides do not read as fixed slides (implemented).** On the head slides
  view (`/head/report/{id}?mode=slides`) the active slide card is content-height
  and floats in a tall viewport with large empty space below. The user asked for
  a fixed, PowerPoint-like slide canvas. The **lead** slide already does this:
  `LeadSlideArticle` carries the `.slide-frame` class (fixed `aspect-ratio:
var(--slide-aspect)` = `16 / 10`) and flexes its content to fill the frame.
  The **head** slide (`HeadSlideArticle`) does not. F3 is a parity fix, not a new
  aesthetic: give the inline head slide the same fixed `.slide-frame` the lead
  slide already uses.
- **F5 — Period Summary reads "square/boxy" (implemented).** On `/head/dashboard`
  the `LeadSummaryTable` ("Period Summary") is a dense 10-column ruled `<table>`
  that clashes with the rounded-card idiom of every other dashboard block. The
  user asked to make it look like the `BlockedAtRiskTable` he likes. This is
  already a spec requirement — `head-dashboard-clarity` states the Period Summary
  rows "MUST follow the rounded card idiom of the other dashboard cards rather
  than a square-ruled table treatment" — that the current implementation does not
  satisfy. F5 finishes that requirement, sharpened to BlockedAtRisk parity.

## What Changes

- **Head slide gets a fixed slide frame (F3).** `HeadSlideArticle` adopts the
  `.slide-frame` fixed-aspect canvas and the lead deck's fill model: hero/meta
  keep natural height, the 2×2 section grid stretches over the remaining frame
  height (`flex-1 min-h-0`, with the `--slide-quadrant-min` floor on the grid track —
  `auto-rows-[minmax(...,1fr)]`, parity with the lead deck, not a card
  min-height), and a quadrant that overflows scrolls
  inside its own card rather than growing the slide. Aspect reuses the existing
  `--slide-aspect` token (16:10) — no new aesthetic decision. Mirrors the
  `lead-slide-quadrants` "framed lead slide fills its frame" behavior.
- **Period Summary becomes a card list (F5).** `LeadSummaryTable` is rebuilt from
  a 10-column ruled `<table>` into a vertical list of per-lead rows in the
  `BlockedAtRiskTable` idiom (rounded `rounded-lg` cards, soft tinted surface,
  gaps not rules): lead identity (avatar + name + role) and status pill on the
  lead line, the counts as compact labeled chips, the Remind/Revoke action on the
  right. Fits the card width with no horizontal scroll. Accessibility-preserving:
  the action gating (Remind only when `canSendReminder`, Revoke for submitted) and
  the 24h-inactive treatment are unchanged in behavior.

## Resolved decisions (user, 2026-06-24 — implemented)

The three open items were taken to the user with recommendations; the user chose
and they are now implemented on this change.

- **F1 — "Open focused report" in slides header → REMOVE, REPLACE WITH
  PUBLISH & LOCK.** The user judged the link redundant ("это по сути дублирует
  кнопки, которые ниже" — the deck already navigates focused slides) and wanted
  the same Publish & Lock action the edit mode carries to live there instead.
  Removed the link + the `onFocusHrefChange`/`focusHref` plumbing
  (`head-report-shell.tsx`, `head-slides-client.tsx`), and added a
  self-contained `HeadPublishLockAction` (own query + publish/reopen mutations,
  role-gated) to the slides header beside Export-PDF. Edit/focus mode never lost
  the button — it is role-gated, not slides-only.
- **F2 — "Needs Attention" banner → REWORK INTO RISKS.** The escalation
  (`api.escalations`, a head-facing flag — distinct data from the structured risk
  register) no longer renders as a standalone banner the user did not recognize.
  It folds into Risks & Blockers as a leading `data-accordion-row="escalation"`
  row (Flagged gutter + Blocked/At Risk badge). The section now renders when
  `risks.length > 0 || showNeedsAttention`, and the existing dedup is extended to
  risk texts so an escalation duplicating a risk is suppressed (it would
  otherwise sit directly above its twin). In the current seed every escalation
  duplicates a risk, so no extra row shows — the risk row carries the content;
  a genuinely distinct escalation still surfaces as the Flagged row.
- **F4 — "Blocked & At Risk" table → COLLAPSE BY DEFAULT.** Real data, kept as a
  fast triage peek but `BlockedAtRiskTable` now starts collapsed — the same risk
  content lives in the report below, so it no longer claims permanent vertical
  space.

## F5 alignment follow-up (UAT 2026-06-24)

After the F5 card rebuild shipped, the user flagged that the per-lead counts did
not line up cleanly horizontally/vertically. Diagnosis: the flex/`ml-auto`
layout had no shared column rails, so columns aligned only by accident and a
variable-width right action column made the grid drift. Fix: the Period Summary
counts now sit on CSS **subgrid** column rails (the `<ul>` owns the track
template; each `<li>` and its counts `<dl>` are `grid-cols-subgrid`
participants), with status/date/action tracks `auto`-sized to content so the
Remind/Revoke buttons are never clipped. The full count labels and warm cards
are kept intentionally — the grill's "repeated labels" dedup was declined in
favor of the warmth the user values; alignment, not de-duplication, was the ask.

## Impact

- Affected specs:
  - `head-slide-density` (ADDED: the inline head slide renders within a fixed
    slide frame).
  - `head-dashboard-clarity` (MODIFIED: the Period Summary card-idiom requirement,
    sharpened to BlockedAtRiskTable parity + subgrid column alignment; ADDED: the
    Blocked & At Risk block defaults collapsed).
  - `report-card-clarity` (MODIFIED: the escalation folds into Risks & Blockers
    as a leading row; no standalone "Needs Attention" banner; dedup also covers
    risk text).
  - `head-toolbar-semantics` (MODIFIED: the slides-mode "Open focused report"
    drill-in link is removed and replaced by the Publish & Lock / Reopen action).
- Affected code:
  - `apps/web/src/components/slides/status-slide-deck.tsx` (`HeadSlideArticle`
    frame + fill).
  - `apps/web/src/components/dashboard/lead-summary-table.tsx` (table → card list
    → subgrid-aligned card list).
  - `apps/web/src/components/dashboard/blocked-at-risk-table.tsx` (F4: default
    collapsed).
  - `apps/web/src/components/head/head-report-shell.tsx` +
    `apps/web/src/components/slides/head-slides-client.tsx` (F1: link + plumbing
    removed; slides header now mounts the publish action).
  - `apps/web/src/components/weekly-report/head-publish-lock-action.tsx` (F1:
    new self-contained Publish & Lock / Reopen action for slides mode).
  - `apps/web/src/components/dashboard/dashboard-page.tsx` (UAT follow-up: the
    "Revoke All" + "View Status Report" header buttons drop from 44px to the
    standard `--toolbar-control-h` 32px so they match every other control).
  - `apps/web/src/components/weekly-report/product-accordion.tsx` (F2: escalation
    folds into Risks, dedup extended to risks).
  - Tests re-targeted/added across the above (`*.test.tsx`).
- Not changed: print template, lead components.
- Branch / sign-off: implemented on `change/head-design-review-2026-06-24` as a
  DRAFT PR for live review — nothing merges to `main` without the user's eye, per
  the established "approve restyles in a live browser" pattern. Before/after
  captured under `docs/head-design-review-2026-06-24/`.
