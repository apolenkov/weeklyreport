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

- **Decision (resolved — user confirmed 2026-06-18):** keep both toggles, treat
  them as orthogonal, and resolve the naming collision by relabeling the
  ScopeToggle's "Own" → **"Summary"**. Mine/Everyone lives in the toolbar
  (matching edit); ScopeToggle stays in the slide hero. Tooltips clarify each.
  Merging the two was rejected — it conflates layout with record scope and would
  complicate the head deck that reuses ScopeToggle. Only the `ScopeValue` "own"
  _label_ changes to "Summary"; the value/key stays "own".

## Decision 3: where the foreign merge happens (no-mutation is load-bearing)

`buildSectionSlideModel(section)` derives every count and grid from a single
`ReportSectionReadModel`. **The merge MUST happen at the slide-model layer,
producing NEW `SlideProduct`/`SectionSlideModel` objects — it MUST NOT fold
foreign rows back into the `ReportSectionReadModel`.**

Why this is the load-bearing rule (impact-map finding, 2026-06-18): the slides
read `byPeriodQ.data.section` and lead-form seeds `draftSection` from the SAME
cached React-Query object (identical `leadForm.byPeriod` query key → same object
reference). Draft/submit serialize `draftSection` only; the slide model is a
derived projection that no serializer reads back. So the merge is render-only —
PROVIDED it never mutates that shared cached `ReportSectionReadModel`. Folding
foreign rows "into the section model before `buildSectionSlideModel`" (the
tempting shortcut) aliases the cache and would leak foreign rows into draft/submit.

- Extend `buildSectionSlideModel` (or a wrapper) to ACCEPT foreign rows as a
  separate argument and emit new slide-model objects — mirror the existing
  `applyForeignProductHealth`, which already returns `{...product}` + new arrays
  and mutates nothing. `buildProductScopedSlides` is the merge-shape reference.
- Mark merged foreign rows on the SLIDE view type (`foreign: true`) for read-only
  styling. No serializer-side "marked-foreign" filter is needed and adding one to
  the WRITE schemas would be over-engineering — keep foreign rows out of the
  read-model entirely. Snapshot/PDF are server-side and need no change.
- A regression test MUST assert that, with foreign content merged into the deck,
  `sectionToDraftPayload(draftSection)` still yields own-only rows (the cache was
  not mutated).

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

## Decision 6: foreign `authorId` decks (Codex A-1)

`LeadSlidesClient` reads `authorId` from the URL to select whose base deck is
shown. If Everyone merged the CURRENT user's cross-author rows onto a FOREIGN
author's base deck, it would mix two people's data and could expose content
outside the viewer's co-ownership scope.

- **Decision:** Everyone is offered only on the lead's OWN deck. When `authorId`
  selects a different author, the visibility toggle is forced/locked to Mine and
  the `crossAuthorContent` merge does not run. The merge is always scoped to the
  current user's co-ownership, never re-targeted to the displayed author.
- This keeps the authz surface identical to edit-mode Everyone.

## Decision 7: health vs. counts coherence (Codex A-2)

`applyForeignProductHealth` lifts health from risk-derived `crossAuthors` status
only, while `buildSectionSlideModel` counts blocked items from content. A blocked
ITEM with no covering risk therefore inflates the blocked KPI while the badge can
stay green. **This divergence already exists in Mine/own mode** (own blocked
items count the same way) — it is a pre-existing property, not introduced here.

- **Decision:** the Everyone merge treats foreign records by the EXACT same rules
  as own records, so it introduces no NEW divergence. Foreign blocked items count
  exactly as own blocked items; health stays risk-derived in both modes. Add a
  test pinning that parity (own vs foreign blocked item count identically; health
  unchanged) and that foreign rows are not double-counted.
- Not in scope: changing the app-wide health=risk-derived vs counts=record-count
  model. If the user wants blocked ITEMS to lift health, that is a separate
  cross-surface change.

## Decision 8: foreign-content mapper shape + the priorityRank gap

Slides today fetch ONLY `crossAuthors` (status-only). Everyone must ADD a
`leadForm.crossAuthorContent` fetch and map its rows with the existing
`mapForeignItems` / `mapForeignRisks` / `mapForeignDecisions`
(`lib/mappers/lead-cross-author.ts`), which already tag rows `foreign: true`.

- **Count sources:** foreign rows are NOT in `section.projects`, so they cannot
  contribute the project-`trafficLight` counts; they fold into the blocked/at-risk
  KPIs only via `item.workflowStatus === 'blocked'` and `risk.severity`. This
  asymmetry with own rows is expected, not a bug.
- **priorityRank gap (decided):** the client `CrossAuthorContentRow` mirror DROPS
  `priorityRank` (and `tag`). Foreign items therefore cannot drive priority chips
  or any priority-rank count in the deck. Decision: foreign rows contribute to the
  content grids and the blocked/at-risk counters but are EXCLUDED from
  priority-rank ranking — do NOT widen the mirror for this change. Pin it with a
  test so it is intentional, not an accidental crash on a missing field.
- **Hydration flash:** mirror the edit form — DISPLAY may default to a mode before
  hydration, but the `crossAuthorContent` FETCH is gated on `visibilityHydrated`
  so a restored "everyone" cannot fire the sensitive read before the persisted
  value is known.

## View-only safety (testable)

A test MUST prove that switching slides to Everyone does not change any
submit/draft/snapshot/export payload — the foreign rows are display-only. This is
the single highest-value guard (reuses the edit-mode D4b test pattern).
