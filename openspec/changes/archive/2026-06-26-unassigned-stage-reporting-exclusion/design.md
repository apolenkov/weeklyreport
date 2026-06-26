# Design — unassigned-stage-reporting-exclusion

## Context

Terms follow `CONTEXT.md`: **Stage assignment / unassigned stage** (a stage×
product slot with no assignment is out of reporting) and **foreign-owned stage**
(assigned to another lead, still in the pipeline). The grey "unassigned" chips
exist only because `buildStageGrid` (`apps/web/src/lib/mappers/lead-form.ts`)
maps over all seven canonical `STAGE_NAMES` and marks any stage the author does
not own as `ownership:"unassigned"`. The API never sends vacant stages; slides
(`section-slide-utils.ts` builds from `ownedStages`), the head portfolio
(`stageCount = stageAssignments.length`), product health, and own-input
completeness are already assignment/owned-scoped. So this is a render-set + spec
change, not an aggregate-math change.

## The one real gap — telling "vacant" from "foreign-owned"

The lead read model's `ownedStages` carries only the CURRENT author's stages.
A stage owned by another lead arrives separately via `leadForm.crossAuthors`
(status-only) and only in Everyone mode; today a foreign-owned stage starts life
as a synthesized `"unassigned"` chip and is UPGRADED to `"locked"` by
`applyCrossAuthorStageOverrides` (`lead-cross-author.ts`). If we stop
synthesizing vacant chips, that upgrade seam disappears and foreign-owned stages
have nothing to attach to.

**Decision: expose the product's assigned-stage set on the read model, as
read-only display metadata.** The lead form read model gains, per product, the
set of stage ids that have an assignment to ANY lead on the product.
`buildStageGrid` then builds the grid from THAT set instead of all seven names: a
stage in the set not owned by the lead → foreign-owned (locked) chip; a stage not
in the set → excluded entirely. This is a single source of truth, independent of
Everyone-mode fetch, and removes the fragile "synthesize then upgrade" path.

`stageSet` is strictly DISPLAY metadata. The writable surface stays `ownedStages`:
`saveSection` persists `StageStatus` rows only from `section.projects[].ownedStages`
and MUST continue to. A non-owned stage that appears in `stageSet` is rendered
read-only (locked), and no save/submit path may write a status for it. A
regression test MUST prove a non-owned stageSet chip cannot be persisted as the
lead's status.

Rejected alternative: always-fetch cross-author owners (even in Mine mode) to
learn foreign ownership. Heavier (extra fetch on every Mine-mode load) and still
doesn't give the union across leads cleanly.

## Resolved forks (from the grill + Codex consult)

### There is NO traceability exception — exclusion is assignment-only

Rule, stated once: a stage with no assignment is excluded, full stop. There is
no "keep it for traceability" carve-out — a risk or a persisted status NEVER
keeps an unassigned stage in the set or on screen. An earlier draft had such a
carve-out; it was removed because it was both unnecessary and self-contradictory.
Why removing it is safe:

- Product health folds covering risks only through OWNED stages
  (`deriveEffectiveProductStatus`, `report-sections.prisma-repository.ts`), so a
  risk on a stage nobody owns never drove the traffic light. Excluding such a
  stage changes no health/severity/completeness number.
- A risk that names an unassigned stage still appears in the risk section (the
  risk row names its stage), so the severity is always explained by a visible
  object — without any stage chip.

### Published snapshots are frozen

Exclusion is computed on the live/draft pipeline from CURRENT assignments. A
published report serves its frozen `publishedSnapshot`, which is NOT recomputed —
later assignment edits never rewrite history. Spec scenario covers this.

### Inactive-user assignments still count as "assigned"

An assignment row counts as occupying the stage regardless of the assignee's
active flag. Filtering inactive users is a separate policy and is intentionally
OUT of scope — keep the rule simple (row presence = assigned). Recorded so the
implementer does not silently add an active-user filter.

### Persisted StageStatus for a now-unassigned stage is preserved but NOT a visibility trigger

Removing an assignment does NOT delete the period's `StageStatus` rows — the data
stays (keyed by section×product×stage). But a bare persisted `StageStatus` does
NOT keep the stage in the set or on screen: visibility is assignment-driven only.
The orphaned status row is simply dormant data; it renders again only if the
stage is reassigned (which puts it back in the set). This resolves the
contradiction Codex flagged between "stageSet includes status-referenced stages"
and "a now-unassigned status is not rendered" — only assignment governs the set.

### "Zero assignees" wording

Because `@@unique([stageId, projectId])` allows at most ONE assignment per
stage×product, "unassigned" means "no assignment ROW", not "zero of many". The
spec and copy say "no assignment", not "zero assignees".

## Spec surface touched

`lead-pipeline-card` is amended: ADD the exclusion rule; MODIFY the four
requirements whose language assumed a rendered vacant/unassigned chip (Everyone
mode shows vacant; the collapsed-indicator "unassigned" row; the grey-from-
unassigned severity; the mixed-status reveal). After this change the
`"unassigned"` render category no longer exists — hidden stages are foreign-owned
only.

## Out of scope

- Removing the canonical seven-stage `STAGE_NAMES` list (it stays the catalogue;
  membership per product is now assignment-driven).
- Any admin UI change to how assignments are edited (the editor already
  deletes the row on "-- unassigned --").
- Active-user filtering of assignments (see fork above).
