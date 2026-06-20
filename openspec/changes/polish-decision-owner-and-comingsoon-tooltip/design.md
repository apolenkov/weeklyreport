# Design

## Context

Both changes are UI polish from one live lead-demo feedback session on
`/lead/report` (2026-06-20). Neither touches the DB, the API, or shared
contracts. The code was implemented and verified before this change document was
authored (gates green + live browser check + an independent diff review); the
change records the decisions and repairs the spec debt the edits created.

## Decision 1 — remove the Decision Owner field (not de-grey it)

**Chosen:** delete the read-only Owner input entirely.

The field was read-only, always pre-set to the current lead, and the lone grey
(`bg-[var(--color-muted)]`) box among white inputs. The Item and Risk dialogs
have no Owner field, so the Decision dialog read as inconsistent. The lead's
feedback was "убрать" (remove).

Alternatives considered:

- **De-grey to white, keep read-only.** One-line change
  (`bg-[var(--color-muted)]` → `bg-white`). Rejected: a read-only field that
  looks identical to the editable ones is a UX lie, and it does not match the
  "like the other dialogs" intent (the others have no Owner field at all).
- **Render owner as a plain read-only text line.** Rejected as still showing a
  field the lead cannot act on; the card already surfaces the owner.

**Owner is still persisted.** `owner = decision?.owner ?? defaultOwner ?? ""`:
the saved owner round-trips on edit, and `defaultOwner` (always
`currentUser.name`, passed at `lead-form.tsx`) supplies it on create. The
mine/foreign + `LockBadge` logic in `decisions-section.tsx` is unchanged — it
reads `decision.owner`, which is unaffected.

**Benign `owner=""` edge — Codex REVISE, rejected by the arbiter.** The
owner-required validation was removed with the field, so in principle a decision
could save with `owner=""` if a caller omitted `defaultOwner`. Codex's Act-2
review flagged this (`VERDICT: REVISE`): an empty owner makes `isMine("")` return
"mine", which it read as "erroneously allows editing", and proposed making
`defaultOwner` / `currentUserName` required or guarding the save.

Rejected as the final arbiter, for three reasons:

1. **It misreads intentional design.** `isMine` is deliberately permissive —
   `if (!me) return true; // No identity yet — be permissive` and
   `if (!owner) return true; // Unowned rows behave like own`
   (`decisions-section.tsx:38`). An empty/missing owner behaving as "mine" is the
   author's chosen behavior, not a bug; the author keeps editing their OWN row.
2. **It is unreachable.** Every production mount passes
   `defaultOwner={currentUserName}` = `currentUser.name` (non-empty), and the
   dialog only ever opens for the lead's own decisions; co-owners' rows are locked
   behind a `LockBadge` (the Edit affordance renders only for
   `mine && !decision.foreign`), so an empty owner can never silently re-own
   another lead's decision.
3. **The proposed fix fights that design and churns tests.** Forcing
   `currentUserName` non-optional would invalidate the `decisions-section`
   snapshot/add-signal tests that _deliberately_ render without it to exercise the
   permissive `isMine` fallback (see their own comment block). That is
   disproportionate churn for a path that cannot occur.

The owner value is still always the author in practice; `isMine` remains the
defense-in-depth that keeps a degenerate empty owner editable rather than
orphaned. If the contract is ever tightened, do it at the `currentUserName` source
with matching test updates — not reflexively here.

**Layout.** The former Owner+Deadline `grid sm:grid-cols-2` row collapses to a
standalone full-width Deadline field — consistent with the other full-width
left-column fields. No empty grid cell remains.

## Decision 2 — no stacked native title on inert Coming-Soon controls

**Chosen:** remove `title="Coming Soon"` from all four remaining inert controls
(Agent review, Version, PDF export, Holidays), matching the nav Theme/Language
controls already fixed in commit `0f988b5d`.

The shared amber `ComingSoonBadge` is the single intended tooltip. A native
`title="Coming Soon"` on the same element stacked a second browser-native tooltip
on hover — the double-tooltip glitch the lead saw (nav = one style, toolbar =
another).

**Accessibility is preserved, verified live.** Focusable controls keep their
`aria-label="<feature> is coming soon"`. The Holidays control is an inert
`<span>` inside its `TabsTrigger`; per the existing `deferred-feature-pattern`
requirement it carries no `aria-label`, and its coming-soon state reaches the tab
button's accessible name through the descendant `ComingSoonBadge` text. The
`COMING_SOON_TOOLTIP_ANCHOR` hides the badge with `opacity-0` (NOT
`display:none`), so the badge text stays in the accessibility tree. An
independent live check (Chromium accname at 1100px, below the `xl` breakpoint
where the visible "Holidays" text is hidden) confirmed the tab's accessible name
is "Coming Soon" both before and after removing the native title — zero
degradation.

**Scope of the rule.** Only a `title` duplicating the badge ("Coming Soon") is
forbidden; controls may still use a native `title` for other wording (e.g. the
logout button's `title="Sign out"`). The regression scan matches the literal
`title="Coming Soon"`, matching this scope.

## Test strategy

- `coming-soon-style.test.tsx` — the existing source scan is broadened from
  nav-bar only to all five inert control files (proven teeth: injecting the title
  fails the scan).
- `version-coming-soon.test.tsx`, `pdf-export-coming-soon.test.tsx`,
  `lead-form.test.tsx` — the runtime assertions flip from
  `toHaveAttribute("title", "Coming Soon")` to `not.toHaveAttribute("title")`,
  alongside the retained `aria-label` + `aria-disabled` checks.
- `decision-edit-dialog.test.tsx` — adds (a) owner is auto-set to the author with
  no owner field rendered, and (b) editing preserves the decision's existing
  owner rather than `defaultOwner`.
- Optional hardening — a runtime assertion that the Holidays tab's accessible name
  still contains "Coming Soon", backing the existing spec scenario with a test
  rather than a one-time live check.

## Interpretation caveat

The "убрать?" feedback was terse. It is read as remove-the-field, which the live
check confirmed looks right. If the lead meant only "drop the grey background",
the alternative is the one-line `bg-[var(--color-muted)]` → `bg-white` edit on the
(then still read-only) input — reversible in seconds.
