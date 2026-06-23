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
so the true lead view needs a lead login — captured separately / noted as a
follow-up; the review focuses on the head surfaces the user named.

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

### `/head/report/{id}` (edit / accordion)

Clean. The Portfolio Overview cards use full status-tinted fills (red/amber/
green) — note the prior pitfall (a whole-row status hue can over-signal); fine as
is. The "Needs Attention" banner inside an expanded product is the user's F2 (he
did not recognize it). **Decision parked (F2).**

### `/reports` (History)

The most consistent surface — soft cards, a 2×2 stat grid in History Summary.
A good internal reference for the target aesthetic (and for what Period Summary
can become).

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
