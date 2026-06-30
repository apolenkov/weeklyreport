# Locked decisions — demo feedback grill (2026-06-30)

Single source of truth for every fork answered during the C1–C7 grill (with Саша).
Specs are authored from THIS. Companions: [grill-notes-c2-c5](./grill-notes-c2-c5-2026-06-30.md),
[annotations-triage](./annotations-triage-2026-06-30.md), [demo](./demo-2026-06-30.md).

## C1 — Review & acknowledgement (spec DONE: `openspec/changes/review-acknowledgement/`, strict-valid)

- Reviewer = capability, not role. Ack (any access-holder) / verdict+per-record-comment (designated `canReview`). `changes_requested` auto-un-submits, race-safe via `judgedVersion`. In-app only.
- **Head default view = submitted-only + anti-empty-state guard** (LOCKED — same as viewer; not "head sees all").
- Submitted/all toggle on the live current period only; published snapshot as-is.

## C2 — Unified quick entry + carry-over

- **Opt-in storage = ORG `AppSettings` flag** (head flips for the department) — _not_ client-only, not per-lead. Needs a settings flag + read path.
- **No `failed` state** — buckets done / in-progress / blocked / planned-next / deferred, all derived; presentation projection, physical `current|next` storage preserved (ADR 0011 candidate).
- Quick-add requires a stage tap (pre-select when the lead owns exactly one) — keeps the ≥1-stage invariant (default).
- Carry-over trigger = head one-click "Copy forward unfinished" on period open (default); NOT auto. C2 does NOT touch the carry-over write path — **BLOCKED-until-`fix-carryover-persistence` merges**.
- "blocker" quick-type = current `Item` `workflowStatus=blocked` (no new model). "move" actions mutate in place (same `Item.id`).
- New procedures (if any) on `leadProcedure`. Bucket function total+deterministic with explicit precedence; drop "deferred=carriedOver" (carriedOver means arrived-as-current). `period-dual-state` is NOT a reader of `Item.type`.

## C3 — Project activity (non-SDLC unit)

- **Admin-provisioned** (like products) — `projectActivity.*` admin procedures (NOT `activity.*` — that namespace is taken by the live feed).
- **Activity↔lead = M:M** (a `ProjectActivityLead` join) — multiple leads report on one activity; each writes their own `ActivityStatus` (per `reportSection`), like `ProjectStatus`.
- **No product-health rollup** — activity status shown beside the product, independent; preserves the stage-driven health invariant (ADR). Activities also do NOT feed portfolio totals or escalations in v1.
- `ProjectActivity{ id, name, groupId(req, authoritative), projectId?(optional, label only), jiraAccounts String[] }`; `ActivityStatus{ reportSectionId, activityId, status TrafficLightStatus?, note? }`, unique `(reportSectionId, activityId)`, seed `green` per attached activity at provisioning.
- `ActivityStatus` is a pure section child row (read through the section author); constrain `activity.groupId == author.reportingGroupId` / attachment at write; validate written `activityId` is attached/seeded for the section (close the `saveSection` trust gap). Add `activityStatus` to `period-dual-state`'s "lead save writes these rows only" list. Activities not searchable in v1.

## C4 — Slide priority ordering ⚠️ stub root-cause was a MISREAD

- The `?? 0` sites are DEAD (pre-filtered); `priorities[]` is rendered nowhere. **Real bug:** P{N} chips on Current/Next render in insertion order (P3 above P1).
- **Fix = sort the chips in place** (float ranked to top of Current/Next, ascending, nulls-last, stable) in `buildUnifiedSlideModel`; reuse `product-accordion.tsx:101 sortByPriority`. Delete the dead `priorities[]` + 3 dead sorts (exemplary). TDD snapshot. Best-effort over possibly duplicate/gapped ranks.
- Ordering scope: confirm global-within-quadrant vs per-product-block (defaulting per-product-block — consistent with the product-grouped idiom everywhere else; revisit if Саша wants a clean P1→Pn column). MODIFIED `lead-slide-quadrants` + `head-slide-density`.

## C5 — Mobile / compact layout

