# Design — close-slides-visibility-tails

## Tail 1 — fetch-gate divergence (code fix)

### Current state

Two hosts run the same `crossAuthorContent` query against the same gate intent:

- `LeadSlidesClient` (`lead-slides-client.tsx:175`): `enabled: targetReportId !==
"" && visibilityHydrated && isEveryone && isOwnDeck` — correct, own-deck gated.
- `lead-form.tsx:462` (the toolbar host for both edit and slides modes):
  `enabled: targetReportId !== "" && visibilityHydrated && isEveryone` — missing
  the own-deck clause. `isEveryone` here derives from `recordVisibility` (the
  current user's persisted toggle), NOT from `toolbarVisibility` (which is
  forced to `mine` on a foreign deck). So a user whose persisted visibility is
  Everyone, viewing a foreign `authorId` slides deck, fires the query.

The fetched payload is the current user's OWN cross-author content for the
report — it is never rendered in slides mode (the slide deck renders
`LeadSlidesClient`, which independently does not merge it on a foreign deck), so
this is a wasted sensitive read, not a cross-user leak.

### Decision

Add `&& !isForeignSlidesDeck` to the `lead-form.tsx` `crossAuthorContent` gate
(line 466), making the toolbar host match `LeadSlidesClient` and ADR 0003
constraint 2. The existing purge effects already drop the cache on
identity/report change; no purge change is needed because the query simply never
enables on a foreign deck.

**Belt-and-suspenders (review finding 2).** `foreignContentRows` (line 795-796)
and the cache-purge effect (line 476) are gated on `isEveryone` only, NOT on
`!isForeignSlidesDeck`. After the fetch gate above they collapse to `[]` on a
foreign deck (the query is disabled → `crossAuthorContentQ.data` is undefined),
and the merge is dead in slides mode anyway (slides render `LeadSlidesClient`,
not the edit JSX at line 1338). To make the foreign-deck invariant explicit and
robust to any future reuse of `foreignContentRows` outside the edit-render
branch, also add `!isForeignSlidesDeck` to the `foreignContentRows` memo guard
(line 796), so foreign rows are gated at BOTH the fetch and the consume sites.

### Test coverage — shared tested predicate (corrects review findings, round 2 #1)

The "on EVERY host" spec clause must be genuinely tested, not asserted by
inspection on the slide client. So the own-deck fetch gate is extracted into one
pure predicate both hosts call:

```
crossAuthorContentFetchEnabled({ hasReport, visibilityHydrated, isEveryone, isOwnDeck })
  => hasReport && visibilityHydrated && isEveryone && isOwnDeck
```

- `lead-slides-client.tsx:180` and `lead-form.tsx:466` both replace their inline
  `enabled:` expression with a call to this predicate. Each host maps its own
  notion of own-deck to `isOwnDeck` (`LeadSlidesClient`: `isOwnDeck` from
  `authorId` + session; `lead-form`: `!isForeignSlidesDeck`).
- A unit test pins the predicate's truth table — crucially the foreign-deck row
  (`isOwnDeck: false ⇒ false`) even when `isEveryone` is true — so BOTH hosts'
  gate is covered by one tested function, satisfying the "every host" clause.
- An integration test on the lead-form host (`lead-form-visibility.test.tsx`,
  which already spies the `crossAuthorContent` request: 7d.1 asserts Mine issues
  no fetch; the slides-preview case asserts no content fetch on the own deck)
  adds the foreign-`authorId` + persisted-Everyone case ⇒ never requested.

This is the minimal shared-unit extraction Codex endorsed, not a full own-deck
hook refactor.

## Tail 2 — per-row foreign attribution Coming-Soon affordance

### Constraint

ADR 0003 consequence: slide grids are flat `string[]`; a real per-row marker
needs attributed row objects — deferred. The repo deferred-feature-pattern
(CLAUDE.md) mandates a visible `ComingSoonBadge` affordance for a deferred
user-facing feature rather than a silent gap.

### Decision

A new `ForeignTagsComingSoon` inert control, built on the shared
`ComingSoonBadge` primitive (canonical amber tokens, `title="Coming Soon"`,
descriptive `aria-label`), rendered in the lead slide hero controls next to the
scope controls. It is shown ONLY when the deck is the lead's own deck AND in
Everyone (`isEveryone`, which already implies `isOwnDeck` per
`lead-slides-client.tsx:136`) — in Mine there are no foreign rows, so
attribution is moot. It is added to the `coming-soon-style.test.tsx`
canonical-style control list so the single-style guard covers it.

