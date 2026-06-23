# Head-surface design review — 2026-06-24

Agent-driven UAT walkthrough of the head surfaces, reviewed with the
`frontend-design` and Web Interface Guidelines lenses. The user annotated each
surface live (items F1–F5) and then asked for a full review "через спеки" while
away. Implementation of the safe/spec-blessed wins lands on
`change/head-design-review-2026-06-24` as a **draft PR** — nothing merges to
`main` without a live look.

## Environment caveat (read first)

The annotations were captured on a **stale build**: they cited
`product-accordion.tsx:820`, but current `main` has that file at 518 lines. The
running `:3000` is a local `next-server` dev process that DOES serve current
`main` (verified: dashboard structure markers + a clean `status-slide-deck.tsx`
syntax check; the `:435 /app/...` build error in the console history was the
docker container, not local). Every F-item below was **re-verified against
current `main`**, not the stale annotation.

`/lead/report/{id}` as a head user **redirects** to `/head/report` (role gate),
so it was captured under a `role=lead` dev-login instead
(`before-lead-report.png`). See the lead-surface note below.

## Surfaces

Screenshots: `before-*.png` in this folder (full-page, 1728×962). The dark
round badge bottom-left and the `v3.0.2` panel top-right are the Agentation
annotation overlay — dev tooling, not app UI.

### `/head/dashboard` (the emphasized one)

Three blocks present overlapping submission/status data in three different
visual languages:

1. **Submission Activity** (`ActivityLivePanel`) — per-lead, card rows, "X ago".
2. **Period Summary** (`LeadSummaryTable`) — the **same leads** in a dense
   10-column ruled `<table>`.
3. **Blocked & At Risk** (`BlockedAtRiskTable`) — rounded card rows, the
   best-looking block on the page.

The Period Summary table is the visual outlier — square cells, many numeric
columns — against the rounded-card idiom everywhere else. This is exactly the
user's F5 ("оно какое-то квадратное; сделать как BlockedAtRisk") and is already
required by the `head-dashboard-clarity` spec; the implementation just hadn't
caught up. **Fixed (F5).**

Deeper IA finding (recommendation, not implemented): Submission Activity and
Period Summary overlap heavily. Consider merging them into one per-lead block so
the head reads submission state once, not twice.

### `/head/report/{id}?mode=slides`

The active slide card is content-height and floats in a tall viewport with a
large empty band below it — it does not read as a "slide." The **lead** deck
already solves this: its article uses the fixed-aspect `.slide-frame` (16:10) and
flexes content to fill. The head slide did not. This is the user's F3 ("нужна
фиксация слайда типа PowerPoint"). **Fixed (F3)** by parity.

Smaller notes (not implemented): the corner watermark icons in each quadrant and
the metrics capsule (Current/Next/Risks/Priority) vs the quadrant headers carry
some redundancy — candidates for a later "remove one accessory" pass.

Implementation note (F3): the `--slide-quadrant-min` floor is on the grid track
(`auto-rows-[minmax(...,1fr)]`), parity with the lead deck. The autonomous grill
caught that the first pass put the floor on the card (`auto-rows-fr` + card
`min-h`), which let the bottom quadrant row **overlap** the top below ~768px —
fixed here (see `f3-narrow-before-390.png` vs `f3-narrow-after-700.png`). Desktop
(1728px) is unchanged. One inherent property remains, shared with the lead deck:
at very narrow widths (<~768px) the short 16:10 frame still clips the quadrants —
that is the nature of the "fixed PowerPoint slide" the user asked for, not a bug.
Making narrow head slides fully responsive would be a separate user decision.

### `/head/report/{id}` (edit / accordion)

Clean. The Portfolio Overview cards use full status-tinted fills (red/amber/
green) — note the prior pitfall (a whole-row status hue can over-signal); fine as
is. The "Needs Attention" banner inside an expanded product is the user's F2 (he
did not recognize it). **Decision parked (F2).**

### `/reports` (History)

The most consistent surface — soft cards, a 2×2 stat grid in History Summary.
A good internal reference for the target aesthetic (and for what Period Summary
can become).

### `/lead/report/{id}` (the lead's own editing surface)

