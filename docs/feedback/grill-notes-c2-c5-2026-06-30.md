# Grill notes — C2–C5 (2026-06-30)

Durable capture of the parallel grill homework (12 agents: understand → design tree
→ adversarial verify) for clusters C2–C5. Each cluster's design was adversarially
verified; the corrections below are folded in. This is the resume point for the
interview + spec authoring. Source of truth for decisions once the must-ask forks
are answered. Companion to [demo-2026-06-30.md](./demo-2026-06-30.md).

> All four designs came back **ASSESSMENT: NEEDS-REVISION** — the verify passes
> caught real holes (recorded per cluster). The recommendations already incorporate
> them.

---

## C2 — Unified quick entry + carry-over

**Repo facts that bound the design:** carry-over already ships (`carryOver.execute`
on `headProcedure`, hardening owned by the separate `fix-carryover-persistence`);
`enum-state-hygiene` forbids a declared enum value with no writer; `itemInputSchema`
requires ≥1 stage + `projectId`; `validateSubmitInput` needs ≥1 current item/project;
carry-over filter keys on `item.type==="next" && !carriedOver`.

**Locked recommendations (low-stakes, defaulting):** one quick-add entry point that
opens the EXISTING per-type dialogs (no new editor); "blocker" = current `Item` with
`workflowStatus=blocked` (no new model); unified section is a **presentation
projection** over `type/workflowStatus/completed/carriedOver` — **no new enum
state**, physical `current|next` storage preserved; classic two-section format stays
the DEFAULT, unified is opt-in; per-item "move" = in-place mutation (same `Item.id`,
never clone — so C1 `RecordComment` anchors survive by C1's edit-persist rule);
quick-add keeps all write invariants (stage+project on item, stage+product on
decision). New procedures (if any) ride `leadProcedure`.

**Adversarial corrections folded in:** bucket function must be total+deterministic
with explicit precedence (fields aren't orthogonal); drop "deferred=carriedOver"
(`carriedOver` means "arrived from last period as current", NOT deferred);
`period-dual-state` is NOT a reader of `Item.type` (only submit-gate + carry-over
filter are); decision fast-path needs stage AND product; carry-over dependency is a
hard **BLOCKED-until-`fix-carryover-persistence`-merges**, not a soft depends.

**MUST-ASK FORKS:**

- **C2-1 Opt-in scope:** client-only (localStorage) / per-lead column / org `AppSettings` / per-group. _Rec: client-only — it's a pure presentation projection, zero data impact = smallest experiment slice._
- **C2-2 "failed" state:** drop/fold-into-blocked / real `failed` enum (writer+test) / UI-only tag. _Rec: drop — `failed` has no carrier; adding it trips enum-state-hygiene._
- **C2-3 Quick-add minimum vs mandatory stage:** require a stage tap (pre-select when lead owns one) / stage-less draft / default all owned stages. _Rec: require a tap, pre-select single — keeps the ≥1-stage invariant honest at 1 tap._
- **C2-4 Carry-over trigger:** head one-click on period open / fully auto on period creation / per-lead self-serve. _Rec: head one-click (engine already head-manual) — auto is the only high-blast option._

**ADR-worthy:** "Unified activity section is a presentation projection, not a storage reshape."

---

## C3 — Project activity (non-SDLC unit)

**Recommendations:** new `ProjectActivity` + per-period `ActivityStatus` child rows
(do NOT reuse Item/Risk — they require ≥1 stage); status = nullable
`TrafficLightStatus` (on-track/risk/block) + optional note; required authoritative
`groupId`; single owner `leadId`; optional `projectId?` (match Item/Risk FK naming,
not Decision's `productId` outlier); `jiraAccounts String[]` plain text (no
integration); fold activity-status writes into the existing lead section-save under
`ReportSection.version`; seed one default status per owned activity at section
provisioning; include activities in `publishedSnapshot` with read tolerance for old
snapshots.

**Adversarial corrections folded in (critical):**

- **Namespace collision — `activity.*` ALREADY EXISTS** (`trpc.router.ts:2503`, the live-status feed). Use **`projectActivity.*`** for admin CRUD.
- **Root hole — section-scoped vs group-scoped picked inconsistently.** Decide ONCE: `ActivityStatus` is a pure section child row (read through the section author like `ProjectStatus`); constrain `activity.groupId == owner.reportingGroupId` at write; validate each written `activityId` is owned-by/seeded-for the section (the `saveSection` delete-then-recreate trusts client `projectId` with no `leadId` check — same gap would let a lead write a foreign-group activity status).
- `period-dual-state` IS touched — append `activityStatus` to its "lead save writes these rows only" enumeration.
- Activities do NOT feed `portfolioOverview` totals or escalations in v1 (distinct from the rollup fork).
- Seed `green` (mirror `ProjectStatus`'s `DEFAULT_PROJECT_STATUS`), not null.
- Activities not searchable in v1 (`viewer-published-search` excludes them).

**MUST-ASK FORKS:**

- **C3-A Who provisions activities:** admin (like products) / lead self-service / hybrid. _Rec: admin — clean group scope + cross-period continuity._
- **C3-B Activity↔lead cardinality:** single owner / many reporters (M:M). _Rec: single owner — no stages means one accountable owner; M:M is an additive join later._
- **C3-C Product-health rollup:** none / worst-of (blocked activity drives linked product red). _Rec: none + ADR — preserves the stage-driven health invariant; user may intuitively expect worst-of, so confirm._

**ADR-worthy:** own minimal entity (not reused Item/Risk); (if no rollup) activity status independent of product health; (if single owner) one accountable owner per activity.

---

## C4 — Slide priority ordering ⚠️ ROOT CAUSE WAS A MISREAD

**The handed-down fix is a NO-OP.** Verified in code:

1. All three `?? 0` sort sites (`section-slide-utils.ts:188/261/292`) **pre-filter `priorityRank != null`** → the `?? 0` branch is dead; a nulls-last comparator there changes nothing.
2. The sorted `priorities[]` array **is rendered nowhere** on either deck (`lead-unified-slide.tsx:126` "built but not rendered").

**The actual bug:** priority items ride as `P{N}` chips on Current/Next bullets
(`lead-unified-slide.tsx:93`, `status-slide-deck.tsx:141`), and those quadrants
render in **insertion order** — so P3 can sit above P1. Fix belongs in
`buildUnifiedSlideModel` (`section-slide-utils.ts:656`): sort current/next rows by
`priorityRank` (reuse `product-accordion.tsx:101` `sortByPriority`, nulls-last,
stable). Exemplary path: **delete** the dead `priorities[]` array + three dead sorts.
Add a TDD snapshot locking the order. Best-effort over possibly duplicate/gapped
ranks (`priorityRank` is `min(1).nullable`, no uniqueness constraint).

**Spec:** no new capability; MODIFIED `lead-slide-quadrants` + `head-slide-density`
(priority-first ordering within Current/Next). Render-only — no invariant engaged.

**MUST-ASK FORKS:**

- **C4-1 Where do priorities live on the slide:** (a) sort the `P{N}` chips in place (float ranked to top of Current/Next) / (b) render `priorities[]` as a dedicated ordered panel (overrides the locked 2×2 `lead-slide-quadrants` → ADR + bigger change) / (c) both. _Rec: (a)._
- **C4-2 Ordering scope:** global-within-quadrant ascending / per-product-block. _Rec: confirm — the accordion+slides are product-grouped everywhere else, so per-product-block is the consistent idiom; global is the cleaner P1→Pn read. Genuine tradeoff._

---

## C5 — Mobile / compact layout (cross-cutting)

**Recommendations:** fill the existing stub; desktop-down adaptation (not mobile-first
rewrite); reuse Tailwind `sm/md/lg`, `md` = compact↔full boundary (no bespoke
tokens); compact-tier controls floor at `--touch-target-min` (44px); below the slide
breakpoint a slide becomes a **stacked document** (drop the 16:10 frame), both decks;
dashboard count rails reflow to wrapped labeled-value below `md` (it's a card list,
not a table); record dialogs codify the shipped `md:grid-cols-2`→1-col collapse;
report toolbar keeps `overflow-x-auto`; the **C1 review surface is born responsive** —
comments stack under their anchor record at every width, no side rail, no duplicate.

**Spec:** new `responsive-compact-layout` (R1 responsive-acceptance / R2
breakpoint-contract / R3 touch-floor / R4 compact-density / R5 no-horizontal-overflow
/ R6 review-surface-single-layout); MODIFIED `ui-control-density`, `head-slide-density`
(keep exact header "The inline head slide renders within a fixed slide frame" — MODIFIED
matches by exact header), `lead-slide-quadrants`, `head-dashboard-clarity`,
`record-dialog-layout`, `toolbar-polish`. Note: `head-slide-density` carries a
recorded-sign-off + before/after-screenshots gate that any mobile slide change inherits.

**MUST-ASK FORKS:**

- **C5-1 Minimum viewport floor:** mixed (tablet ≥768 for dense slides/dashboard, phone ≥360 for lead form + review) / phone-everywhere / tablet-everywhere. _Rec: mixed — gates whether "slides on a phone" is even in scope._
- **C5-2 How far does "compact" reach desktop:** viewport-only (desktop unchanged) / user density toggle (bigger feature) / globally tighten desktop now. _Rec: viewport-only for MVP._
- **C5-3 Slides on a narrow viewport:** document fallback (stack cards) / keep 16:10 + pinch-zoom / desktop-only-with-prompt. _Rec: document fallback (only if C5-1 puts slides below the breakpoint). ADR-worthy._

**ADR-worthy:** "A slide below the slide breakpoint is a stacked document, not a fixed-aspect canvas" (record after C5-3 answered).

---

## ADR numbering

C2, C3, C4(b), C5 each propose an ADR and several said "0011". Assign sequentially as
written: next free is **0011** (0005 is a renumber gap; 0009/0010 are taken by C1).

## Cross-cluster

- C2 "move to next week" must be in-place (`Item.id` stable) so C1 `RecordComment`
  anchors survive.
- C3 per-record comments on activities are deferred (C1 locked to Item/Risk/Decision);
  C1's per-section verdict still covers a section incl. its activities.
- C4 is render-only; no overlap with C1.
- C5 R6 makes the C1 review surface responsive without touching C1 behavior.
