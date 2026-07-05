# Proposal: edit-slide-item-inline

## Why

On the slide view a lead sees a finished, readable picture of the week — but fixing a typo or a wrong status means leaving the slide, finding the same record in the Edit form, and coming back. The owner asked (slide 1b live-verify, 2026-07-05): double-click a slide row → edit or delete it right there.

## What Changes

- Double-click (and keyboard equivalent) on an own item/risk/decision row in the lead slide grid opens an edit dialog for that record.
- The dialog reuses the lead form's field editors and existing tRPC write mutations — no new write semantics.
- The dialog offers Delete with confirmation.
- After save/delete the slide grid refreshes in place.
- Foreign (co-lead) rows and published/read-only surfaces (head deck in published scope, viewer) stay non-editable — double-click does nothing there.

## Capabilities

### New Capabilities

- `slide-inline-record-editing`: double-click an own record row on the lead slide opens an edit/delete dialog scoped to that record; editability rules mirror the lead form (own records, unlocked section, active period).

### Modified Capabilities

<!-- none: write-path requirements are unchanged — the dialog reuses the lead form's mutations, role-coverage gate and period dual-state behavior as specified today -->

## Non-goals

- No editing from the head or viewer surfaces, and no editing of foreign rows.
- No new mutation endpoints; no changes to submit/publish lifecycle.
- No inline (in-cell) text editing — a dialog, not contentEditable.
- Priority-strip cards and the header are out of scope.

## Impact

- `apps/web/src/components/slides/` — row interaction, dialog host in `LeadSlidesClient`.
- Reuses `apps/web/src/components/lead/` record editors + existing save/delete mutations (stableId lineage preserved — consumers must keep treating stableId as client-authoritative).
- Tests: slides unit tests + a jsdom dialog test; e2e catalog untouched (no new route).
