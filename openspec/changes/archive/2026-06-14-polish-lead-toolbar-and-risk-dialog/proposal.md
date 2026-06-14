# Polish Lead Toolbar, Risk Dialog, and Slide Hero (2026-06-13)

## Why

Live-walk feedback captured via the Agentation toolbar on
`/lead/report/<id>` (form and `?mode=slides`). All items are
**component-level layout / visual-consistency** fixes — not theme, token,
dark-mode, or background work (those stay research-only per repo rule). The
user asked to capture everything here ("в papers") and implement in a later
ultracode session.

This is a **capture draft**: each item records the user's intent and the exact
React/source anchor. A few items ("improve the visualization", "make it look
nicer") need a concrete design decision before implementation — flagged below.

## What Changes

Grouped by surface. Source anchors are from the live DOM annotations.

### Lead report toolbar (`report-toolbar.tsx` and children)

1. **Archive toggle — drop the count signal.**
   `ArchiveToggle` (`report-shell/toolbar-icon-button.tsx`) currently surfaces
   a count of archived periods that reads like a call-to-action ("4 archives,
   click me"). The user wants it subtle — an inert state indicator, not a badge
   that implies "press me to do something". Remove the count popup / make it a
   quiet affordance.

2. **Version "Coming soon" control — make it round and consistent.**
   `VersionComingSoonControl` (`lead/version-coming-soon.tsx`) renders as a
   non-round pill (`w-10 h-8`, `rounded-[var(--radius-pill)]` but visually not
   circular like its 32×32 siblings). Make it consistently rounded and aligned
   with the other toolbar controls.

3. **Fill-from + copy — re-consolidate into one control.**
   The user preferred the earlier design where "fill from past report" and
   "copy" lived in **one** control. Consolidate `FillFromButton`
   (`lead/fill-from-button.tsx`) so a single control's default click copies,
   and the separate left copy control goes away.

### Risk edit dialog (`lead/risk-edit-dialog.tsx`)

4. **Reduce visual load; clearer layout.** The Add/Edit Risk dialog
   (`max-w-4xl`, `p-6`) feels overloaded. The user wants a clearer, lighter
   information hierarchy so the form is easier to scan. **Needs a design pass**
   — propose a concrete layout before editing (group fields, tighten spacing,
   reduce competing emphasis). Capture screenshots before/after.

### Lead slide hero (`?mode=slides`, `slides/lead-slide-hero.tsx`)

5. **Status badge height misaligned.** The "Blockers" status badge
   (`h-11`, `w-[112px]`) is taller than its sibling row elements. Align all
   elements in that hero row to one consistent height/baseline.

## Open Questions

- Item 4 (risk dialog redesign): what is "less overloaded" concretely — fewer
  visible fields at once, a two-column layout, progressive disclosure? Decide a
  direction before implementing.
- Item 3 (fill-from/copy): confirm the exact merged interaction (single click =
  copy from latest? dropdown to pick a past report?).

## Out of Scope

- Theme / token / dark-mode / background changes.
- Behavioral/logic changes — these are presentation only.

## Notes

- More live-walk annotations may be appended to this change as the user
  continues the walk. Treat the task list as growing.
