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

## Open Questions (decisions needed — NOT implemented)

These three were ambiguous or destructive; left for the user with a recommended
default rather than guessed at overnight.

- **F1 — "Open focused report" in slides header.** The user questioned its
  purpose in slides mode (verbatim, garbled: "Чего эта кнопка? … это смысла не
  вижу"), contrasting it with the edit-mode submit. It is the slides-mode
  drill-into-the-focused-report link (`head-report-shell.tsx:284`), recently
  moved to the header line. **Recommendation:** keep but clarify — relabel to its
  destination, or only surface it when a focused-report target resolves.
  _Decision needed: keep / relabel / remove._
- **F2 — "Needs Attention" banner in ProductAccordion.** The user did not
  understand it (verbatim x2: "а это что такое?", "это что не понял"). It is the
  `showNeedsAttention` banner (`product-accordion.tsx:423`), already suppressed
  when its text duplicates an item row. **Recommendation:** clarify the label /
  source, or fold it into the Risks treatment. Do not remove blindly.
  _Decision needed: relabel / rework / keep._
- **F4 — "Blocked & At Risk" table on the dashboard.** The user thinks it is not
  needed ("это не надо, потому что атака будет дальше, вместе") because the same
  risk content appears in the report. Verified: it is **real** data
  (`mapDashboardData` → `blockedAtRisk`), not mock — only the TS type is imported
  from `mock-data`. It currently defaults to expanded. The user also likes its
  styling (it is the F5 reference). **Recommendation:** keep as the dashboard's
  fast triage view but default it collapsed, OR drop it in favor of a count on
  the KPI card. _Decision needed: keep-expanded / keep-collapsed / remove._

## Impact

- Affected specs:
  - `head-slide-density` (ADDED: the inline head slide renders within a fixed
    slide frame).
  - `head-dashboard-clarity` (MODIFIED: the Period Summary card-idiom requirement,
    sharpened to BlockedAtRiskTable parity).
- Affected code:
  - `apps/web/src/components/slides/status-slide-deck.tsx` (`HeadSlideArticle`
    frame + fill).
  - `apps/web/src/components/dashboard/lead-summary-table.tsx` (table → card list).
  - `apps/web/src/components/dashboard/lead-summary-table.test.tsx` (re-target to
    the card structure; same assertion intent).
  - `apps/web/src/components/slides/status-slide-deck.test.tsx` (head frame
    assertions).
- Not changed: F1/F2/F4 code (decisions pending), print template, lead components.
- Branch / sign-off: implemented on `change/head-design-review-2026-06-24` as a
  DRAFT PR for live review — nothing merges to `main` without the user's eye, per
  the established "approve restyles in a live browser" pattern. Before/after
  captured under `docs/head-design-review-2026-06-24/`.
