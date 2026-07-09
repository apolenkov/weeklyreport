# Design: edit-slide-item-inline

## Context

The lead slide grid (`apps/web/src/features/slides/ui/slide-article*.tsx`) is display-only: `GridRow` carries `id`/`stableId`-derived row ids but no record kind or back-reference to the editable record. The lead Edit form already owns field editors and save/delete mutations for items, risks and decisions (currently split across `apps/web/src/features/report-sections/`, `apps/web/src/features/review/`, and `apps/web/src/features/period/`), with editability enforced by section status and ownership. `saveSection` delete-recreates rows, so any dialog must key edits by `stableId` lineage, not raw PK.

## Goals / Non-Goals

**Goals:**

- Double-click an own row on the lead slide → dialog with the record's fields → save/delete through the existing mutations.
- Zero new write semantics; editability mirrors the Edit form exactly.

**Non-Goals:**

- Head/viewer surfaces, foreign rows, priority strip, in-cell editing, new endpoints.

## Decisions

- **Row → record resolution.** Extend `GridRow` with `{ kind: "item" | "risk" | "decision", stableId }` populated by the row builders. The dialog host resolves the live record from the section read model by stableId at open time — the grid stays a pure view model.
- **Dialog host lives in `LeadSlidesClient`.** The deck stays presentation-only; `SlideArticle` exposes an optional `onRowActivate(rowRef)` callback that is undefined on head/viewer decks — that absence IS the read-only guard for foreign surfaces.
- **Reuse, don't fork, the record editors.** The dialog embeds the same field components the Edit form uses; save calls the same tRPC procedure the form would call for that record kind.
- **Keyboard path.** Rows with `onRowActivate` become focusable (`tabIndex=0`, `role="button"` semantics on the li's inner wrapper) and open on Enter — double-click alone is not keyboard-accessible.
- **Locked sections.** `onRowActivate` is passed only when the section is editable (same predicate the form uses), so locked/submitted sections never bind the handler.

## Risks / Trade-offs

- Everyone-scope rows mix own + foreign; the guard is per-row (`authorId === ownerId`), not per-slide — a missed check would let a lead open a co-lead's record. Covered by a dedicated test.
- The lead form's editors assume form context (react-hook-form). If extraction is invasive, fall back to a minimal dialog form that submits the same mutation payload — decided at implementation time, spec unaffected.
- Double-click on touch devices doesn't exist; the dialog stays reachable via the Edit form, so no mobile affordance is added now.
