# Design — Record-visibility in slides

## Decision 1 (ADR-grade): reverse "slides carry only own records"

`scope-lead-report-to-own-contribution` deliberately scoped lead slides to the
lead's OWN records, folding only the anonymized, risk-derived foreign **status**
into product health (`applyForeignProductHealth`), never foreign text/counts.
This change reverses that for the **Everyone** state only.

- **Context:** the user wants the slide deck to read as the full team picture on
  shared products when presenting, not just their own rows.
- **Decision:** in slides Everyone, merge co-owners' cross-author content
  (items/risks/decisions on shared products) into the slide model so grids and
  KPI counters reflect own + foreign. Mine keeps the own-only behavior.
- **Constraint that makes the reversal safe:** Everyone in slides is **view-only**.
  It must never feed a draft, a submission, the published snapshot, or any
  export/PDF path. The foreign rows are display-only, exactly as edit-mode
  Everyone (D4b) and consistent with the lead-export-FORBIDDEN decision.
- **Why ADR-grade:** it is hard to reverse (it re-opens a scoping decision that
  shaped the slide pipeline), surprising to a future reader (the code comments
  say own-only), and a real trade-off (presentation completeness vs. the
  own-contribution scoping principle). Record it in `docs/adr/` on implementation.

## Decision 2: Mine/Everyone vs. the existing ScopeToggle (Own / Product)

The slide hero already has a `ScopeToggle` with `allowedScopes={["own","product"]}`.
"Own" (a layout scope: section-summary vs per-product grid) reads dangerously
close to "Mine only" (a visibility scope: whose records). They are orthogonal —
ScopeToggle = how the deck is grouped; Mine/Everyone = whose records populate it
— but the labels collide.

- **Decision (recommended):** keep both toggles, treat them as orthogonal, and
  resolve the naming collision by relabeling the ScopeToggle's "Own" → a
  layout-neutral word (e.g. "Summary" or "Section") so it no longer competes with
  "Mine." Mine/Everyone lives in the toolbar (matching edit); ScopeToggle stays
  in the slide hero. Tooltips clarify each.
- **Open question for the user/implementer:** is relabeling "Own" acceptable, or
  should the two concepts be merged into one control? Default if unanswered: keep
  both, relabel "Own"→"Summary", because merging conflates layout with record
  scope and would complicate the head deck that reuses ScopeToggle.

## Decision 3: where the foreign merge happens

`buildSectionSlideModel(section)` derives every count and grid from a single
`ReportSectionReadModel`. The cleanest merge point is to fold the
`crossAuthorContent` rows into the section model BEFORE `buildSectionSlideModel`
(or extend it to accept foreign rows), so tone/score/readiness/counts all flow
through the existing logic unchanged. `buildProductScopedSlides` already
aggregates multiple sections per product — reuse its merge shape rather than
inventing a new one. Mark merged foreign rows so they can be visually
distinguished (read-only styling) and, critically, excluded from any
export/snapshot serializer.

## Decision 4: gating + purge parity with edit

Mirror `lead-form.tsx`: fetch `crossAuthorContent` only when
`visibilityHydrated && isEveryone`; purge the `crossAuthorContent` cache on
identity/report change and when leaving Everyone. The status-only `crossAuthors`
read stays always-on (it already drives honest health in both modes).

## Decision 5: phasing (so the cheap parity is not blocked by the feature)

Two task groups. Group 1 (toolbar parity) renders the toggle in both modes.
Group 2 (Everyone content) does the merge. They ship together in this change so
slides never present a dead/no-op toggle, but Group 1 is small and low-risk and
can be reviewed/landed first within the change.

## View-only safety (testable)

A test MUST prove that switching slides to Everyone does not change any
submit/draft/snapshot/export payload — the foreign rows are display-only. This is
the single highest-value guard (reuses the edit-mode D4b test pattern).
