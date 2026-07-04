# Design — lead-report-surface-polish

No schema change. Five of six items are pure presentation; one (HF10 carry-over)
is a backend behaviour change over the existing tables. The hard, hard-to-reverse
decisions are HF10 (trigger point) and HF1 (interpretation); the rest are
recorded so a reviewer knows what was deliberately left alone.

## D1 — Slide grouping is lead-only; the head parallel is intentionally left

Annotations A1/A2/A4 change the LEAD slide only (`LeadUnifiedSlide` +
`buildUnifiedSlideModel`). The head deck has a parallel per-row product badge
(`HeadSectionCard` / `headProductBadge` in `status-slide-deck.tsx`, governed by
`head-slide-density`). This change does NOT touch it — the head grouping/activity
work is HF2/HF4/HF5, which depend on the M:N activity schema
(`activity-first-class-reporting-unit`) and are out of scope here. A reviewer
seeing the head badge unchanged should read it as deliberate, not a miss.

`buildUnifiedSlideModel` already emits per-product buckets (it iterates
`slide.productSlides` and pushes rows per product, with empty products tracked
separately). Grouping is therefore a RENDER change in `LeadUnifiedSlide`: emit one
heading per product block instead of a badge per row. The `showBadges >1 real
product` gate becomes the `showHeadings` gate; the single-product flat case and
the "Shared context" cross-product label already exist in the model. The existing
overflow machinery (per-quadrant `overflow-y:auto`, the `--slide-quadrant-min`
track floor, and `paginateSectionSlides` at 9 products/page) is unchanged — the
grouping requirement explicitly inherits it, which is why A4 needs no new
overflow mechanism, only a scenario that grouping preserves "no +N more".

A2 "priorities first": the model already floats ranked bullets to the top within
a product via `sortByPriorityRank`. The spec pins that ordering under grouping and
pins the author identity (already shown in `LeadSlideHero`). The stronger reading
of A2 — a dedicated priorities lane above the product-grouped quadrants — is NOT
adopted; see Open Questions.

## D2 — Item-card uniform height (B1) is the real gap; ellipsis/tooltip (B2) is mostly done

`item-card.tsx` already renders `line-clamp-3` + a native `title` on the static
text, and a `min-height: 110`. But the card is a growing flex column
(`flex flex-col` with a `mt-auto` footer), so a long card outgrows a short one —
the cards are NOT uniform. B1 is the substantive change: adopt a fixed reference
height (the empty-state placeholder card) for every card in a section and let the
body text region absorb the difference. B2's requirement mainly PINS the existing
`line-clamp-3` + `title` so a future edit cannot silently drop either half, and
scopes truncation to the static render (the inline edit textarea keeps full text).

Implementation note (not spec): the reference height must clear the tallest fixed
chrome (status pill row + author + stage tags) so the uniform height never clips
those; only the body text truncates.

## D3 — HF6: one reopen surface (reverses reopen-request-lifecycle D3)

Today `AlertBar` renders when EITHER there are missing leads OR
`pendingReopenCount > 0`, and shows a reopen anchor linking to
`REOPEN_REQUESTS_CARD_ID`. `ReopenRequestsCard` shows the same count in its
header plus the actionable queue. HF6 = same info twice. Decision: the actionable
card is the single reopen surface; the alert bar drops its reopen line + its
`pendingReopenCount` query and reverts to lead-submission signals only
(self-suppressing on `pendingLeads.length === 0`). This reverses the deliberate
`reopen-request-lifecycle (D3)` choice that made the bar carry the indicator —
called out in the modified requirement. `alert-bar.test.tsx` + its snapshot and
`dashboard-page.test.tsx` update.

Not in scope: the audit's "extract one `N pending` pill primitive"
(`reopen-requests-card.tsx:97` vs `kpi-cards.tsx:49`) is a separate
design-consistency item, not HF6.

## D4 — HF10 carry-over automation (the load-bearing decision)

**Constraint.** Report sections are provisioned LAZILY: a lead's `ReportSection`
is created at login by `ensureLeadSection`
(`apps/api/src/modules/report-sections/ensure-lead-section.ts`), NOT at
`createPeriodManual` (`period-admin.service.ts`), which mints only the `Report`.
So at period-creation time there is no target section to carry into.
`executeCarryOver` already REQUIRES both source and target sections and throws
otherwise. A naive synchronous carry-over inside `createPeriodManual` cannot work.

**Decision (owner, 2026-07-04) — trigger when the period becomes OPEN, eager
materialization.** The product owner overrode the per-login primary: carried work
must already be present when anyone opens the fresh period, before any lead has
logged in. Resolved design (two-model council: Codex + deep-reasoner, synthesized):