- **Viewport floor = MIXED**: dense surfaces (slides, dashboard) tablet ≥768; lead form + review surface phone ≥360.
- Compact reach = viewport-only for MVP (desktop density unchanged beyond light trim); no density toggle (default).
- Slides on a narrow viewport: with the tablet floor, slides are ≥768 (tablet+); below that the report (non-slide) view is the mobile experience — **no phone slide idiom for MVP** (default; revisit only if the floor drops). ADR only if a document-fallback is later chosen.
- New `responsive-compact-layout` (R1–R6); MODIFIED `ui-control-density`, `head-slide-density` (keep exact header "The inline head slide renders within a fixed slide frame"), `lead-slide-quadrants`, `head-dashboard-clarity`, `record-dialog-layout`, `toolbar-polish`. R6: C1 review surface born responsive (comments stack under anchor, no side rail).

## C6 — Lead-form stage-access integrity + default mine-only (NEW; has a real server BUG)

- **Server integrity bug (confirmed):** `saveDraft` does NO content validation; `submitSection` runs only `validateSubmitInput`; `stageNames` is persisted verbatim (denormalized, no FK). A lead CAN currently write a record into a stage they don't own.
- **Fix = shared pure server guard** `validateStageOwnership(section, input)` on BOTH `saveDraft` and `submitSection`. Compare canonical stage names per `projectId` vs the server-loaded section's `ownedStages` (StageAssignment-derived; `stageNamesMatch` for Dev/Development alias).
- **Posture = grandfather new/changed rows + HARD-REJECT** (`BAD_REQUEST` `STAGE_NOT_OWNED`) — per-row-id diff; unchanged legacy/cross rows grandfathered (preserves `fix-lead-surface-name-resolution`).
- Guard scopes to the **section author's** owned stages even when head/admin edits on-behalf (default — else the hole reopens). `productId` axis is subsumed (no owned stage on P ⇒ `ownedStages(P)` empty ⇒ any stage on P fails).
- **Route to `risk-stage-integrity`** as a MODIFIED/ADDED ownership requirement (NOT a fresh ADR) — it already requires _a_ stage but not an _owned_ one; avoid header-collision with in-flight `fix-risk-stage-integrity-impl`. Extend the zero-owned-stage "disable Save + inline notice" (specced for risk dialog, not implemented) to item + decision dialogs. Single owned stage → pre-select + lock the chip (currently silent at save).
- **Default mine-only is ALREADY the hard default** (`use-record-visibility.ts:74`, per `{userId, reportId}`); gaps = a spec home (`report-toolbar-parity`) + keep the existing `RecordVisibilityToggle` as the canonical show-all (do NOT add a second control). `period-dual-state` + `role-coverage-gate` respected (child-row guard inside the existing lead write procedure; no new chain/Role).

## C7 — Head-surface parity & declutter (NEW)

- **ProductKpiCard = SLIM** to a compact single-row strip (Submissions / Deadline / Risks & Blockers) — keep the signal, shed the space.
- **ScopeToggle = no change** — "share one idiom lead+head" is already achieved by the shared `SegmentedToggle`; no literal restyle (would reverse a shipped decision).
- Remove "Group Status Slides" redundant header; move slide/report toolbar controls to the top like the lead deck; remove the "Present" button (slides mode supersedes); clarify/cut the ReadinessStrip; Agent-review into the period-nav row. Reflow / duplicate-header (`mqqe419t`/`mqqe3llq`) = **verify on a fresh build first**; if it persists it's a whole-header positional-stability requirement (home where header composition is governed, not toolbar-semantics). MODIFIED `report-toolbar-parity`, `head-toolbar-semantics`, `head-slide-density`, `head-dashboard-clarity`, `toolbar-polish`.

## Confluence

- The page Саша asked for is a **PRODUCT description page** (what CustomReport is / how it works), NOT the review-process doc (already drafted) and NOT a feedback-collection form. → write a product-overview draft.

## ADR numbering

Next free = 0011 (0009/0010 are C1). Assign as written: C2 projection, C3 (no-rollup + own-entity + M:M-attachment), C5 (only if slide document-fallback chosen later).
