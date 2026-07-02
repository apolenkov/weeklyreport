# Design — record-status-derived-from-risk

## Context

`status-risk-unification` already solved "risks are the single source of truth
for at-risk/blocked" for **stage chips**: the raw read-model status is one layer,
the displayed chip is floored at render from covering risks
(`deriveEffectiveStageStatus`, `applyRiskSeverityFloor`,
`floorSlideStageStatus`), setting an alarm routes through risk creation, and
lowering a covered chip requires confirmed risk removal. The item card is the one
surface still authoring the alarm free-hand
(`item-edit-dialog.tsx` `CURRENT_WEEK_CHOICES` has a "Blocked" chip; the
quick-add "blocker" opens that dialog with `blocked` preset). This change applies
the SAME established pattern to the item card. The point of maximum reuse — not a
new mechanism — is the guiding constraint.

## Decision 1 — Coverage rule (item ↔ risk)

An item is COVERED by a risk when all hold:

- same `ReportSection` (`reportSectionId`),
- same product (`Item.projectId == Risk.projectId`),
- stage overlap: `Item.stageNames ∩ Risk.stageNames ≠ ∅`, **OR** the risk's
  `stageNames` is empty.

An empty `Risk.stageNames` is the canonical wildcard "covers all of the author's
assigned stages on that product" (`escalation-types-and-flagged-red-rollup`), so
it covers the item regardless of the item's stage. An item with empty
`stageNames` is a stage-less legacy anomaly (`risk-stage-integrity`: loud, never
disguised) — treated as covered by any same-product risk so its alarm is never
silently under-reported.

The displayed alarm = highest covering severity, `blocked > at-risk`, via a new
shared helper `deriveItemAlarmFromRisks` in `apps/web/src/lib/mappers/lead-form.ts`,
a sibling to `deriveEffectiveStageStatus`. The item card
(`item-card.tsx`) reads that helper instead of `item.status` for the alarm pill.
`at-risk` becomes a display-only item alarm (there is no stored `at-risk` item
status today and none is added).

**Eligibility — only in-progress items are floored.** A `done`/completed item
and a `planned` next-week item are NEVER floored to an alarm. A covering risk is
about in-flight work on the stage, not finished or not-yet-started work — without
this exemption a completed item on a risk-covered product renders "At Risk",
which is wrong. This is a concrete case in the seed data: `mock-data.ts` `cw2` /
`cw4` are **completed** and stage-less on CRM Platform, which carries the at-risk
risk `r1`; the stage-less wildcard would otherwise floor them. So the helper
gates on `workflowStatus === in_progress` before applying the roll-up.

**Granularity — stage-grained flooding (OPEN QUESTION).** Coverage is keyed by
stage, but a stage holds MANY items while a stage chip holds one status. So one
risk floors EVERY co-located in-progress item on that product/stage — a completed
item sits un-floored next to an in-progress sibling that the same risk marks
blocked. That is the intended "the pill colours ARE the risk/blocker roll-up"
reading, and it reuses the existing section+product+stage coverage model (the
same keying the escalation builder and stage chips already use). But D2's literal
"if an item HAS a risk/blocker" leans per-ITEM, which the current data model
cannot express without a new `Item → Risk` link (rejected below). The blast
radius — one risk locking several items — is surprising enough that the owner
should confirm stage-grained is the intended granularity (open question 3).

## Decision 2 — Stored representation: THE FORK (needs sign-off)

Both options satisfy every behavioral requirement (derivation, lock, roll-up,
route-through-creation). They differ only in what `Item.workflowStatus` stores.
The muddy middle — "keep a free stored `blocked` and floor the display" — is
rejected: it lets a lead free-store `blocked` (violating derived-not-free) or
makes the stored reader disagree with the UI. Pick one clean option.

### Option A — derive-only (RECOMMENDED)

- `Item.workflowStatus` stores progress only: `done` / `in_progress` (next-week
  items are `planned` via `ItemType`). `blocked` leaves the writable set.
- The alarm is purely a render-time roll-up of covering risks.
- `ItemWorkflowStatus.blocked` is REMOVED from the Prisma enum and the Zod mirror
  (`packages/shared/src/schemas/section.schema.ts` `itemWorkflowStatusSchema`) —
  satisfying `enum-state-hygiene` ("every persisted enum value has a writer or is
  removed"): with no free-blocked writer, a lingering `blocked` value would be a
  dead state.
- The escalation `blocked` type is re-sourced from blocked-severity risks
  (Decision 4).
- **Cost:** reverses two locked 2026-06-30 decisions (blocker = item
  `workflowStatus=blocked`; escalation `blocked` from the item) and touches the
  enum + Zod + every stored-`blocked` reader. This is the single-source-of-truth
  end-to-end and the exemplary target, but it is a hard-to-reverse decision — it
  is the headline open question.

### Option B — keep `blocked` stored + write invariant

- `Item.workflowStatus` keeps `blocked`, but a stored `blocked` is valid ONLY
  when a covering blocked-severity risk exists; the write path enforces it and
  the migration backfills it. No enum change; stored readers keep working.
- **Cost:** stored-vs-derived redundancy (the risk is the truth, the stored
  `blocked` a cache that must be kept in lock-step), and the escalation
  double-count (Decision 4) must be deduped in the builder rather than removed by
  construction.

**Recommendation: A.** It is the only option that makes risks the single source
of truth end-to-end and removes the redundant stored alarm, matching the
repo's exemplary posture. B is the smaller diff and reverses no locked decision;
a human picks A vs B before implementation (open question 1). The spec
requirements are written to hold under either — only this design decision, the
enum change, and the escalation reconciliation mechanism differ.

## Decision 3 — Migration / backfill (heal, don't drop)

No production point exists yet — under the MVP invariant
(`CLAUDE.md` MVP Phase, memory `mvp-commit-push-main-preauthorized`) databases
are disposable and reshaped via `prisma migrate reset`. So the "backfill" is
primarily **seed alignment** plus a forward migration, not a prod data
migration. Still specify it so intent is durable and any later real data is safe:

For every `Item` with `workflowStatus=blocked` that has NO covering
blocked-severity risk in its section/product/stage:

1. Synthesize a covering `Risk` (`severity=blocked`) in the same `reportSectionId`
   / `projectId` / `stageNames`, with placeholder impact/mitigation text flagged
   for lead review (schema requires non-empty `impact`/`mitigation`).
2. Under Option A, set the item's `workflowStatus` to `in_progress` (the blocked
   signal now lives on the synthesized risk); under Option B leave it `blocked`.