Captured under a `role=lead` dev-login (`before-lead-report.png`). The generic
dev-login lead ("Lead 1") has no seeded products, so all sections show empty
states — the seed data is assigned to the named leads (Василий И. / Игорь В. /
Мария К.), not the generic login. Design is consistent with the rest of the app:
rounded section cards, clear "Add Item / Add Risk / Add Decision" empty-state
affordances, a Save/Submit header. No new design findings here — the F1–F5
feedback was head-surface-specific. A data-populated lead view would need a
seeded-lead login (follow-up).

## F1–F5 disposition

| Item | Verbatim (garbled)                         | Current-main truth                                                                                                | Disposition                       |
| ---- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| F1   | "Чего эта кнопка? … смысла не вижу"        | "Open focused report" = slides-mode drill-into-focused-report link, moved to header (`head-report-shell.tsx:284`) | Decision: keep / relabel / remove |
| F2   | "а это что такое?" / "это что не понял"    | `showNeedsAttention` banner (`product-accordion.tsx:423`), dedup-suppressed                                       | Decision: relabel / rework / keep |
| F3   | "нужна фиксация слайда типа PowerPoint"    | head slide lacks the `.slide-frame` the lead slide has                                                            | **Implemented** (parity)          |
| F4   | "это не надо … атака будет дальше, вместе" | Blocked & At Risk = **real** data (not mock), redundant with report                                               | Decision: keep-collapsed / remove |
| F5   | "квадратное; как BlockedAtRisk"            | Period Summary still a ruled `<table>`; spec already requires card idiom                                          | **Implemented** (spec + parity)   |

## Implemented in this change

- **F3** — `HeadSlideArticle` gets the fixed `.slide-frame` + fill model.
- **F5** — `LeadSummaryTable` rebuilt as a BlockedAtRisk-style card list.

Spec: OpenSpec change `head-surface-uat-polish` (ADDED head-slide-density frame;
MODIFIED head-dashboard-clarity Period Summary). Before/after in this folder.

## Decisions needed from the user (F1, F2, F4)

Left deliberately un-coded — each is either ambiguous or a destructive removal
that should not be guessed overnight. Recommendations are in the OpenSpec
proposal's "Open Questions". One word each unblocks them.

## Still owed — NOT in this PR

- **Repo cleanup backlog (the session's first ask).** Earlier this session the
  user asked to "убрать лишнее и легаси в репо" and chose "build the removal
  backlog, no deletion." The live UAT flood took over before it was produced —
  this PR does **not** include it. It is still owed: a read-only,
  evidence-backed (codegraph + reference search) list of dead/legacy/superfluous
  code for review, mindful that much "looks-like-cruft" here is intentionally
  parked (ComingSoon, `openspec/deferred`, versions-v2).
- **Data-populated lead view** (see lead-surface note above).
- **Head-slide visual-acceptance set.** `head-slide-density` expects a before/after
  screenshot set across the slide states (one-lead, many-leads, empty-section,
  dense-decisions, fullscreen) for sign-off before archive. Only the one-lead and
  two narrow-width states are captured here — the rest need a live look.

## Autonomous grill (post-implementation, 2026-06-24)

After implementing, an adversarial multi-lens grill (correctness, a11y, spec,
design-taste, completeness) ran over the diff: 9 findings, 6 confirmed, 3 refuted.

Fixed in this PR (objective, owned by this change):

- **F3 narrow-width overlap → fixed.** Moved the quadrant floor from the card to
  the grid track (lead parity), eliminating the bottom-row overlap below ~768px;
  updated the head test + delta spec to match (resolves the card-vs-track
  spec-debt the grill flagged). Verified at 390 / 700 / 1728px.
- **F5 "Submitted" date a11y → fixed.** The table→card conversion had dropped the
  one column-header association (the date became a bare span); added an sr-only
  "Submitted:" label.
- Doc corrections (the track-floor attribution above; this section).

Needs the user (not changed — taste / design decisions):

- **F5 repeated micro-labels (top design call).** Each lead card repeats all six
  count labels (PRODUCTS/CURRENT/NEXT/RISKS/DECISIONS/PRIORITIES) — 18 repeats
  across 3 cards — where the old table labelled them once. The card _chrome_
  matches BlockedAtRisk, but the content is really a 6-tile stat strip, harder to
  scan column-wise than the table was. Recommendation: label the counts once
  (a header row or a single legend) and let the per-card cells carry values only,
  or drop to the 2–3 counts that matter. This is a taste call for the user.
- **Narrow-width head slides** — see the F3 note above (fixed-slide clip vs
  responsive is a user decision).