- One orchestrator, `carryOverIntoOpenedPeriod(deps, targetReportId)`
  (`apps/api/src/modules/carry-over/auto-carry-over.ts`, plain function over
  explicit deps, house style of `ensureCurrentPeriod`/`flipDueScheduledToOpen`).
  Order: previous-report lookup (none → no-op) → execution-dedupe short-circuit
  (cheap indexed read before any heavy work) → prior-period author roster
  (empty → no-op, which is what keeps `executeCarryOver`'s "requires both
  sections" throw off the auto path) → materialize each author's target section
  via `ensureLeadSection` → whole-report `executeCarryOver` verbatim. It never
  rejects: failures log loudly and are swallowed so no caller is aborted.
- NO per-author execute variant: `executeCarryOver` already skips source authors
  without a matching target section, so pre-materializing the roster and running
  the whole-report execute once reuses the engine untouched.
- Roster = distinct prior-period section authors filtered to `User.isActive`.
  This preserves the manual path's effective semantics (a deactivated lead never
  logged in, so their target section never existed and nothing was carried).
- **Scheduled-born periods must NOT carry at creation** (Codex): their source
  period is still being edited all week, and firing early would snapshot it
  mid-flight AND burn the `(source,target)` dedupe key with no second chance.
  Only a `periodState === "open"` period triggers.
- Three seams, all best-effort try/catch: (1) login `provisionLeadWorkspace`
  (`main.ts`) — unconditional call; the dedupe short-circuit makes every later
  login a free retry; (2) scheduler `runOnce` — a reconcile loop over ALL
  `periodState=open, periodStatus=open, archived=false` periods each tick, which
  covers scheduler-created periods, every row `flipDueScheduledToOpen` flipped
  (it can flip several per tick), and yesterday's transient failures;
  `periodStatus=open` excludes reopened periods — a reopen amends a published
  period and must not re-trigger carry; (3) manual admin create (tRPC
  composition layer) — fires only when the returned `periodState` is `"open"`;
  a future-dated manual period is minted `scheduled` and is picked up by the
  scheduler loop at flip time.
- Known accepted gaps: a backfilled period carries from its chronological
  predecessor (`findPreviousReportId` verbatim) and does not retroactively
  re-carry a successor whose dedupe key is burned; an author added to the prior
  period after its carry ran gets nothing (seed-once semantics).

**Non-negotiables (in the spec, not just here).**

- Write-integrity guard holds: editable target only (open/reopened, not
  archived), never overwrite a `submitted` section. A freshly-provisioned section
  is an empty draft, so the guard passes; it still protects the reopened/edited
  edge.
- Idempotency holds: the `@@unique([reportSectionId, stableId])` lineage skip
  (already in `executeCarryOver`) plus the `(sourceReportId, targetReportId)`
  execution dedupe make a re-run a no-op. This is what makes triggering at
  provisioning safe against a second login.
- Reverses the documented "carry-over stays a conscious head action" decision
  (the `CarryOverBanner` comment). Explicit in the spec.

**Banner + procedures.** `CarryOverBanner` and its `weekly-report-page.tsx` mount
are removed; `carry-over-banner.test.tsx` is deleted. The `carryOver.execute` and
`carryOver.uncarried` tRPC procedures are BOTH deleted (no web caller remains;
the auto path calls the service directly), along with the dead
`carry-over.router.ts` wrapper, `listUncarriedOpenWork`, and the
`carry-over-uncarried` module + shared type. `executeCarryOver` (the engine) and
`findPreviousReportId` stay — the automation is their only consumer.

## D5 — HF1: plain reading, relocate not gate

HF1 = "move the review-acknowledge button into publish-and-lock". Taken plainly:
relocate the head/admin acknowledge control from the standalone `AcknowledgeSurface`
band (rendered in the report body above the overview) into the Publish & Lock
action cluster on the header line, so review→acknowledge→publish reads as one
sequence. Deliberately NOT adopted: making acknowledgement a publish precondition,
or adding an acknowledge step inside the publish confirm dialog — that over-reads a
one-line walkthrough note and would be a new gate on a critical action. The
acknowledge mutation, per-group model, and "Seen by" roster are unchanged.

## Open Questions

1. **HF10 trigger point — RESOLVED (owner, 2026-07-04).** Trigger when the period
   becomes open, with eager materialization of the prior-period authors' sections;
   no per-author `executeCarryOver` entry point. Full decision recorded in D4.
2. **HF1 non-publisher acknowledge path — RESOLVED (2026-07-04).** Only the
   publish-capable reviewer's control moves: head/admin acknowledge from the
   Publish & Lock cluster (`placement="header"`); a viewer keeps the in-body
   band (`placement="body"`) — relocating it into a cluster the viewer does not
   have would orphan their acknowledge path. Mutation, per-group model, and
   "Seen by" roster unchanged.
3. **A2 strength.** Is "priorities first" satisfied by ranked-records-float-to-top
   within each product group (adopted), or does the user want a dedicated
   priorities lane above the product-grouped quadrants (rejected here as scope
   creep)? Confirm on the live slide.
4. **HF10 dead-read cleanup — RESOLVED (2026-07-04).** `carryOver.uncarried` and
   `carryOver.execute` are both deleted with the banner (no caller remains); a
   future "what carried" view would be a new feature, not this cleanup. See D4.
