# Polish: remove the Decision Owner field and the stacked Coming-Soon native title

## Why

Two issues surfaced in live lead-demo feedback on `/lead/report` (2026-06-20):

1. **Double tooltip on Coming-Soon controls.** The nav Theme control showed a
   single amber `ComingSoonBadge`, but the lead-toolbar Agent-review control —
   and the other inert controls — ALSO showed a browser-native "Coming Soon"
   tooltip on hover, a stacked double tooltip. Commit `0f988b5d` removed the
   native `title="Coming Soon"` from the nav Theme/Language controls, but that
   fix never reached the lead-toolbar controls (Agent review, Version, PDF
   export) or the admin Holidays control. The deferred-feature signal therefore
   read inconsistently across the app: one style in the nav, another in the
   toolbar ("тут один coming soon стиль ... а тут друго").

2. **Stray read-only Owner field in the Decision dialog.** The Decision edit
   dialog showed an Owner input that is read-only, always pre-set to the current
   lead, and greyed (`bg-[var(--color-muted)]`) — the lone grey box among white
   inputs. The Item and Risk dialogs carry no Owner field at all, so the Decision
   dialog read as the odd one out. The lead asked to remove it ("убрать").

## What Changes

### 1. No stacked native title on inert Coming-Soon controls — CONFIRMED

Remove `title="Coming Soon"` from every inert ComingSoon control (Agent review,
lead Version, lead PDF export, admin Holidays), matching the nav Theme/Language
controls already fixed in `0f988b5d`. The shared amber `ComingSoonBadge` stays
the single tooltip; the accessible name is carried by the control's `aria-label`
(focusable buttons) or by the `ComingSoonBadge` descendant text (the inert
Holidays `<span>` nested in its `TabsTrigger`). The source-scan regression in
`coming-soon-style.test.tsx` now covers all five control files, not just nav-bar.

### 2. Remove the Decision Owner field — CONFIRMED (direction: remove)

Remove the read-only Owner input from the Decision dialog. A decision is always
owned by its author — the current lead on create, the saved owner on edit (a lead
only ever opens their own decisions; co-owners' decisions are locked behind a
`LockBadge`). The `owner` value is STILL persisted on save, derived from
`decision?.owner ?? defaultOwner ?? ""`, where `defaultOwner` is always the
current user's name. The mine/foreign + `LockBadge` logic is unchanged. The
former Owner+Deadline two-column row collapses to a standalone full-width
Deadline field.

## Capabilities

- `deferred-feature-pattern` — ADDED: inert Coming-Soon controls carry no stacked
  native title.
- `record-dialog-layout` — MODIFIED: the Decision dialog's left-column fields no
  longer include owner.

## Impact

- **apps/web (UI):** `agent-review-coming-soon.tsx`, `pdf-export-coming-soon.tsx`,
  `version-coming-soon.tsx`, `admin/settings-tab.tsx`, `lead/decision-edit-dialog.tsx`.
- **apps/web (tests):** `coming-soon-style.test.tsx`, `lead-form.test.tsx`,
  `pdf-export-coming-soon.test.tsx`, `version-coming-soon.test.tsx`,
  `decision-edit-dialog.test.tsx`.
- **Glossary:** `CONTEXT.md` "Decision" entry clarified (owner = author, not
  separately assignable).
- **No DB / schema / API change.** `owner` persistence and the mine/foreign/lock
  model are unchanged.

## Out of scope

- Re-styling the Owner field to white instead of removing it (the lead chose
  removal; the de-grey alternative is recorded in `design.md`).
- The pre-existing below-`xl` Holidays-tab accessible-name nuance — the name comes
  from the badge text with or without the native title (verified live at 1100px),
  so there is no regression to address here.
- Any backend owner-assignment / reassignment feature.
