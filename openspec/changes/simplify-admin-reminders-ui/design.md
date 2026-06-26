# Design — simplify-admin-reminders-ui

## Scope posture

UI-only. The reminders engine (schema, `PolicyApplicatorService`, `@Cron`
scheduler, shared Zod contracts) is the source of truth and is not touched. Every
decision below is about how the admin Reminders tab _presents and edits_ the
existing `ReminderPolicy` rows. Locked via grill-with-docs.

## Decisions

### D1 — General list, not a fixed set

The screen stays a general Add / Edit / Remove list because the engine still
supports N policies and validity windows. A fixed-card set would hide that
generality (a 2nd policy of the same type, or a dated rollout, would become
unmanageable from the UI). The common case is two cards, so it still reads
simple.

### D2 — Reminder type as a preset (kind × audience)

`kind` and `audience` are stored independently but only two pairings are
meaningful: deadline→leads, escalation→head. `follow_up` is unused. Presenting
one "Reminder type" preset both removes jargon and closes the footgun where an
admin could persist a nonsensical pair. The preset is a UI affordance only; on
save it expands to the existing `kind` + `audience` fields.

### D3 — Legacy / non-preset pairings: read-only "Custom"

Because the engine allows any pairing, an existing row may sit outside the two
presets. We must not silently coerce it. The preset selector shows a read-only
"Custom" entry for such a row; the admin can still edit timing/active/advanced
fields, and the stored `kind`/`audience` are written back unchanged. New
reminders can only be one of the two presets. This keeps the data honest without
a migration.

### D4 — Next-send line, computed client-side

The card already receives the policy's derived `ReminderRule` rows
(`derivedRules` + `periodById`). The next-send line is the earliest rule whose
`fireAt` is in the future, formatted as a date, plus "then every period". No new
query. An inactive policy or one with no future rule reads "No upcoming sends".
Rule of thumb: derive presentation from data already in hand, never add a backend
round-trip for a hint.

### D5 — Advanced collapse for timezone + validity

Timezone and validity (`validFrom`/`validUntil`/forever) are real but rarely
touched. They move into a default-collapsed "Advanced" `<details>`-style section.
The validity-range guard ("end after start") stays. Defaults for a new reminder
remain: active immediately, no end date, org/default timezone.

### D6 — Copy: English, canonical "Reminder" (whole tab, not just the card)

Per the repo UI-strings rule, all production JSX/aria/placeholder copy is
English. Per CONTEXT.md, admin-facing copy says "Reminder", never "policy". This
covers the WHOLE tab, caught by Codex round 1: the tab title ("Reminder
Policies"), the description, the search placeholder/aria, the "New Policy" CTA,
the save/remove toasts ("Policy updated/created/removed"), and the
remove-confirm dialog ("Remove reminder policy?" + `formatPolicyHeadline`
preview) all currently say "policy". The remove-confirm preview switches from the
jargon headline to the same plain timing + recipient line as the card. The
Russian phrasings in the grill were for discussion only.

### D7 — New reminders start from a valid preset

`emptyPolicyForm` today fixes `kind=deadline` but pulls `audience` from
`defaultReminderAudience`; a `head-of-late` default therefore silently builds
`deadline → head-of-late` — the invalid pair D2 exists to prevent (Codex round
1, finding 1). The fix: a new reminder defaults to the deadline→leads preset, and
the form derives `kind`+`audience` from the preset, so the stray default audience
can no longer leak into an unpaired value. This makes the `Settings → Reminders`
"Default audience" control fully inert for pairing — extra weight behind the
follow-up below.

## Blind spots considered

- **Multiple policies of one type** — handled by D1 (each is its own card);
  presets are creation conveniences, not unique keys.
- **Inactive policy next-send** — D4 yields "No upcoming sends".
- **Legacy pairings** — D3 ("Custom", preserve).
- **i18n** — D6 keeps strings English; no Russian in `apps/web/src/**/*.tsx`
  production copy.
- **`active` toggle write path** — the card toggle reuses the existing
  `savePolicy` mutation (same path as the dialog's Active checkbox today); no new
  endpoint.

### D8 — Inline editing, modal-less Add

Clicking Edit on a card replaces that single card with the edit form in the list.
Adding a new reminder renders the same form at the top of the list. This keeps
the admin in the list context and avoids a modal dialog. The form is the same
component used for both Add and Edit, only its placement and initial values
differ. Cancellation collapses the form back to the card (or removes it for a new
reminder).

### D9 — Remove permanently deletes the policy and its derived rules

The user explicitly asked for deletion rather than archiving. The backend API
`removePolicy` hard-deletes the `ReminderPolicy` and its `ReminderRule` rows
(executions cascade with their rules). The UI remove-confirm dialog states the
action is permanent and cannot be undone. This changes the previous
archive/soft-delete semantics where derived rules were parked as `paused`.

## Follow-up (not in this change)

`Settings → Reminders` still exposes a "Default audience" control. After D7 it no
longer affects Reminder type selection — the preset owns the kind/audience
pairing, so the setting is inert for new reminders (it stays visible but stops
preselecting anything that matters). Removing the now-stale control (UI, and
possibly the `defaultReminderAudience` AppSettings column) is a separate change;
flagged here so it is not forgotten.

## Verification

- Vitest: `apps/web` reminders tab/row/form tests — new copy, next-send line,
  preset control, legacy "Custom" path, Advanced collapse.
- Live: reload `/admin?tab=reminders`; confirm two plain cards, next-send line,
  preset dialog, Advanced collapsed. (Web container runs `next dev` with `src`
  mounted — hot reload applies.)
- Gates: `pnpm typecheck`, `pnpm lint`, `pnpm test` green; grep the changed
  `*.tsx` for Cyrillic (`grep -nE '[а-яА-Я]'`) — every hit must be a comment or
  test, never production copy.
