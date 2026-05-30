# Fix admin settings "Holidays" coming-soon nested-button hydration error

## Why

UAT sweep (Wave 1, 2026-05-29) of `/admin?tab=settings` under the admin role
surfaced 2 React console errors:

```
In HTML, <button> cannot be a descendant of <button>. This will cause a hydration error.
<button> cannot contain a nested <button>.
```

Root cause: `HolidaysComingSoonControl` (`apps/web/src/components/admin/settings-tab.tsx`)
renders a `<button>` as the coming-soon control, and it is mounted INSIDE
`<TabsTrigger value="holidays">`, which Radix renders as its own `<button>`.
Nested interactive buttons are invalid HTML and trigger a hydration error.

Pre-existing on `main` (not a regression from the Wave-3 dep/quality work); the
UAT sweep is what made it visible. It is the only console error found across all
four roles — head/lead/viewer were clean.

Secondary: the control's `TODO(holidays-activation)` comment points at
`.planning/todos/pending/2026-05-21-holidays-calendar.md`, but `.planning/` has
been removed — the reference is now dangling and should be repointed or dropped.

## What Changes

- Make the holidays coming-soon control a non-interactive element so it is not a
  `<button>` nested in the `TabsTrigger` button. The control is already inert
  (`aria-disabled="true"`, `cursor-default`); replace the inner `<button>` with a
  `<span>` (carrying the same `aria-label`/`title`/`data-testid`), or render the
  `TabsTrigger` with `asChild`. Keep the ComingSoonBadge tooltip behavior and the
  deferred-feature pattern intact (per CLAUDE.md ComingSoon convention).
- Update the dangling `.planning/...` TODO reference.

## Impact

- `apps/web/src/components/admin/settings-tab.tsx` (single file).
- No behavior change for users (control stays inert/coming-soon); removes the
  hydration error and restores the "0 console errors per role" UAT bar.
- Verify with the existing admin settings tests + a Wave-1-style re-sweep of the
  admin role.

## Grill findings — 2026-05-30

Adversarial re-review of the explorer analysis (which recommended `finish`).

- **Recommendation corrected: `archive`, not `finish`.** The explorer reported
  `currentState: done-in-reality`, `estTaskCount: 0`, yet `recommendation:
  finish`. That is internally inconsistent — `finish` implies remaining
  implementation work, and there is none. Code is committed (`c0ec36fe`), the
  working tree is clean, and `openspec validate --strict` passes. The two
  unchecked Verify boxes reflect work already performed (test gate + the manual
  admin re-sweep documented in the commit message), i.e. bookkeeping, not work.
- **Code state confirmed done.** `HolidaysComingSoonControl` now renders a
  `<span>` (line 109), preserving `aria-label`, `title`,
  `data-testid="holidays-coming-soon"`, the icon, and the visual classes; the
  enclosing `TabsTrigger` is the only `<button>`. The dangling `.planning/...`
  TODO reference was dropped and the `TODO(holidays-activation)` comment kept.
- **Spec-sync claim corrected (info).** The explorer said the NEW
  `admin-settings-ui/spec.md` requirement needs "no sync to main specs; belongs
  in change archive." `openspec/specs/` has no `admin-settings-ui/` yet, so
  archiving will *promote* this ADDED requirement into a new durable main spec.
  That is correct and intended — but "no sync needed" mis-describes it; the
  archive step creates the durable spec.
- **No automated regression guard (minor, non-blocking).** The button→span fix
  is an SSR/hydration DOM-validity issue, invisible to RTL/jsdom render tests.
  `settings-tab.test.tsx` contains zero assertions referencing
  `holidays-coming-soon`, so the Verify line claiming "the testid still
  resolves" is untested by the suite. Real verification is the manual Playwright
  sweep, attestable only via the commit message. Acceptable for an inert,
  render-only change; recorded, not a blocker.
- **Affirmed:** `blastRadius: low`, `sharedFiles: []`, `dependsOn: []`,
  `gatesSufficient: true` are all correct for a single-file, render-only change.
  No diff-scale human review needed.

Surviving delta: tick both Verify boxes in `tasks.md`, then archive (which
creates `openspec/specs/admin-settings-ui/`). No code or proposal changes.
