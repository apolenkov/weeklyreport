# Handoff — Lead Form CRUD audit & wiring

**Date:** 2026-05-01
**Branch:** main
**Status:** 5 unpushed commits ahead of origin (DNS down again)

## Summary of session

User reported that on `/lead/report` (Polenkov as lead) none of the
following worked: Add/Edit/Delete item, Add Risk, Add Decision, Top 3
Priorities slots, blocker badge sync after risk delete. Asked for full
audit.

## What was done

### Audit
Full-app sweep (Explore agent). Verdict: dead UI is **localized to
lead-form** — Head Dashboard, Admin, Weekly Report are all healthy.
Five critical buttons (`+ Add` × 4 + Edit/Delete on ItemCard) had no
handlers and the parent never passed callbacks down.

### Implementation (committed in `e885b76`)
- `current-week-section.tsx`, `next-week-section.tsx` — wired `+ Add`
  via `onItemsChange?.([...items, newItem])`. ItemCard now receives
  `onEdit` / `onDelete` / `isEditing` / `onTextSave`. New items
  auto-open into inline edit-mode (autofocused textarea, Enter saves,
  Esc closes, blur commits).
- `item-card.tsx` — inline edit mode UI.
- `risks-section.tsx` — `+ Add Risk` wired; defaults productId from
  the seed product's `mine` stage. Hidden when products list empty.
- `decisions-section.tsx` — `+ Add Decision` wired.
- `priorities-section.tsx` — refactored to render exactly 3 fixed
  slots regardless of array contents. No Add button — slots are the
  contract.
- `lead-form-sync-bridge.tsx` — `handleRisksChange` now diffs old vs
  new risk counts per `(productId, stageName)` and resets stage to
  `on-track` when count drops to 0. Symmetric with the existing
  additive sync (risk text fill → stage at-risk/blocked).
- `lead-form.tsx` — added `handleCurrentWeekItemsChange` and
  `handleNextWeekItemsChange` factories. Plus pre-existing bug
  fixes uncovered by audit:
  - `handleDecisionsChange` was overwriting-only — silently dropped
    new decisions. Now upserts.
  - `handlePrioritiesChange` was overwriting-only — silently dropped
    rank-2/rank-3 inserts. Now upserts.

### Seed enrichment (committed in `2fed39f`)
Per active section: 3 current items (mix of in_progress/blocked/done),
2 next items, 2 decisions (one with deadline), 3 priorities (filling
all 3 slots). Polenkov gets 2 VersionSnapshot rows so Restore is
testable. Plus full Week-15 published report with 3 lead sections so
"Fill from Previous" has data to copy from.

Counts: `{sections:6, items:21, decisions:6, priorities:12,
versionSnapshots:2}`.

### Empty-row filter (committed in `2fed39f`)
`sectionToDraftPayload` now filters rows whose required text fields
are empty/whitespace-only. Without this, `+ Add Risk` would create a
new empty row → autosave fires after 3s → backend rejects on
`safeText({min:1})` → toast "Save failed". Predicates per row:

- items: `text` non-empty
- risks: `risk AND mitigation` non-empty
- decisions: `text` non-empty
- priorities: `text` non-empty

### Observability (committed earlier in session, `54f48dd`)
- LOG_LEVEL=debug surfaces every Prisma query (with duration), every
  tRPC input/output (4KB-truncated), and every HTTP request.
- tRPC error-mapper now preserves `cause`; middleware logs `cause.name`,
  `cause.message`, `cause.stack`, `causeCode`, `causeMeta`.
- Slow Prisma queries (>=100ms) emit at `warn` regardless of LOG_LEVEL.

This is what immediately exposed the `risks[1].risk too_small` Zod
error the user was experiencing.

## What is NOT yet verified working

After all the above, live-test in Playwright clicked "+ Add Risk"
and **no new row appeared in the UI**. Backend logs show no saveDraft
fired (correct, because empty rows are filtered). But the row should
still appear in local state and render until the user types.

Hypotheses, in order of likelihood:

1. **mapLeadFormData filters new rows** — the round-trip
   `draftSection.risks` → presentation `RiskEntry[]` may filter out
   risks with empty text. Check `apps/web/src/lib/mappers/lead-form.ts`.
2. **Bridge `handleRisksChange` cleared the stage and the new row
   re-mapped to a different productId/stage that the section doesn't
   render** — unlikely but possible.
3. **`handleRisksChange` in lead-form.tsx** — for new items without
   a `tmp-` prefixed id, it generates `id: r.id ?? \`tmp-${...}\``
   but the incoming new risk DOES have a uuid, so it uses that uuid
   directly. The next render's existingById will find it, treat it
   as existing, and not re-create. This should be fine.

**Next session:** start by reading `mapLeadFormData` for risks. If it
filters empty-text rows, either lift the filter or have the section
render its own pre-save buffer.

## Other items deferred

- Push: 5 commits ahead of origin/main, DNS was down on last attempt.
  Run `https_proxy="" command git push origin main` when VPN/DNS work.
- Untracked PNGs from Playwright runs (`.playwright-mcp/*.png` and root
  `*.png`) — should be deleted or git-ignored before next commit.
- Live-test items / decisions / priorities CRUD — were not clicked
  through after the seed enrichment due to the same Add-Risk symptom
  needing investigation first.

## Resume instructions

1. Read this file
2. Check `apps/web/src/lib/mappers/lead-form.ts` — does it filter
   empty risks/decisions/items?
3. If yes, decide: lift filter (let empty rows render) OR maintain
   a per-section local buffer for "in-progress new rows"
4. Once Add Risk renders correctly, full-click-through:
   Add Item, Edit, Delete, Add Risk, Add Decision, Edit Priority,
   Delete Risk → assert blocker badge clears on stage
5. Push when DNS works
6. Delete the leftover screenshot PNGs
