# Lead-demo feedback batch — 2026-06-19

## Why

A live lead-demo session (Василий И., `/lead/report/...?mode=slides` and the edit
pipeline) produced four UI refinements. This change captures them at proposal
altitude — autonomous capture while the reviewer is away — so the settled ones
can be implemented and the unsettled ones triaged in ONE place on return. Two
items are confirmed (measured / unambiguous); two carry explicit
`NEEDS-CONFIRM` / `ASSUMPTION` tags and get no firm spec requirement until the
reviewer confirms.

Related: the affordance revert (`revert-foreign-tags-affordance` branch, commit
`96e59851`, not yet merged) lands together with this batch ("вместе с
остальным").

## What Changes

### 1. Slide hero geometry parity across scopes — CONFIRMED (measured)

In `?mode=slides` the lead hero (status strip + scope toggle) sits at a different
position depending on the scope toggle, so toggling Summary↔Product visibly
shifts the controls ("не 1к1"). Measured at 1728×996, same `.slide-frame`
(x=320):

|                | Summary (own) | Product | Δ     |
| -------------- | ------------- | ------- | ----- |
| hero row X     | 333           | 345     | +12px |
| hero row Y     | 254           | 266     | +12px |
| hero row width | 1062          | 1038    | −24px |
| scope toggle X | 1236          | 1224    | −12px |

Cause: the two scopes render `LeadSlideHero` through different wrappers — own
scope via `ReportSlides → StatusSlideDeck → LeadSlideArticle` (inner inset
~13px), product scope directly inside an `article.slide-frame p-6` (inset ~25px).
**Change:** render the hero at the same horizontal/vertical inset in both scopes
so toggling never shifts the status strip or scope toggle.

### 2. Collapsed `+N more` indicator: styled hover tooltip — CONFIRMED

`SdlcPipeline`'s `+N more` collapsed-stages indicator (Mine mode) reveals the
hidden stages only via the native `title` attribute (slow, unstyled), while the
stage chips beside it use the instant styled `useSdlcTooltip` portal. **Change:**
the indicator reveals the hidden stages' names+statuses through the same
`useSdlcTooltip` so the hover reads identically to the chips.

### 3. Pipeline status legibility — ASSUMPTION / NEEDS-CONFIRM

Reviewer: "подсвечивать, что заполнено, что не заполнено, когда риск, когда
блокер, когда зелёный, когда не заполнено полностью". Inventory of what ALREADY
exists: stage chips color by status (solid = explicitly set, dashed = covered by
own risk, dashed+pulse = empty); the product card has a health left-stripe and an
`N/M Your stages` completeness counter. **Named gaps (assumption):** (a) the
`+N more` indicator is neutral grey — it does not reveal that a hidden stage is
blocked/at-risk; (b) "filled vs empty at a glance" may not be legible enough on
the visible chips. **NEEDS-CONFIRM:** is the ask (a) color the `+N more`
indicator by the worst hidden status (small, folds into item 2), or (b) a broader
filled/empty legibility pass on the chips? No firm requirement until confirmed.

### 4. ComingSoon tooltip consistency — NEEDS-CONFIRM (cause identified)

Reviewer: the Agent-review ComingSoon tooltip "отличается" from other controls;
make Version "по аналогии". Finding: ALL ComingSoon controls (nav theme/language,
lead version/pdf-export, report-toolbar agent-review) already share the identical
`ComingSoonBadge role="tooltip"` group-hover affordance (a guard test pins this).
The likely real difference: `AgentReviewComingSoon` is the ONLY one with a text
label (others are icon-only `h-8 w-8`), so its wider button + `absolute right-0`
badge anchor make the same badge sit at a different offset. Separately, two
tooltip _languages_ coexist app-wide — the dark `sdlc-tooltip` (chips, and item 2)
vs the amber `ComingSoonBadge` — which the reviewer may want reconciled.
**NEEDS-CONFIRM:** the exact control/pixel the reviewer means, and whether the
dark-vs-amber duality is in scope. No firm requirement until confirmed.

## Out of scope

- Implementation of items 3 and 4 until the reviewer confirms their scope.
- The flagship affordance revert (already committed on its own branch).