**Scope (review finding 3).** `heroControls` renders in two `LeadSlidesClient`
branches: the `scope === "product"` product-grid view (line 280) and the default
`scope === "own"` bullet-row view (line 324). Per-author attribution is about the
merged bullet ROWS, which live in the own-scope view; the product-grid view folds
foreign content into health/counters, not into attributable bullets. So the
affordance renders ONLY in the default own-scope branch (line 324), not in the
product-scope branch.

**Hidden in fullscreen presentation (Act-1 decision).** The lead deck is BOTH a
working surface and a surface the lead projects to an audience in fullscreen. A
"Coming Soon" pill in the projected deck reads as unfinished. So the affordance
is shown only in the normal (non-fullscreen) working view and is hidden while the
deck is in fullscreen presentation — it informs the lead without appearing on the
projection. Net gate: `isEveryone && scope !== "product" && !isFullscreen`.

**Fullscreen source of truth (round 2 #3).** Today `isFullscreen` is local state
inside `SlideFullscreenButton` (`slide-fullscreen-button.tsx:15`, driven by a
`fullscreenchange` listener) — `LeadSlidesClient` cannot read it. Extract a small
`useIsFullscreen` hook (reads `document.fullscreenElement`, subscribes to
`fullscreenchange`); `SlideFullscreenButton` uses it instead of its private state,
and the affordance in `LeadSlidesClient` reads the same hook. No prop-drilling or
state-lifting — both components independently observe one DOM source.

### Why hero controls, not on the rows

Putting a Coming-Soon marker on the projected slide content would clutter the
presentation surface the lead shows to an audience. The affordance belongs in
the lead's own deck chrome (hero controls), where it tells the presenter the
feature is roadmapped without marking the projected bullets.

## Tail 3 — head-toolbar annotation dismissals (decision record)

Live-checked 2026-06-19 on `/head/report/<id>` (seeded small tier, head role),
viewport 1366×900. The head report toolbar renders one row, no overflow
(`scrollWidth === innerWidth`), controls left→right: Previous · period · Next ·
archive · Agent-review (Coming-Soon, disabled) · Product/Leads scope · Edit/
Slides mode toggle.

- **Agent-review placement** — present in the right control group as the
  canonical Coming-Soon pill. Sensibly placed. DISMISS.
- **Edit-Slides placement** — the view-mode toggle sits at the far right, the
  conventional spot for a mode switch. DISMISS.
- **ScopeToggle "4 buttons one style like Toggle All"** — the head scope is a
  two-option segmented control (Product / Leads); "4 buttons" does not map, and
  flattening selected vs unselected to one style would remove the selection
  affordance. Not actionable. DISMISS.
- **Publish-lock message placement** — "Nothing to publish" + "No submitted
  report content yet." render in the header next to the disabled export. Reads
  clearly. DISMISS.

A dark circular "Start feedback mode" control overlapping the toolbar mid-row
in screenshots is the external agentation MCP annotation widget, NOT app UI —
explicitly not a placement bug.

All four superseded by the shipped toolbar redesign (`report-toolbar-layout`,
`toolbar-polish`, `report-toolbar-parity`). No code changes.

## Tail 4 — Codex Act-2 disposition (decision record)

The flagship `slides-record-visibility` Codex adversarial review returned
VERDICT: REVISE. All four findings were folded into the design before
implementation:

- A-1: Everyone + cross-author health fold gated to the own deck.
- A-2: foreign records counted by the same rules as own (no health-vs-count
  divergence).
- #4: full-content read gated on hydration + Everyone + own deck, purged on
  identity/report change.
- Decision 8: foreign-content mapper drops `priorityRank` (excluded from
  priority ranking, folded only into grids + counters).

The review was NOT re-run to an APPROVED verdict: `codex exec` hung on the
corporate proxy (0% CPU; reproduced again this session, even with the proxy
unset — clean network was unavailable). Instead the load-bearing no-leak
property — Everyone never reaches a draft/submission/snapshot/export — is pinned
by concrete tests, not only by the prose scenario (review finding 4):

- `apps/web/src/components/slides/section-slide-utils.test.ts` — pins
  `mergeForeignSlideContent` produces NEW objects and leaves the input section
  reference-unchanged (ADR 0003 constraint 1), so the merge never mutates the
  cached `ReportSectionReadModel` the draft serializes.
- `apps/web/src/components/lead/lead-form-visibility.test.tsx` 7d.5 / 7d.8 —
  assert the submitted payload carries own records only and is byte-identical in
  Mine vs Everyone, so Everyone never leaks into the submit/publish path.

Accepted bar: these guards + the live-verified no-leak walk; a clean-network
Codex re-run is optional, not blocking. Recorded here and appended to ADR 0003.
