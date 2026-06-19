# Close the slides-record-visibility tails

## Why

`slides-record-visibility` shipped and archived, but four loose ends were
recorded only in a handoff doc (`docs/handoff-backlog-to-specs-2026-06-19.md`),
not in the durable specs/ADRs. A loose end that lives only in a handoff is
invisible to `openspec list` and to the next contributor; it reads as "done"
when it is not. This change converts the four tails into durable form — code
fixes that merge, a Coming-Soon affordance for the one deferred feature, and
explicit decision records — so nothing about the flagship stays floating.

The four tails (from the handoff "Open follow-ups"):

1. **Fetch-gate divergence (bug).** ADR 0003 constraint 2 and the
   `status-slide-rendering` requirement "Everyone is available only on the
   lead's own deck" both state the cross-author content read does NOT fire on a
   foreign `authorId` deck. The slides client (`LeadSlidesClient`) honors this
   (`enabled: … && isOwnDeck`), but the shared toolbar host
   (`lead-form.tsx`) gates the same query on `isEveryone` only — so on a
   foreign slides deck the current user's own cross-author content is fetched
   and cached though it is never displayed (slides render `LeadSlidesClient`,
   not the edit JSX). Not a data leak — it is the current user's OWN data — but
   it violates the stated own-deck gate and wastes a sensitive read.
2. **Per-row foreign attribution (deferred feature).** In Everyone the deck
   merges co-owners' rows as plain bullets with no per-row "who owns this"
   marker (ADR 0003 consequence: the slide grids are flat `string[]`). The
   deferral was correct, but per the repo deferred-feature-pattern a deferred
   **user-facing** feature gets a visible Coming-Soon affordance, not a silent
   gap. There is no such affordance today.
3. **Head-toolbar annotation triage (dismissals).** Four live-demo annotations
   on the head report toolbar (Agent-review placement, Edit-Slides placement,
   ScopeToggle "4 buttons one style", publish-lock message placement) were
   live-checked on 2026-06-19 and found already satisfied by the shipped
   toolbar redesign. The dismissal was never written down.
4. **Codex Act-2 disposition.** The flagship Codex adversarial review returned
   REVISE; all four findings were folded in but the review was never re-run to
   APPROVED (the corporate proxy hung `codex exec`). The no-leak property was
   live-verified instead. That disposition lived only in the handoff.

## What Changes

- **Tail 1 (code).** `lead-form.tsx` gates the `crossAuthorContent` query on
  `!isForeignSlidesDeck` as well, matching `LeadSlidesClient`. A regression
  test pins that the query is disabled on a foreign slides deck. The
  `status-slide-rendering` own-deck requirement is tightened to make
  "the fetch MUST NOT fire on a foreign deck" an explicit, testable clause.
- **Tail 2 (code).** A new inert `ForeignTagsComingSoon` control (shared
  `ComingSoonBadge` primitive, canonical amber style) renders in the lead slide
  hero controls only on the OWN deck in Everyone, acknowledging that per-author
  row tags are roadmapped. A new `status-slide-rendering` requirement pins it.
- **Tail 3 (decision record).** The four head-toolbar annotation dismissals are
  recorded in `design.md` with the live-check evidence; no code changes.
- **Tail 4 (decision record).** The Codex Act-2 disposition (REVISE folded +
  live-verified, not re-run to APPROVED) is recorded in `design.md` and
  appended to ADR 0003; no code changes.

## Out of scope

- The full per-row attribution feature (restructuring the flat `string[]` slide
  grids into attributed row objects) — only the Coming-Soon affordance ships.
- Re-running Codex Act-2 to an APPROVED verdict — left optional for a clean
  network; the live-verified no-leak property is the accepted bar.
