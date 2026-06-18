# Record-visibility (Mine / Everyone) in slides mode

## Why

The lead report toolbar is shared between **edit** and **slides** modes (in
`?mode=slides`, `LeadSlidesClient` renders with `chrome="content"` and the
toolbar comes from `lead-form.tsx`). Today the **Record visibility** toggle
(Mine only / Everyone) renders only in edit (`!isSlidesMode`). So when the user
switches edit → slides, that toggle disappears and the controls after it
(view-mode toggle, trailing collapse/fullscreen) shift left — the icons "float."

User feedback (live demo, 2026-06-18): keep the same buttons in both modes so
the toolbar reads one-to-one, AND make the toggle do something useful in slides —
"чтобы счётчики были полноценные в слайдах для всех лидов группы, а не только мои
риски." That is: in slides **Everyone** should surface the co-owners' content on
shared products so the deck's counters read the full picture; **Mine** stays the
lead's own.

This intentionally **reverses** the earlier `scope-lead-report-to-own-contribution`
decision that "slides carry only own records." That reversal is the load-bearing
design decision here — see `design.md`.

## What Changes

- The Record-visibility toggle renders in BOTH edit and slides modes, so the
  lead toolbar presents an identical control set and stable geometry across modes
  (no floating icons).
- In slides, the toggle is functional:
  - **Mine** — the deck shows the lead's own records only (today's behavior).
  - **Everyone** — the deck additionally merges co-owners' cross-author content
    (items / risks / decisions) on shared products into the slide grids and KPI
    counters, so counts reflect own + foreign. Health (product badge) stays
    honest in both modes (already folded from `crossAuthors`).
- The Everyone slide view is strictly **view-only**: it never reaches a draft,
  submission, published snapshot, or any export/PDF surface (consistent with the
  edit-mode D4b rule and the lead-export-FORBIDDEN decision).
- Everyone's full-content fetch in slides is gated and purged exactly like edit
  (hydration guard; purge `crossAuthorContent` on identity/report change).
- Everyone is offered only on the lead's OWN deck: when the slides URL targets a
  foreign `authorId`, the toggle is forced to Mine and no cross-author merge runs
  (Codex review A-1). Health vs. KPI counts stay coherent — the merge uses the
  same rules as own records, adding no new divergence (Codex review A-2).

## Out of scope

- Standalone slides routes that do not render the lead-form toolbar (e.g.
  `/lead/slides` without `?mode=slides` in-report), and head/viewer slide decks —
  this change targets the lead's in-report `?mode=slides` surface. `/lead/*` is
  lead-only and `crossAuthorContent` enforces co-ownership server-side, so no
  authz surface widens beyond edit-mode Everyone.
- The existing slide `ScopeToggle` (Own / Product) keeps its current behavior;
  its relationship to Mine/Everyone is resolved in `design.md` (open decision).
- Changing what "Everyone" means: it stays the existing cross-author scope
  (co-owners of the lead's own products), NOT the whole group portfolio.

## Impact

- Affected specs: ADDED requirement under `report-toolbar-parity` (visibility
  toggle present in both modes); ADDED requirement under `status-slide-rendering`
  (slides respect Mine/Everyone; Everyone merges foreign content view-only;
  health honest).
- Affected code: `apps/web/src/components/lead/lead-form.tsx` (render the toggle
  in slides; thread the mode into the slides path), `lead-slides-client.tsx`
  (accept visibility, gated `crossAuthorContent` fetch, merge into slide model),
  `slides/section-slide-utils.ts` (merge foreign rows into the section slide
  model + counters), and the cross-author content mappers. New tests for
  toolbar parity, Everyone-counts, view-only safety.
- Reverses `scope-lead-report-to-own-contribution` "slides own-only" — captured
  as an ADR (durable) in `design.md` / `docs/adr/`.