Heal-to-preserve is chosen over collapse-to-progress so a real blocked signal is
never silently lost. Seeds (`prisma/seed*`) are updated so no seeded item uses a
bare `blocked` without a covering risk — otherwise the display floor would
collapse it and the seeded surface would look wrong.

## Decision 4 — Escalation reconciliation (both options touch it)

`buildEscalationsFromReadSections` (`published-report-snapshot.ts:273`) emits the
`blocked` escalation from stored `item.workflowStatus === "blocked"`.

- **Option A:** stored `blocked` disappears → that source goes dead. Re-source
  the `blocked` escalation from blocked-severity risks so blocked work still
  escalates; a blocked-severity risk yields ONE escalation, not a `blocked`
  (item) + `unresolved_risk` (risk) pair.
- **Option B:** every displayed-blocked item forces a covering blocked risk →
  the builder would emit `blocked` (item) AND `unresolved_risk` (risk) for the
  same problem. The existing product-level dedup
  (`escalation-types-and-flagged-red-rollup`) does NOT collapse these (different
  types). The builder must dedupe a blocked item against its covering blocker.

Either way the builder changes. This change may land the item-card behavior and
DEFER the builder reconciliation to a tightly-scoped follow-up
(`reconcile-blocked-escalation-source`) IF the follow-up ships before this
change archives — but the requirement and its scenario stay here so the coupling
is not lost. Recommendation: land it together under Option A (cleaner, no dedup
bookkeeping).

## Decision 5 — UI approach

- `item-card.tsx`: the alarm pill reads `deriveItemAlarmFromRisks`; when covered
  it renders the derived severity (token-derived per `status-color-semantics`:
  blocked = `--color-status-blocked-bg`/`--color-destructive`, at-risk =
  `--color-status-at-risk-bg`/`--color-status-at-risk-fg`) and a lock affordance
  (tooltip/inline note): "Resolve the covering risk/blocker to change this
  status." Foreign coverage names the other author.
- `item-edit-dialog.tsx`: drop the free `blocked` chip from
  `CURRENT_WEEK_CHOICES`; when the lead picks an alarm on an uncovered item,
  route to the risk dialog prefilled (product + stage + severity), reusing the
  stage-chip interception path. For a covered item, show the locked message in
  place of the alarm chips.
- `quick-add-button.tsx`: the "blocker" entry opens the risk (blocker) dialog
  with severity `blocked`, not the item dialog.
- UI strings stay English (`CLAUDE.md`): "Resolve the covering risk/blocker
  first", "Status is set by the covering risk/blocker".

## Load-bearing invariants named

- **Single source of truth for at-risk/blocked** now spans stage chips AND item
  cards (`status-risk-unification` gains the sibling requirement).
- **Raw vs displayed layers** — stored `workflowStatus` is progress intent; the
  displayed alarm is the covering-risk roll-up. They must not disagree; the
  no-unbacked-stored-alarm invariant + the migration guarantee it.
- **Period dual-state / role-coverage gate** (`CLAUDE.md`) are untouched — this
  change adds no new tRPC procedure and no new period-state field; it derives at
  render and (Option A) trims one enum value on the existing saveSection path.

## Tradeoffs

- Reusing `deriveEffectiveStageStatus`'s shape keeps one derivation mental model
  across chips and cards; the cost is a small new helper and threading covering
  risks into the item render (the section already loads both).
- Option A's enum trim is a wider blast radius but removes a whole class of
  stored-vs-derived drift; Option B is smaller but perpetuates the cache.
- Reversing the locked "blocker = item" decision changes how leads think about a
  blocker (now a risk row, entered via the risk dialog). This is a UX shift the
  human must accept — surfaced as open question 2.

## Alternatives rejected

- **Free stored `blocked` + display floor (muddy middle):** internally
  inconsistent (see Decision 2).
- **A new explicit `Item → Risk` FK link:** the codebase keys coverage by
  section + product + stage (matching stage chips and the escalation builder); a
  new FK would fork the coverage model and duplicate the wildcard-stage rule. Not
  worth it.
- **Collapse legacy unbacked `blocked` to progress at render:** silently drops a
  real blocked signal; heal-to-preserve chosen instead.
