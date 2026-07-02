# Design — responsive-compact-layout

MVP, layout-only. Grilled + adversarially verified (2026-06-30). Locked: mixed viewport
floor; viewport-only compact reach; slides tablet+ (no phone slide idiom).

## Strategy

Desktop-down adaptation, not a mobile-first rewrite — the app is min-width-first
(`px-4 sm:px-6 lg:px-8`, fixed 16:10 slides, subgrid rails). Reuse Tailwind `sm/md/lg`;
`md` is the one compact↔full boundary. Compact-tier touch floor = existing
`--touch-target-min` (44px); desktop density stays `--toolbar-control-h` (32px).

## MVP slice

(1) the constraint + breakpoint/touch/density/no-overflow contract (the new capability);
(2) the C1 review surface born responsive (R6); (3) the visibly-breaking dense collisions
codified. Dialogs + lead form are codify-existing-behavior (light). Mobile nav deferred.

## Cross-capability deltas — disposition (resolved 2026-06-30)

Discriminator applied: author an external MODIFIED delta only where the existing
capability requirement, read in isolation after this change ships, becomes
**contradictory** — not merely incomplete. This change's OWN spec already states the
cross-cutting responsive contract generally ("Compact-Tier Controls Meet the
Touch-Target Floor", "No Horizontal Overflow at the Compact Width", "The Mixed
Viewport Floor Keeps Slides a Tablet+ Surface"), so the surfaces it already covers
need no per-spec restatement — single-home is the exemplary outcome.

- `record-dialog-layout` — **AUTHORED** (`specs/record-dialog-layout/spec.md`). Its
  "share one two-column layout" requirement is unconditional; this change collapses to
  one column below `md`, so a reviewer reads a phone-width dialog as a violation.
  Contradictory, and **not** covered by this change's own spec (which is about touch
  floor / overflow / viewport floor, never the dialog column collapse) → author.
- `ui-control-density` — **AUTHORED** (`specs/ui-control-density/spec.md`). This change's
  own text asserts it "qualifies the single-shared-height contract to within one viewport
  tier" — so the contract's home spec must carry that qualifier or it is self-inconsistent
  (its unconditional "one consistent height" reads as cross-tier). One-line surgical
  qualifier delta.
- `head-slide-density`, `lead-slide-quadrants` — **SKIPPED (subsumed).** Neither becomes
  contradictory; they are incomplete at most, and the tablet-floor rule is already owned,
  once, by this change's "The Mixed Viewport Floor Keeps Slides a Tablet+ Surface". (This
  also moots the "KEEP the header" caution on `head-slide-density` — it only mattered if
  the requirement were modified.)
- `head-dashboard-clarity` — **SKIPPED (subsumed).** Its "Period Summary fits without
  horizontal scroll" already holds at every width; the general no-overflow guarantee is
  owned by this change's "No Horizontal Overflow at the Compact Width". Card-list reflow
  below `md` is an implementation detail of the already-card-list `LeadSummaryTable`, not
  a contradicted contract.
- `toolbar-polish` — **SKIPPED (subsumed).** The 32px→44px compact floor is owned by this
  change's "Compact-Tier Controls Meet the Touch-Target Floor"; the `overflow-x-auto`
  toolbar exception is owned by "No Horizontal Overflow at the Compact Width". No existing
  `toolbar-polish` requirement becomes contradictory.

## C7 reflow note

The "head positional stability across Edit↔Slides" concern (C7) is whole-header
composition (slides renders its own header; the form delegates to `WeeklyReportPage`) —
broader than toolbar-semantics. Verify on a fresh build first; if it persists, home it
where header composition is governed, not here.

## Out of scope

Mobile-first rewrite; mobile nav/hamburger; persisted density toggle; phone slide-
presentation flow; new breakpoint/height tokens; palette/theme; toolbar "More"-menu;
responsive PDF/print; any C1 behavior change (layout only).
